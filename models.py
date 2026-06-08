# models.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database import Base

class User(Base):
    __tablename__ = "users"

    telegram_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=True)
    is_subscribed = Column(Boolean, default=False)
    auth_status = Column(Boolean, default=False)

class MailingSettings(Base):
    __tablename__ = "mailing_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.telegram_id"))
    text = Column(String, nullable=True)
    cycles = Column(Integer, default=0)
    cooldown = Column(Integer, default=0)
    target_type = Column(String, nullable=True)  # "all" или "folders"
