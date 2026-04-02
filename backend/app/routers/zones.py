from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_active_user, require_admin

router = APIRouter(prefix="/api/zones", tags=["Zones"])

@router.get("/", response_model=List[schemas.ZoneOut])
def list_zones(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    return db.query(models.Zone).order_by(models.Zone.name).all()

@router.get("/{zone_id}", response_model=schemas.ZoneOut)
def get_zone(zone_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    zone = db.query(models.Zone).filter(models.Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone

@router.post("/", response_model=schemas.ZoneOut)
def create_zone(payload: schemas.ZoneCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    zone = models.Zone(**payload.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone

@router.put("/{zone_id}", response_model=schemas.ZoneOut)
def update_zone(zone_id: int, payload: schemas.ZoneCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    zone = db.query(models.Zone).filter(models.Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    for k, v in payload.model_dump().items():
        setattr(zone, k, v)
    db.commit()
    db.refresh(zone)
    return zone

@router.get("/{zone_id}/stats")
def zone_stats(zone_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    from datetime import date
    from sqlalchemy import func, extract
    zone = db.query(models.Zone).filter(models.Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    now = date.today()
    current_month_bills = (
        db.query(models.Bill)
        .join(models.Customer)
        .filter(
            models.Customer.zone_id == zone_id,
            extract("year", models.Bill.bill_date) == now.year,
            extract("month", models.Bill.bill_date) == now.month,
        )
        .all()
    )

    total_billed = sum(b.amount_billed for b in current_month_bills)
    total_paid = sum(b.amount_paid for b in current_month_bills)
    total_nrw = sum(b.nrw_loss for b in current_month_bills)
    total_consumption = sum(b.units_consumed for b in current_month_bills)
    unpaid = len([b for b in current_month_bills if b.status in ["unpaid", "partial"]])

    return {
        "zone": {"id": zone.id, "name": zone.name, "population": zone.population},
        "current_month": {
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "collection_rate": round((total_paid / total_billed * 100) if total_billed else 0, 1),
            "total_nrw": round(total_nrw, 2),
            "nrw_pct": round((total_nrw / (total_consumption + total_nrw) * 100) if total_consumption else 0, 1),
            "unpaid_bills": unpaid,
            "total_bills": len(current_month_bills),
        },
        "target_revenue": zone.target_monthly_revenue,
        "target_achievement_pct": round((total_paid / zone.target_monthly_revenue * 100) if zone.target_monthly_revenue else 0, 1),
    }
