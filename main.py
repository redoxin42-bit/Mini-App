import asyncio
import sqlite3
import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.utils.keyboard import InlineKeyboardBuilder

BOT_TOKEN = "7727553460:AAHWkV9Skzw9oQRDWV51P2OLe7m9-UaInV4"
WEB_APP_URL = "https://rassylkabot.vercel.app"  # Твой URL на Vercel

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
app = FastAPI(title="Marketer Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Простая инициализация БД прямо внутри файла, чтобы ничего не ломалось
def init_local_db():
    conn = sqlite3.connect("marketer_local.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            phone TEXT PRIMARY KEY,
            api_id TEXT,
            api_hash TEXT,
            status TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def add_local_log(log_type: str, text: str):
    try:
        conn = sqlite3.connect("marketer_local.db")
        cursor = conn.cursor()
        cursor.execute("INSERT INTO logs (type, text) VALUES (?, ?)", (log_type, text))
        conn.commit()
        conn.close()
    except Exception:
        pass

# Модели запросов API
class RegStep1(BaseModel):
    api_id: str
    api_hash: str
    phone: str

class RegStep2(BaseModel):
    phone: str
    code: str

class LaunchBroadcast(BaseModel):
    target_type: str
    chats: Optional[str] = None
    cooldown: int
    cycles: int

@app.post("/api/auth/step1")
async def auth_step1(data: RegStep1):
    if not data.api_id or not data.api_hash or not data.phone:
        raise HTTPException(status_code=400, detail="Заполните все поля")
    
    # Имитация задержки "Подключение к серверам..."
    await asyncio.sleep(3.0)
    
    conn = sqlite3.connect("marketer_local.db")
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO sessions (phone, api_id, api_hash, status) VALUES (?, ?, ?, ?)", 
                   (data.phone, data.api_id, data.api_hash, "pending"))
    conn.commit()
    conn.close()
    
    add_local_log("system", f"Запрос кода подтверждения для {data.phone}")
    return {"status": "waiting_code"}

@app.post("/api/auth/step2")
async def auth_step2(data: RegStep2):
    await asyncio.sleep(2.0)
    if data.code == "00000":
        raise HTTPException(status_code=400, detail="Неверный код")
        
    conn = sqlite3.connect("marketer_local.db")
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET status = 'active' WHERE phone = ?", (data.phone,))
    conn.commit()
    conn.close()
    
    add_local_log("success", f"Аккаунт {data.phone} успешно авторизован")
    return {"status": "authorized"}

@app.get("/api/logs")
async def get_logs():
    conn = sqlite3.connect("marketer_local.db")
    cursor = conn.cursor()
    cursor.execute("SELECT type, text FROM logs ORDER BY id DESC LIMIT 20")
    rows = cursor.fetchall()
    conn.close()
    
    # Если логов нет, отдаем базовые системные
    if not rows:
        return {"logs": [{"type": "system", "text": "Ядро автоматизации запущено"}]}
    return {"logs": [{"type": r[0], "text": r[1]} for r in reversed(rows)]}

@app.post("/api/broadcast/start")
async def start_broadcast(data: LaunchBroadcast):
    add_local_log("system", f"Запуск кампании: {data.target_type}, интервал: {data.cooldown}с, циклов: {data.cycles}")
    return {"status": "started"}

# Раздача статики, если запускаешь локально
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    builder = InlineKeyboardBuilder()
    builder.add(types.InlineKeyboardButton(text="🔒 Open Control Panel", web_app=types.WebAppInfo(url=WEB_APP_URL)))
    await message.answer("Бот готов к работе. Используйте кнопку ниже для управления:", reply_markup=builder.as_markup())

async def start_application():
    init_local_db()
    add_local_log("system", "Сервер и бот инициализированы")
    
    config = uvicorn.Config(app=app, host="0.0.0.0", port=8000, loop="asyncio")
    server = uvicorn.Server(config)
    
    await asyncio.gather(
        dp.start_polling(bot),
        server.serve()
    )

if __name__ == "__main__":
    asyncio.run(start_application())
