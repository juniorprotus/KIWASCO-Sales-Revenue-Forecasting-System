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
    superadmin = "superadmin"
    analyst = "analyst"
    data_steward = "data_steward"
    revenue_officer = "revenue_officer"
    field_officer = "field_officer"
    viewer = "viewer"
    auditor = "auditor"

class TicketStatus(str, enum.Enum):
    open = "open"
    confirmed = "confirmed"
    false_positive = "false_positive"
    resolved = "resolved"

class AnomalyStatus(str, enum.Enum):
    pending = "pending"
    validated = "validated"
    dismissed = "dismissed"

class FlagStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"

# ── Core Models ───────────────────────────────────────────────────────────────

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
    leak_tickets = relationship("LeakTicket", back_populates="zone")
    data_quality_flags = relationship("DataQualityFlag", back_populates="zone")

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
    revenue_anomalies = relationship("RevenueAnomaly", back_populates="customer")

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
    revenue_anomalies = relationship("RevenueAnomaly", back_populates="bill")

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
    threshold_type = Column(String(50))
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

    audit_logs = relationship("AuditLog", back_populates="user")
    assigned_tickets = relationship("LeakTicket", back_populates="assigned_to_user")

# ── New Operational Models ────────────────────────────────────────────────────

class LeakTicket(Base):
    """NRW alert tickets created when Prophet detects a predicted leak.
    Field Officers receive and action these tickets on the ground."""
    __tablename__ = "leak_tickets"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    predicted_nrw = Column(Float)           # cubic meters flagged by Prophet
    nrw_threshold_pct = Column(Float)       # % above baseline that triggered this
    status = Column(String(20), default="open")  # open/confirmed/false_positive/resolved
    priority = Column(String(10), default="medium")  # low/medium/high/critical
    field_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    zone = relationship("Zone", back_populates="leak_tickets")
    assigned_to_user = relationship("User", back_populates="assigned_tickets")

class MeterReading(Base):
    """Raw door-to-door meter readings recorded by Field Officers."""
    __tablename__ = "meter_readings"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    reading_date = Column(Date, nullable=False)
    current_reading = Column(Float, nullable=False)
    previous_reading = Column(Float, nullable=True)
    units_consumed = Column(Float, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer")
    recorded_by = relationship("User")

class RevenueAnomaly(Base):
    """Revenue anomalies detected by Prophet or billing analysis.
    Revenue Officers review and validate these before any billing action is taken."""
    __tablename__ = "revenue_anomalies"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=True)
    anomaly_type = Column(String(50), nullable=False)
    # zero_usage_high_bill, sudden_drop, payment_gap, overbilling, underbilling
    description = Column(Text, nullable=False)
    amount_discrepancy = Column(Float, nullable=True)  # KES
    status = Column(String(20), default="pending")  # pending/validated/dismissed
    officer_notes = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="revenue_anomalies")
    bill = relationship("Bill", back_populates="revenue_anomalies")

class DataQualityFlag(Base):
    """Data quality issues raised by Data Stewards or auto-detection.
    Ensures only clean data feeds the Prophet forecasting models."""
    __tablename__ = "data_quality_flags"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    meter_no = Column(String(20), nullable=True)
    issue_type = Column(String(50), nullable=False)
    # zero_readings, sensor_error, missing_data, manual_entry_error, spike_anomaly
    description = Column(Text, nullable=False)
    affected_records = Column(Integer, default=0)
    status = Column(String(20), default="open")  # open/investigating/resolved
    steward_notes = Column(Text, nullable=True)
    raised_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    zone = relationship("Zone", back_populates="data_quality_flags")

class AuditLog(Base):
    """Immutable audit trail of all significant system actions.
    Required for WASREB and Office of the Auditor-General compliance."""
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    # e.g. run_forecast, update_ticket, validate_anomaly, flag_data, login, register
    resource_type = Column(String(50), nullable=True)   # LeakTicket, Forecast, User, etc.
    resource_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)               # JSON or human-readable summary
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
