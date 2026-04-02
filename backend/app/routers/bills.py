from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from sqlalchemy import extract, func
from app.database import get_db
from app import models, schemas
from app.auth import get_current_active_user, require_admin

router = APIRouter(prefix="/api/bills", tags=["Bills"])

@router.get("/")
def list_bills(
    zone_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    q = db.query(models.Bill).join(models.Customer)
    if zone_id:
        q = q.filter(models.Customer.zone_id == zone_id)
    if customer_id:
        q = q.filter(models.Bill.customer_id == customer_id)
    if status:
        q = q.filter(models.Bill.status == status)
    if year:
        q = q.filter(extract("year", models.Bill.bill_date) == year)
    if month:
        q = q.filter(extract("month", models.Bill.bill_date) == month)
    total = q.count()
    bills = q.order_by(models.Bill.bill_date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "data": [schemas.BillOut.model_validate(b) for b in bills]}

@router.get("/monthly-trend")
def monthly_trend(
    zone_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Monthly aggregated revenue, consumption, NRW for chart."""
    q = (
        db.query(
            func.date_trunc("month", models.Bill.bill_date).label("month"),
            func.sum(models.Bill.amount_billed).label("billed"),
            func.sum(models.Bill.amount_paid).label("collected"),
            func.sum(models.Bill.units_consumed).label("consumption"),
            func.sum(models.Bill.nrw_loss).label("nrw"),
            func.count(models.Bill.id).label("bill_count"),
        )
        .join(models.Customer)
    )
    if zone_id:
        q = q.filter(models.Customer.zone_id == zone_id)
    rows = q.group_by(func.date_trunc("month", models.Bill.bill_date)).order_by("month").all()
    return [
        {
            "month": r.month.strftime("%Y-%m") if r.month else None,
            "billed": round(r.billed or 0, 2),
            "collected": round(r.collected or 0, 2),
            "collection_rate": round((r.collected / r.billed * 100) if r.billed else 0, 1),
            "consumption": round(r.consumption or 0, 2),
            "nrw": round(r.nrw or 0, 2),
            "bill_count": r.bill_count,
        }
        for r in rows
    ]

@router.get("/zone-comparison")
def zone_comparison(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Compare all zones for a given period."""
    now = date.today()
    yr = year or now.year
    mn = month or now.month
    zones = db.query(models.Zone).all()
    result = []
    for zone in zones:
        bills = (
            db.query(models.Bill)
            .join(models.Customer)
            .filter(
                models.Customer.zone_id == zone.id,
                extract("year", models.Bill.bill_date) == yr,
                extract("month", models.Bill.bill_date) == mn,
            )
            .all()
        )
        billed = sum(b.amount_billed for b in bills)
        collected = sum(b.amount_paid for b in bills)
        nrw = sum(b.nrw_loss for b in bills)
        result.append({
            "zone_id": zone.id,
            "zone_name": zone.name,
            "billed": round(billed, 2),
            "collected": round(collected, 2),
            "nrw": round(nrw, 2),
            "collection_rate": round((collected / billed * 100) if billed else 0, 1),
            "target": zone.target_monthly_revenue,
            "target_pct": round((collected / zone.target_monthly_revenue * 100) if zone.target_monthly_revenue else 0, 1),
            "bill_count": len(bills),
        })
    return sorted(result, key=lambda x: x["collected"], reverse=True)

@router.post("/", response_model=schemas.BillOut)
def create_bill(payload: schemas.BillCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    bill = models.Bill(**payload.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill

@router.patch("/{bill_id}/pay")
def record_payment(
    bill_id: int,
    amount: float,
    payment_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    bill.amount_paid = min(bill.amount_billed, bill.amount_paid + amount)
    bill.payment_date = payment_date or date.today()
    if bill.amount_paid >= bill.amount_billed:
        bill.status = "paid"
    elif bill.amount_paid > 0:
        bill.status = "partial"
    db.commit()
    return {"message": "Payment recorded", "bill_id": bill_id, "amount_paid": bill.amount_paid, "status": bill.status}
