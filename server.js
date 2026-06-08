const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

// Токен бота и адрес сайта
const BOT_TOKEN = '8946158118:AAENzQ0R_vR2S7Bua3HQuZkSyUxOXkaeqJY';
const MINI_APP_URL = 'https://rassylkabot.vercel.app/';

// Подключение базы данных SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Ошибка подключения к SQLite:', err.message);
    } else {
        console.log('Успешное подключение к SQLite.');
    }
});

// Инициализация структуры таблиц
db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        is_subscribed INTEGER DEFAULT 0,
        is_authorized INTEGER DEFAULT 0,
        activation_key TEXT
    )`);

    // Таблица кампаний рассылки
    db.run(`CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        text TEXT,
        cycles INTEGER,
        cooldown INTEGER,
        target_type TEXT,
        folders TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // раздача статики (index.html)

// API: Авторизация пользователя по ключу
app.post('/api/auth', (req, consts) => {
    const { userId, key } = req.body;
    
    // В данном примере "ключ доступа" жестко закодирован как "ADMIN123" или "rassylka2026"
    // Но вы можете хранить его в таблице users или генерировать уникальные ключи при покупке подписки
    if (key === 'ADMIN123' || key === 'rassylka2026') {
        db.run(
            `INSERT INTO users (telegram_id, is_authorized, activation_key) 
             VALUES (?, 1, ?) 
             ON CONFLICT(telegram_id) DO UPDATE SET is_authorized = 1, activation_key = ?`,
            [userId, key, key],
            (err) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                res.json({ success: true });
            }
        );
    } else {
        res.status(400).json({ success: false, error: 'Wrong activation key' });
    }
});

// API: Запуск и запись рассылки
app.post('/api/start-mailing', (req, res) => {
    const { userId, text, cycles, cooldown, target, folders } = req.body;
    const foldersString = folders ? folders.join(',') : '';

    db.run(
        `INSERT INTO campaigns (telegram_id, text, cycles, cooldown, target_type, folders) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, text, cycles, cooldown, target, foldersString],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            console.log(`Создана кампания рассылки ID: ${this.lastID} для пользователя: ${userId}`);
            res.json({ success: true, campaignId: this.lastID });
        }
    );
});

// Запуск Web-сервера Express
app.listen(PORT, () => {
    console.log(`Веб-сервер запущен на порту ${PORT}`);
});


// ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    const telegramId = ctx.from.id;

    // Автоматическая регистрация пользователя при старте бота
    db.run(`INSERT OR IGNORE INTO users (telegram_id) VALUES (?)`, [telegramId]);

    ctx.reply(
        `Приветствую, ${ctx.from.first_name}! 👋\n\nИспользуйте кнопку ниже для запуска панели управления рассылкой.`,
        Markup.keyboard([
            [Markup.button.webApp('Открыть Mini App', MINI_APP_URL)]
        ]).resize()
    );
});

// Запуск бота Telegram
bot.launch()
    .then(() => console.log('Telegram бот успешно запущен.'))
    .catch((err) => console.error('Ошибка старта бота:', err));

// Вежливый перезапуск
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    db.close();
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    db.close();
});
