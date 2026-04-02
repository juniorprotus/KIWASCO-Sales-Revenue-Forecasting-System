from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

# ── Enums ──────────────────────────────────────────────────────────────────
class CustomerTypeEnum(str, Enum):
    domestic = "domestic"
    commercial = "commercial"
    industrial = "industrial"
    institutional = "institutional"

class BillStatusEnum(str, Enum):
    paid = "paid"
    unpaid = "unpaid"
    partial = "partial"
    waived = "waived"

# ── Zone ────────────────────────────────────────────────────────────────────
class ZoneBase(BaseModel):
    name: str
    population: Optional[int] = 0
    area_sqkm: Optional[float] = 0.0
    target_monthly_revenue: Optional[float] = 0.0

class ZoneCreate(ZoneBase):
    pass

class ZoneOut(ZoneBase):
    id: int
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

# ── Customer ─────────────────────────────────────────────────────────────────
class CustomerBase(BaseModel):
    zone_id: int
    account_no: str
    name: str
    customer_type: Optional[CustomerTypeEnum] = CustomerTypeEnum.domestic
    meter_no: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    connection_date: Optional[date] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerOut(CustomerBase):
    id: int
    is_active: bool
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

# ── Bill ──────────────────────────────────────────────────────────────────────
class BillBase(BaseModel):
    customer_id: int
    units_consumed: float
    amount_billed: float
    amount_paid: Optional[float] = 0.0
    bill_date: date
    due_date: Optional[date] = None
    payment_date: Optional[date] = None
    status: Optional[BillStatusEnum] = BillStatusEnum.unpaid
    nrw_loss: Optional[float] = 0.0

class BillCreate(BillBase):
    pass

class BillOut(BillBase):
    id: int
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

# ── Forecast ─────────────────────────────────────────────────────────────────
class ForecastOut(BaseModel):
    id: int
    zone_id: int
    forecast_month: date
    predicted_consumption: Optional[float]
    predicted_revenue: Optional[float]
    predicted_default_rate: Optional[float]
    predicted_nrw: Optional[float]
    lower_bound: Optional[float]
    upper_bound: Optional[float]
    model_used: Optional[str]
    mae: Optional[float]
    rmse: Optional[float]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

class ForecastRequest(BaseModel):
    zone_id: int
    periods: Optional[int] = 6  # months ahead
    forecast_type: Optional[str] = "revenue"  # revenue | consumption | nrw | default_rate

# ── Alert ─────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: int
    zone_id: Optional[int]
    message: str
    threshold_type: Optional[str]
    severity: Optional[str]
    is_read: bool
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

# ── Auth ──────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: Optional[str] = "viewer"

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

# ── Dashboard Summary ─────────────────────────────────────────────────────────
class DashboardSummary(BaseModel):
    total_customers: int
    active_customers: int
    total_revenue_this_month: float
    total_billed_this_month: float
    collection_rate: float
    total_nrw_this_month: float
    nrw_percentage: float
    total_zones: int
    unpaid_bills: int
    alerts_count: int
