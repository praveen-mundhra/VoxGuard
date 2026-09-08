from sqlalchemy import Column, Integer, String, Float, Text, DateTime, func
from .db import Base

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    category = Column(String(80), nullable=False)
    risk_score = Column(Integer, nullable=False, default=0)
    details_json = Column(Text, default="{}")
    created_at = Column(DateTime, server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(30), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class Scan(Base):
    __tablename__ = "scans"
    id = Column(Integer, primary_key=True)
    kind = Column(String(40), nullable=False)
    risk_score = Column(Float, nullable=False)
    verdict = Column(String(30), nullable=False)
    payload_json = Column(Text, default="{}")
    created_at = Column(DateTime, server_default=func.now())
