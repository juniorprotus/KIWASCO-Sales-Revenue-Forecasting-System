from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class CustomerType(str, enum.Enum):
    domestic = "domestic"
    commercial = "commercial"
    industrial = "industrial"
    institutional = "institutional"

class BillStatus(str, enum.Enum):
    paid = "paid"
    unpaid = "unpaid"
    partial = "partial"
    waived = "waived"

class UserRole(str, enum.Enum):
    admin = "admin"
    analyst = "analyst"
    viewer = "viewer"
    superadmin = "superadmin"

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    population = Column(Integer, default=0)
    area_sqkm = Column(Float, default=0.0)
    target_monthly_revenue = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customers = relationship("Customer", back_populates="zone")
    forecasts = relationship("Forecast", back_populates="zone")
    alerts = relationship("Alert", back_populates="zone")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    account_no = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    customer_type = Column(Enum(CustomerType), default=CustomerType.domestic)
    meter_no = Column(String(20), unique=True)
    phone = Column(String(20))
    address = Column(Text)
    connection_date = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    zone = relationship("Zone", back_populates="customers")
    bills = relationship("Bill", back_populates="customer")

class Bill(Base):
    __tablename__ = "bills"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    units_consumed = Column(Float, nullable=False)  # cubic meters
    amount_billed = Column(Float, nullable=False)   # KES
    amount_paid = Column(Float, default=0.0)        # KES
    bill_date = Column(Date, nullable=False)
    due_date = Column(Date)
    payment_date = Column(Date, nullable=True)
    status = Column(Enum(BillStatus), default=BillStatus.unpaid)
    nrw_loss = Column(Float, default=0.0)  # Non-revenue water loss
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="bills")

class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    forecast_month = Column(Date, nullable=False)
    predicted_consumption = Column(Float)   # cubic meters
    predicted_revenue = Column(Float)       # KES
    predicted_default_rate = Column(Float)  # percentage
    predicted_nrw = Column(Float)           # cubic meters
    lower_bound = Column(Float)
    upper_bound = Column(Float)
    model_used = Column(String(50), default="Prophet")
    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    zone = relationship("Zone", back_populates="forecasts")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    message = Column(Text, nullable=False)
    threshold_type = Column(String(50))  # revenue_drop, high_nrw, capacity_risk, defaulter_surge
    severity = Column(String(20), default="warning")  # info, warning, critical
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    zone = relationship("Zone", back_populates="alerts")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(200))
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="viewer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
