require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { ensureSchema } = require('./ensure-schema');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const stocksRoutes = require('./routes/stocks');
const reportsRoutes = require('./routes/reports');
const movementRoutes = require('./routes/movement');
const customPositionsRoutes = require('./routes/customPositions');

const globalProductsRoutes = require('./routes/globalProducts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/global-products', globalProductsRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/movement', movementRoutes);
app.use('/api/custom-positions', customPositionsRoutes);

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/products', productsRoutes);
app.use('/global-products', globalProductsRoutes);
app.use('/stocks', stocksRoutes);
app.use('/reports', reportsRoutes);
app.use('/movement', movementRoutes);
app.use('/custom-positions', customPositionsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await ensureSchema(pool);
    app.listen(PORT, () => {
      console.log(`Сервер запущен: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Ошибка инициализации схемы:', err.message);
    process.exit(1);
  }
}

start();
