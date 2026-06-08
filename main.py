import asyncio
import logging
import os
import sqlite3
import uvicorn
from typing import Optional, List
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.utils.keyboard import InlineKeyboardBuilder

# ==================== НАСТРОЙКИ СИСТЕМЫ ====================
BOT_TOKEN = "7727553460:AAHWkV9Skzw9oQRDWV51P2OLe7m9-UaInV4"
ADMIN_ID = 8501149575
WEB_APP_URL = "https://your-domain.ngrok-free.app" # Замени на свой URL

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
app = FastAPI(title="Black Liquid Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- АВТОНОМНЫЕ ФУНКЦИИ БД (БЕЗ ВНЕШНИХ ИМПОРТОВ) ---
DB_NAME = "marketer_engine.db"

def init_embedded_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users_state (
            user_id INTEGER PRIMARY KEY,
            is_paid INTEGER DEFAULT 0,
            has_session INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS global_session (
            id INTEGER PRIMARY KEY,
            session_string TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def db_add_log(log_type: str, text: str):
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO system_logs (type, text) VALUES (?, ?)", (log_type, text))
        conn.commit()
        conn.close()
    except Exception:
        pass

def db_get_user_status(user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT is_paid, has_session FROM users_state WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    # Если юзера нет в БД, считаем его не оплатившим и без сессии
    return {"is_paid": row[0] if row else 0, "has_session": row[1] if row else 0}

def db_update_session_state(user_id: int, has_session: bool):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO users_state (user_id, has_session) VALUES (?, ?)", 
                   (user_id, 1 if has_session else 0))
    # Также обновляем глобальный флаг, если это админ
    if user_id == ADMIN_ID:
        cursor.execute("INSERT OR REPLACE INTO global_session (id, session_string) VALUES (1, ?)", 
                       ("active_placeholder" if has_session else None,))
    conn.commit()
    conn.close()

def db_activate_payment(user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO users_state (user_id, is_paid) VALUES (?, 1)", (user_id,))
    conn.commit()
    conn.close()

# Модели запросов API
class RegStep1(BaseModel):
    user_id: int
    api_id: str
    api_hash: str
    phone: str

class RegStep2(BaseModel):
    user_id: int
    phone: str
    code: str

class BroadcastCampaign(BaseModel):
    text: str
    target: str
    cycles: int
    cooldown: int

# --- API ЭНДПОИНТЫ ДЛЯ MINI APP ---

@app.get("/api/user_status/{user_id}")
async def get_user_status_api(user_id: int):
    status = db_get_user_status(user_id)
    # Админам по умолчанию ставим статус оплаты в 1
    if user_id == ADMIN_ID:
        status["is_paid"] = 1
    return status

@app.post("/api/auth/step1")
async def auth_step1_api(data: RegStep1):
    # Имитация задержки "Подключение к серверам..."
    await asyncio.sleep(2.5) 
    
    # Здесь должна быть логика отправки кода через Pyrogram
    # ...
    
    db_add_log("system", f"Запрос кода подтверждения для {data.phone}")
    return {"status": "code_sent"}

@app.post("/api/auth/step2")
async def auth_step2_api(data: RegStep2):
    await asyncio.sleep(1.5)
    # Здесь должна быть логика проверки кода через Pyrogram
    # ...

    # Если успех, обновляем флаг сессии
    db_update_session_state(data.user_id, True)
    db_add_log("success", f"Аккаунт {data.phone} успешно авторизован.")
    return {"status": "success"}

@app.get("/api/logs")
async def get_logs_api():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT type, text FROM system_logs ORDER BY id DESC LIMIT 15")
    rows = cursor.fetchall()
    conn.close()
    # Если логов нет, отдаем базовый
    if not rows:
        return {"logs": [{"type": "system", "text": "Ядро системы готово к работе"}]}
    return {"logs": [{"type": r[0], "text": r[1]} for r in reversed(rows)]}

@app.post("/api/session/delete/{user_id}")
async def delete_session_api(user_id: int):
    if user_id != ADMIN_ID:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Логика удаления сессии Pyrogram
    # ...
    
    db_update_session_state(user_id, False)
    db_add_log("system", f"Рабочая сессия удалена пользователем.")
    return {"status": "deleted"}

@app.post("/api/broadcast/start")
async def start_broadcast_api(data: BroadcastCampaign):
    db_add_log("system", f"Запуск кампании: text={data.text[:15]}..., циклов={data.cycles}, КД={data.cooldown}")
    return {"status": "started"}

# Раздача статики
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

# --- БОТ ЛОГИКА (БЕЗ ЛИШНЕГО ТЕКСТА) ---

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    builder = InlineKeyboardBuilder()
    builder.add(types.InlineKeyboardButton(text="📱 Open Control Panel", web_app=types.WebAppInfo(url=WEB_APP_URL)))
    # Минималистичное приветствие, бот просто готов выдать кнопку
    await message.answer("⭐️ Нажмите кнопку ниже для перехода в интерфейс:", reply_markup=builder.as_markup())

async def start_embedded_main():
    init_embedded_db()
    
    config = uvicorn.Config(app=app, host="0.0.0.0", port=8000, loop="asyncio")
    server = uvicorn.Server(config)
    
    await asyncio.gather(
        dp.start_polling(bot),
        server.serve()
    )

if __name__ == "__main__":
    asyncio.run(start_embedded_main())
