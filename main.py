import asyncio
import logging
import os
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.utils.keyboard import InlineKeyboardBuilder

# Настройки конфигурации
BOT_TOKEN = "7727553460:AAHWkV9Skzw9oQRDWV51P2OLe7m9-UaInV4"
WEB_APP_URL = "https://your-domain.ngrok-free.app" # Замени на свой URL

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
app = FastAPI(title="Liquid Glass API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Модели данных
class AuthStep1Request(BaseModel):
    api_id: str
    api_hash: str
    phone: str

class AuthStep2Request(BaseModel):
    phone: str
    code: str

class BroadcastRequest(BaseModel):
    target: str # "all" или "selected"
    chats: Optional[str] = None
    cooldown: int
    cycles: int

# Временное хранилище логов в памяти для демонстрации
system_logs = [
    {"type": "system", "text": "Ядро системы успешно запущено"},
    {"type": "success", "text": "Соединение с шлюзом Telegram установлено"}
]

@app.post("/api/auth/step1")
async def auth_step1(data: AuthStep1Request):
    # Имитация проверки сервером и отправки кода
    await asyncio.sleep(2.5) # Анимационная задержка "Подключение к серверам..."
    if not data.api_id or not data.api_hash or not data.phone:
        raise HTTPException(status_code=400, detail="Все поля обязательны")
    system_logs.append({"type": "system", "text": f"Запрос кода для номeра {data.phone}"})
    return {"status": "code_sent", "message": "Код подтверждения отправлен"}

@app.post("/api/auth/step2")
async def auth_step2(data: AuthStep2Request):
    await asyncio.sleep(1.5)
    if data.code == "0000": # Тестовый код
        raise HTTPException(status_code=400, detail="Неверный код авторизации")
    system_logs.append({"type": "success", "text": f"Аккаунт {data.phone} успешно добавлен"})
    return {"status": "success", "message": "Авторизация успешно завершена"}

@app.get("/api/logs")
async def get_logs():
    return {"logs": system_logs[-15:]}

@app.post("/api/broadcast")
async def start_broadcast(data: BroadcastRequest):
    system_logs.append({"type": "system", "text": f"Запуск рассылки: таргет={data.target}, циклов={data.cycles}"})
    return {"status": "started"}

# Подключение фронтенда
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    builder = InlineKeyboardBuilder()
    builder.add(types.InlineKeyboardButton(text="📱 Открыть Панель", web_app=types.WebAppInfo(url=WEB_APP_URL)))
    await message.answer("⭐️ Нажмите кнопку ниже для перехода в Liquid Glass интерфейс:", reply_markup=builder.as_markup())

async def main():
    config = uvicorn.Config(app=app, host="0.0.0.0", port=8000, loop="asyncio")
    server = uvicorn.Server(config)
    await asyncio.gather(dp.start_polling(bot), server.serve())

if __name__ == "__main__":
    asyncio.run(main())
