const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const EXPORTS_DIR = path.join(__dirname, '..', 'exports');
const VALID_TYPES = ['movement', 'return', 'shipment'];
const MONTH_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const isExcel =
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только Excel-файлы (.xlsx)'));
    }
  },
});

router.use(authMiddleware, adminOnly);

function normalizeMonth(value) {
  if (!value || !MONTH_PATTERN.test(value)) {
    return null;
  }

  return value.length === 7 ? `${value}-01` : value;
}

function buildStoredFileName(userId, type, month, timestamp) {
  const monthPart = month.replace(/-/g, '');
  return `${userId}_${type}_${monthPart}_${timestamp}.xlsx`;
}

function resolveExportPath(fileName) {
  const safeName = path.basename(fileName);
  const filePath = path.join(EXPORTS_DIR, safeName);

  if (!filePath.startsWith(EXPORTS_DIR)) {
    return null;
  }

  return filePath;
}

router.get('/', async (req, res) => {
  const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
  const type = req.query.type;
  const month = normalizeMonth(req.query.month);

  if (req.query.userId && isNaN(userId)) {
    return res.status(400).json({ error: 'Некорректный магазин' });
  }

  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Некорректный тип движения' });
  }

  if (req.query.month && !month) {
    return res.status(400).json({ error: 'Некорректный месяц' });
  }

  try {
    const conditions = [];
    const params = [];

    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    if (month) {
      params.push(month);
      conditions.push(`month = $${params.length}::date`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id,
              user_id AS "userId",
              type,
              month::text AS month,
              file_name AS "fileName",
              created_at AS "createdAt"
       FROM movement_exports
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  const userId = parseInt(req.body.userId, 10);
  const type = req.body.type;
  const month = normalizeMonth(req.body.month);

  if (isNaN(userId) || !type || !month) {
    return res.status(400).json({ error: 'Укажите магазин, тип и месяц' });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Некорректный тип движения' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Файл не передан' });
  }

  try {
    const user = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'user'`,
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Магазин не найден' });
    }

    const timestamp = Date.now();
    const fileName = buildStoredFileName(userId, type, month, timestamp);
    const filePath = resolveExportPath(fileName);

    if (!filePath) {
      return res.status(400).json({ error: 'Некорректное имя файла' });
    }

    const existing = await pool.query(
      `SELECT id, file_name
       FROM movement_exports
       WHERE user_id = $1 AND type = $2 AND month = $3::date`,
      [userId, type, month]
    );

    if (existing.rows.length > 0) {
      const oldPath = resolveExportPath(existing.rows[0].file_name);
      if (oldPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      await fs.promises.writeFile(filePath, req.file.buffer);

      const updated = await pool.query(
        `UPDATE movement_exports
         SET file_name = $1, created_at = NOW()
         WHERE id = $2
         RETURNING id, file_name AS "fileName"`,
        [fileName, existing.rows[0].id]
      );

      return res.json(updated.rows[0]);
    }

    await fs.promises.writeFile(filePath, req.file.buffer);

    const inserted = await pool.query(
      `INSERT INTO movement_exports (user_id, type, month, file_name)
       VALUES ($1, $2, $3::date, $4)
       RETURNING id, file_name AS "fileName"`,
      [userId, type, month, fileName]
    );

    res.json(inserted.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/download', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Некорректный идентификатор' });
  }

  try {
    const result = await pool.query(
      `SELECT file_name AS "fileName"
       FROM movement_exports
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    const fileName = result.rows[0].fileName;
    const filePath = resolveExportPath(fileName);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден на сервере' });
    }

    res.download(filePath, fileName, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
