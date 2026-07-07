from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas
from app.auth import get_current_active_user

router = APIRouter(prefix="/api/meter-readings", tags=["Meter Readings"])

@router.get("/", response_model=List[schemas.MeterReadingOut])
def list_readings(
    customer_id: Optional[int] = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get recent meter readings, optionally filtered by customer."""
    q = db.query(models.MeterReading)
    if customer_id:
        q = q.filter(models.MeterReading.customer_id == customer_id)
    return q.order_by(desc(models.MeterReading.reading_date)).limit(limit).all()

@router.post("/", response_model=schemas.MeterReadingOut)
def record_reading(
    payload: schemas.MeterReadingCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Field Officers use this to submit a new meter reading."""
    # Find previous reading for this customer to calculate consumption
    last_reading = db.query(models.MeterReading)\
        .filter(models.MeterReading.customer_id == payload.customer_id)\
        .order_by(desc(models.MeterReading.reading_date))\
        .first()

    previous = payload.previous_reading
    if last_reading and previous is None:
        previous = last_reading.current_reading
    
    units = payload.units_consumed
    if units is None and previous is not None:
        units = max(0.0, payload.current_reading - previous)
    
    reading = models.MeterReading(
        customer_id=payload.customer_id,
        reading_date=payload.reading_date,
        current_reading=payload.current_reading,
        previous_reading=previous,
        units_consumed=units,
        recorded_by_id=current_user.id
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading
