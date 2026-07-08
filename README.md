# Склад — система управления товарами

Веб-приложение для учёта товаров на складах магазинов. Каждый магазин видит только свой склад, администратор — все склады.

## Технологии

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **База данных:** PostgreSQL (библиотека `pg`)

## Учётные записи по умолчанию

| Логин  | Пароль   | Роль          |
|--------|----------|---------------|
| admin  | admin123 | Администратор |
| shop1  | 123456   | Магазин       |
| shop2  | 123456   | Магазин       |

---

## Пошаговая установка и запуск

### 1. Убедитесь, что установлены Node.js и PostgreSQL

```powershell
node --version
npm --version
psql --version
```

### 2. Настройте переменные окружения сервера

Скопируйте файл примера и укажите **ваш пароль от PostgreSQL**:

```powershell
cd C:\Users\Ryzen2\Desktop\popytkaSklad\server
copy .env.example .env
```

Откройте файл `.env` и замените строку:

```
DB_PASSWORD=ВСТАВЬТЕ_ВАШ_ПАРОЛЬ
```

на ваш реальный пароль, который вы задали при установке PostgreSQL.

### 3. Установите зависимости сервера

```powershell
cd C:\Users\Ryzen2\Desktop\popytkaSklad\server
npm install
```

### 4. Создайте базу данных и начальные данные

Скрипт автоматически создаст базу `popytka_sklad`, таблицы и пользователей:

```powershell
npm run init-db
```

**Альтернатива — вручную через psql:**

```powershell
psql -U postgres
```

```sql
CREATE DATABASE popytka_sklad;
\q
```

Затем запустите `npm run init-db`.

### 5. Запустите сервер (API)

```powershell
cd C:\Users\Ryzen2\Desktop\popytkaSklad\server
npm start
```

Сервер будет доступен на **http://localhost:3001**

### 6. Установите зависимости клиента (в новом терминале)

```powershell
cd C:\Users\Ryzen2\Desktop\popytkaSklad\client
npm install
```

### 7. Запустите фронтенд

```powershell
npm run dev
```

Сайт откроется на **http://localhost:5173**

---

## Быстрый запуск (после первой настройки)

**Терминал 1 — сервер:**
```powershell
cd C:\Users\Ryzen2\Desktop\popytkaSklad\server
npm start
```

**Терминал 2 — клиент:**
```powershell
cd C:\Users\Ryzen2\Desktop\popytkaSklad\client
npm run dev
```

Откройте браузер: **http://localhost:5173**

---

## Структура проекта

```
popytkaSklad/
├── server/           # Backend (Express + PostgreSQL)
│   ├── index.js      # Точка входа сервера
│   ├── init-db.js    # Создание БД и начальных данных
│   ├── db.js         # Подключение к PostgreSQL
│   ├── routes/       # API-маршруты
│   └── .env          # Пароль БД (не коммитить!)
├── client/           # Frontend (React)
│   └── src/
│       ├── pages/    # Login, Dashboard
│       └── api.js    # HTTP-запросы к API
└── README.md
```

## API

| Метод  | URL                        | Описание                    |
|--------|----------------------------|-----------------------------|
| POST   | /api/auth/login            | Вход                        |
| GET    | /api/auth/me               | Текущий пользователь        |
| GET    | /api/users                 | Список пользователей (admin)|
| POST   | /api/users                 | Создать пользователя (admin)|
| DELETE | /api/users/:id             | Удалить пользователя (admin)|
| GET    | /api/products              | Товары текущего пользователя|
| GET    | /api/products?userId=N     | Товары пользователя (admin) |
| POST   | /api/products              | Добавить товар (admin)      |
| PUT    | /api/products/:id/quantity | Обновить количество         |
| PATCH  | /api/products/:id/name     | Переименовать (admin)       |
| DELETE | /api/products/:id          | Удалить товар (admin)       |

## Возможности

- **Магазин (shop1, shop2):** просмотр своего склада, обновление количества товаров
- **Администратор:** просмотр всех складов, добавление/удаление пользователей и товаров, переименование товаров
- **Адаптивный дизайн:** удобно на телефоне и компьютере
