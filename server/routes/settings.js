const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { isFifoEnabled, setFifoEnabled } = require('../utils/fifoSettings');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/fifo', async (req, res) => {
  try {
    const enabled = await isFifoEnabled();
    res.json({ enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки настроек' });
  }
});

router.put('/fifo', async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Укажите enabled: true или false' });
  }

  try {
    await setFifoEnabled(enabled);
    res.json({ enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
});

module.exports = router;
