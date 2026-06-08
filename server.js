const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8946158118:AAENzQ0R_vR2S7Bua3HQuZkSyUxOXkaeqJY';
const MINI_APP_URL = 'https://rassylkabot.vercel.app/';

// Подключение к SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Ошибка SQLite:', err.message);
    } else {
        console.log('Подключено к базе данных SQLite.');
    }
});

// ПРИНУДИТЕЛЬНЫЙ СБРОС И ПЕРЕСОЗДАНИЕ БАЗЫ ДАННЫХ
db.serialize(() => {
    console.log('Перезапуск структуры таблиц...');
    
    db.run("DROP TABLE IF EXISTS users");
    db.run("DROP TABLE IF EXISTS active_campaigns");

    // Создание таблицы пользователей с чистого листа
    db.run(`CREATE TABLE users (
        telegram_id INTEGER PRIMARY KEY,
        is_subscribed INTEGER DEFAULT 0,
        api_id TEXT,
        api_hash TEXT,
        phone TEXT,
        is_authorized INTEGER DEFAULT 0
    )`);

    // Создание таблицы кампаний
    db.run(`CREATE TABLE active_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER,
        text TEXT,
        total_cycles INTEGER,
        current_cycle INTEGER DEFAULT 0,
        cooldown INTEGER,
        target_type TEXT,
        folders TEXT,
        status TEXT DEFAULT 'pending'
    )`);
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Проверка состояния подписки/авторизации пользователя
app.get('/api/user-status/:id', (req, res) => {
    const userId = req.params.id;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (err || !row) {
            return res.json({ is_subscribed: 0, is_authorized: 0 });
        }
        res.json({
            is_subscribed: row.is_subscribed,
            is_authorized: row.is_authorized
        });
    });
});

// API: Генерация инвойса для покупки подписки через Stars
app.post('/api/create-invoice', async (req, res) => {
    const { userId } = req.body;

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: "Доступ к Рассыльщику",
                description: "Пожизненная активация автоматизированного инструмента рассылок",
                payload: `user_sub_${userId}_${Date.now()}`,
                provider_token: "",
                currency: "XTR",
                prices: [{ label: "Активация", amount: 50 }]
            })
        });

        const data = await response.json();
        if (data.ok) {
            res.json({ success: true, invoiceLink: data.result });
        } else {
            res.status(500).json({ success: false, error: data.description });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Шаг 1 авторизации (Запрос кода)
app.post('/api/telegram-auth/request', (req, res) => {
    const { apiId, apiHash, phone, userId } = req.body;

    db.run(
        `INSERT INTO users (telegram_id, is_subscribed, api_id, api_hash, phone) 
         VALUES (?, 1, ?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET api_id = ?, api_hash = ?, phone = ?`,
        [userId, apiId, apiHash, phone, apiId, apiHash, phone],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// API: Шаг 2 авторизации (Ввод кода)
app.post('/api/telegram-auth/verify', (req, res) => {
    const { code, userId } = req.body;

    if (code) {
        db.run(
            `UPDATE users SET is_authorized = 1 WHERE telegram_id = ?`,
            [userId],
            (err) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true });
            }
        );
    } else {
        res.status(400).json({ success: false, error: 'Код не может быть пустым.' });
    }
});

// API: Запуск новой рекламной кампании
app.post('/api/start-campaign', (req, res) => {
    const { userId, text, cycles, cooldown, target, folders } = req.body;
    const foldersStr = folders ? folders.join(',') : '';

    db.run(
        `INSERT INTO active_campaigns (telegram_id, text, total_cycles, cooldown, target_type, folders, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'running')`,
        [userId, text, cycles, cooldown, target, foldersStr],
        function(err) {
            if (err) return res.status(500).json({ success: false });
            
            const campaignId = this.lastID;
            runMailingWorker(campaignId, cycles, cooldown);
            res.json({ success: true, campaignId });
        }
    );
});

// API: Получение статуса запущенной кампании
app.get('/api/campaign-status/:id', (req, res) => {
    const campaignId = req.params.id;
    db.get(`SELECT * FROM active_campaigns WHERE id = ?`, [campaignId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Не найдено" });
        res.json(row);
    });
});

// Воркер фонового обновления циклов рассылки
function runMailingWorker(campaignId, totalCycles, cooldownSeconds) {
    let currentCycle = 0;

    const interval = setInterval(() => {
        currentCycle++;
        
        db.run(
            `UPDATE active_campaigns SET current_cycle = ? WHERE id = ?`,
            [currentCycle, campaignId],
            (err) => {
                if (err) console.error('Ошибка фонового воркера:', err);
            }
        );

        console.log(`[Campaign ID #${campaignId}] Цикл ${currentCycle}/${totalCycles} завершен.`);

        if (currentCycle >= totalCycles) {
            clearInterval(interval);
            db.run(`UPDATE active_campaigns SET status = 'completed' WHERE id = ?`, [campaignId]);
        }
    }, cooldownSeconds * 1000);
}

app.listen(PORT, () => {
    console.log(`Бэкенд-сервер доступен по порту ${PORT}`);
});


// Telegram-бот
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply(
        `Сброс базы данных успешно выполнен! ⚙️\nВсе готово к первому использованию. Нажмите кнопку ниже, чтобы войти:`,
        Markup.keyboard([
            [Markup.button.webApp('Открыть Mini App', MINI_APP_URL)]
        ]).resize()
    );
});

// Обработка платежей в Telegram Stars
bot.on('pre_checkout_query', (ctx) => {
    ctx.answerPreCheckoutQuery(true).catch(err => console.error(err));
});

bot.on('successful_payment', (ctx) => {
    const userId = ctx.from.id;
    db.run(
        `INSERT INTO users (telegram_id, is_subscribed) VALUES (?, 1)
         ON CONFLICT(telegram_id) DO UPDATE SET is_subscribed = 1`,
        [userId],
        () => {
            ctx.reply("✨ Оплата прошла успешно! Ваша подписка активирована. Вернитесь в Mini App и продолжите авторизацию.");
        }
    );
});

bot.launch().catch(err => console.error(err));
