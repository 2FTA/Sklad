require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'popytka_sklad';

async function initDatabase() {
  const adminClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await adminClient.connect();

  const dbCheck = await adminClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [DB_NAME]
  );

  if (dbCheck.rows.length === 0) {
    await adminClient.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`База данных "${DB_NAME}" создана`);
  } else {
    console.log(`База данных "${DB_NAME}" уже существует`);
  }

  await adminClient.end();

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
  });

  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      login VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_plain VARCHAR(255),
      role VARCHAR(20) NOT NULL DEFAULT 'user'
    )
  `);

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0
    )
  `);

  const users = [
    { login: 'admin', password: 'admin123', role: 'admin' },
    { login: 'shop1', password: '123456', role: 'user' },
    { login: 'shop2', password: '123456', role: 'user' },
  ];

  for (const u of users) {
    const exists = await client.query('SELECT id FROM users WHERE login = $1', [u.login]);
    if (exists.rows.length === 0) {
      const hash = await bcrypt.hash(u.password, 10);
      const inserted = await client.query(
        'INSERT INTO users (login, password_hash, password_plain, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [u.login, hash, u.password, u.role]
      );
      console.log(`Создан пользователь: ${u.login}`);

      if (u.login === 'shop1') {
        const userId = inserted.rows[0].id;
        const products = ['Футболки', 'Кеды', 'Шорты'];
        for (const name of products) {
          await client.query(
            'INSERT INTO products (user_id, name, quantity) VALUES ($1, $2, 0)',
            [userId, name]
          );
        }
        console.log('  Добавлены товары для shop1');
      }

      if (u.login === 'shop2') {
        const userId = inserted.rows[0].id;
        const products = ['Футболки', 'Кеды', 'Шорты'];
        for (const name of products) {
          await client.query(
            'INSERT INTO products (user_id, name, quantity) VALUES ($1, $2, 0)',
            [userId, name]
          );
        }
        console.log('  Добавлены товары для shop2');
      }
    } else {
      await client.query(
        'UPDATE users SET password_plain = $1 WHERE login = $2 AND password_plain IS NULL',
        [u.password, u.login]
      );
      console.log(`Пользователь ${u.login} уже существует`);
    }
  }

  await client.end();
  console.log('\nИнициализация завершена!');
  console.log('\nУчётные записи:');
  console.log('  admin / admin123 (администратор)');
  console.log('  shop1 / 123456');
  console.log('  shop2 / 123456');
}

initDatabase().catch((err) => {
  console.error('Ошибка инициализации:', err.message);
  process.exit(1);
});
