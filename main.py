# main.py
import os
import hmac
import hashlib
from urllib.parse import parse_qsl
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

BOT_TOKEN = os.getenv("BOT_TOKEN", "8946158118:AAENzQ0R_vR2S7Bua3HQuZkSyUxOXkaeqJY")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "https://rassylkabot.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    init_data: str

class MailingSaveRequest(BaseModel):
    telegram_id: int
    text: str
    cycles: int
    cooldown: int
    target_type: str

def verify_telegram_data(init_data: str) -> dict:
    try:
        parsed_data = dict(parse_qsl(init_data))
        if "hash" not in parsed_data:
            return {}
        
        tg_hash = parsed_data.pop("hash")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash == tg_hash:
            import json
            return json.loads(parsed_data.get("user", "{}"))
        return {}
    except Exception:
        return {}

@app.post("/api/auth/verify")
def verify_auth(payload: AuthRequest, db: Session = Depends(get_db)):
    user_data = verify_telegram_data(payload.init_data)
    if not user_data or "id" not in user_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram Init Data")
    
    tg_id = user_data["id"]
    username = user_data.get("username")
    
    db_user = db.query(models.User).filter(models.User.telegram_id == tg_id).first()
    if not db_user:
        db_user = models.User(telegram_id=tg_id, username=username, is_subscribed=False, auth_status=False)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
    return {
        "telegram_id": db_user.telegram_id,
        "is_subscribed": db_user.is_subscribed,
        "auth_status": db_user.auth_status
    }

@app.post("/api/billing/create-invoice")
def create_invoice(user_id: int, db: Session = Depends(get_db)):
    # Заглушка для генерации инвойса Telegram Stars (Telegram Bot API: createInvoiceLink)
    # Возвращает готовую ссылку для фронтенда
    return {"invoice_url": f"https://t.me/invoice?example_stars_link_for_{user_id}"}

@app.post("/api/mailing/save")
def save_mailing(payload: MailingSaveRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.telegram_id == payload.telegram_id).first()
    if not db_user or not db_user.is_subscribed:
        raise HTTPException(status_code=403, detail="Subscription required")
        
    settings = db.query(models.MailingSettings).filter(models.MailingSettings.user_id == payload.telegram_id).first()
    if not settings:
        settings = models.MailingSettings(user_id=payload.telegram_id)
        db.add(settings)
        
    settings.text = payload.text
    settings.cycles = payload.cycles
    settings.cooldown = payload.cooldown
    settings.target_type = payload.target_type
    
    db.commit()
    return {"status": "success"}
