const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

// Импорт MTProto GramJS
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8946158118:AAENzQ0R_vR2S7Bua3HQuZkSyUxOXkaeqJY';
const MINI_APP_URL = 'https://rassylkabot.vercel.app/';

// Хранилище временных клиентов в памяти для авторизации
const activeClients = new Map();

// Инициализация базы данных SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Ошибка SQLite:', err.message);
});

db.serialize(() => {
    // Таблица пользователей с хранением GramJS String Session
    db.run(`CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        is_subscribed INTEGER DEFAULT 0,
        api_id TEXT,
        api_hash TEXT,
        phone TEXT,
        string_session TEXT,
        is_authorized INTEGER DEFAULT 0
    )`);

    // Таблица запущенных рассылок
    db.run(`CREATE TABLE IF NOT EXISTS active_campaigns (
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

// 1. Статус подписки и сессии
app.get('/api/user-status/:id', (req, res) => {
    const userId = req.params.id;
    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (err || !row) return res.json({ is_subscribed: 0, is_authorized: 0 });
        res.json({
            is_subscribed: row.is_subscribed,
            is_authorized: row.is_authorized
        });
    });
});

// 2. Создание платежной ссылки Telegram Stars (50 Stars)
app.post('/api/create-invoice', async (req, res) => {
    const { userId } = req.body;
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: "Подписка на Маркетолог",
                description: "Активация встроенного юзербота и инструментов планирования рассылки",
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

// 3. MTPROTO Шаг 1: Инициализация клиента и генерация SMS кода в Telegram
app.post('/api/telegram-auth/request', async (req, res) => {
    const { apiId, apiHash, phone, userId } = req.body;

    try {
        const client = new TelegramClient(new StringSession(""), Number(apiId), apiHash, {
            connectionRetries: 5,
        });

        await client.connect();

        // Отправка запроса SMS на сервера Telegram
        const result = await client.sendCode(
            {
                apiId: Number(apiId),
                apiHash: apiHash
            },
            phone
        );

        // Кэшируем клиента в памяти для Шага 2 (ввода кода)
        activeClients.set(userId, {
            client,
            phone,
            apiId,
            apiHash,
            phoneCodeHash: result.phoneCodeHash
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. MTPROTO Шаг 2: Верификация кода
app.post('/api/telegram-auth/verify', async (req, res) => {
    const { code, userId } = req.body;
    const sessionData = activeClients.get(userId);

    if (!sessionData) {
        return res.status(400).json({ success: false, error: "Session expired. Please request code again." });
    }

    const { client, phone, phoneCodeHash, apiId, apiHash } = sessionData;

    try {
        // Выполняем авторизацию на серверах Telegram
        await client.invoke(
            new Api.auth.SignIn({
                phoneNumber: phone,
                phoneCodeHash: phoneCodeHash,
                phoneCode: code
            })
        );

        // Получаем уникальный String Session для автоматического входа в будущем
        const stringSession = client.session.save();

        db.run(
            `INSERT INTO users (telegram_id, is_subscribed, api_id, api_hash, phone, string_session, is_authorized) 
             VALUES (?, 1, ?, ?, ?, ?, 1)
             ON CONFLICT(telegram_id) DO UPDATE SET api_id = ?, api_hash = ?, phone = ?, string_session = ?, is_authorized = 1`,
            [userId, apiId, apiHash, phone, stringSession, apiId, apiHash, phone, stringSession],
            (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                
                // Удаляем временного клиента из ОЗУ
                activeClients.delete(userId);
                res.json({ success: true });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. ПОЛУЧЕНИЕ РЕАЛЬНЫХ ПАПОК АККАУНТА (messages.GetDialogFilters)
app.get('/api/get-folders/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], async (err, row) => {
        if (err || !row || !row.string_session) {
            return res.status(400).json({ success: false, error: "Сессия не найдена" });
        }

        try {
            const client = new TelegramClient(new StringSession(row.string_session), Number(row.api_id), row.api_hash, {
                connectionRetries: 3
            });
            await client.connect();

            // Вызываем метод API Telegram
            const filters = await client.invoke(new Api.messages.GetDialogFilters());

            // Фильтруем и отдаем названия папок
            const foldersList = filters.map(filter => {
                if (filter.title) {
                    return { id: filter.id, title: filter.title };
                }
                return null;
            }).filter(Boolean);

            await client.disconnect();
            res.json({ success: true, folders: foldersList });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
});

// 6. Запуск рассылки
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
            // Передаем запуск реальному воркеру
            runMailingWorker(campaignId, cycles, cooldown);
            res.json({ success: true, campaignId });
        }
    );
});

// 7. Получение прогресса рассылки
app.get('/api/campaign-status/:id', (req, res) => {
    const campaignId = req.params.id;
    db.get(`SELECT * FROM active_campaigns WHERE id = ?`, [campaignId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Не найдено" });
        res.json(row);
    });
});

// 8. Разрушение сессии
app.post('/api/logout/:userId', (req, res) => {
    const userId = req.params.userId;
    db.run(`UPDATE users SET is_authorized = 0, string_session = NULL WHERE telegram_id = ?`, [userId], () => {
        res.json({ success: true });
    });
});

// РЕАЛЬНЫЙ СЕНДЕР ЮЗЕРБОТА
async function runMailingWorker(campaignId, totalCycles, cooldownSeconds) {
    db.get(`SELECT * FROM active_campaigns WHERE id = ?`, [campaignId], async (err, campaign) => {
        if (err || !campaign) return;

        db.get(`SELECT * FROM users WHERE telegram_id = ?`, [campaign.telegram_id], async (err, user) => {
            if (err || !user || !user.string_session) return;

            // Восстанавливаем сохраненное MTProto подключение юзербота
            const client = new TelegramClient(new StringSession(user.string_session), Number(user.api_id), user.api_hash, {
                connectionRetries: 3
            });

            await client.connect();

            let currentCycle = 0;
            const interval = setInterval(async () => {
                currentCycle++;

                try {
                    if (campaign.target_type === 'all') {
                        // Получаем диалоги (Группы / Супергруппы / ЛС)
                        const dialogs = await client.getDialogs({ limit: 50 });
                        for (const dialog of dialogs) {
                            if (dialog.id) {
                                await client.sendMessage(dialog.id, { message: campaign.text });
                            }
                        }
                    } else {
                        // Сортировка по папкам
                        const selectedFolders = campaign.folders.split(',');
                        const filters = await client.invoke(new Api.messages.GetDialogFilters());

                        for (const filter of filters) {
                            if (filter.title && selectedFolders.includes(filter.title) && filter.includePeers) {
                                for (const peer of filter.includePeers) {
                                    // Отправка сообщений по списку объектов в папке
                                    await client.sendMessage(peer, { message: campaign.text });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Ошибка во время отправки сообщений:", e);
                }

                db.run(`UPDATE active_campaigns SET current_cycle = ? WHERE id = ?`, [currentCycle, campaignId]);

                if (currentCycle >= totalCycles) {
                    clearInterval(interval);
                    db.run(`UPDATE active_campaigns SET status = 'completed' WHERE id = ?`, [campaignId]);
                    await client.disconnect();
                }
            }, cooldownSeconds * 1000);
        });
    });
}

app.listen(PORT, () => {
    console.log(`Сервер рассылки запущен на порту ${PORT}`);
});

// Телеграм-бот для поддержки
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply(
        `Привет! Панель Маркетолога полностью перезапущена.\n\nНажмите на кнопку снизу для входа:`,
        Markup.keyboard([
            [Markup.button.webApp('Панель управления', MINI_APP_URL)]
        ]).resize()
    );
});

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
            ctx.reply("🌟 Подписка успешно куплена! Вы можете вернуться в приложение и запросить код.");
        }
    );
});

bot.launch().catch(err => console.error(err));
