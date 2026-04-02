from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date
from app.database import get_db
from app import models
from app.auth import get_current_active_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    now = date.today()
    # Current month bills
    cur_bills = (
        db.query(models.Bill)
        .filter(
            extract("year", models.Bill.bill_date) == now.year,
            extract("month", models.Bill.bill_date) == now.month,
        )
        .all()
    )
    # Previous month for comparison
    prev_month = (now.month - 1) or 12
    prev_year = now.year if now.month > 1 else now.year - 1
    prev_bills = (
        db.query(models.Bill)
        .filter(
            extract("year", models.Bill.bill_date) == prev_year,
            extract("month", models.Bill.bill_date) == prev_month,
        )
        .all()
    )

    total_billed = sum(b.amount_billed for b in cur_bills)
    total_paid = sum(b.amount_paid for b in cur_bills)
    total_nrw = sum(b.nrw_loss for b in cur_bills)
    total_consumption = sum(b.units_consumed for b in cur_bills)
    prev_paid = sum(b.amount_paid for b in prev_bills)

    total_customers = db.query(models.Customer).count()
    active_customers = db.query(models.Customer).filter(models.Customer.is_active == True).count()
    total_zones = db.query(models.Zone).count()
    unpaid_bills = db.query(models.Bill).filter(models.Bill.status.in_(["unpaid", "partial"])).count()
    unread_alerts = db.query(models.Alert).filter(models.Alert.is_read == False).count()

    collection_rate = (total_paid / total_billed * 100) if total_billed > 0 else 0
    nrw_pct = (total_nrw / (total_consumption + total_nrw) * 100) if (total_consumption + total_nrw) > 0 else 0
    revenue_change = ((total_paid - prev_paid) / prev_paid * 100) if prev_paid > 0 else 0

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "total_revenue_this_month": round(total_paid, 2),
        "total_billed_this_month": round(total_billed, 2),
        "collection_rate": round(collection_rate, 1),
        "total_nrw_this_month": round(total_nrw, 2),
        "nrw_percentage": round(nrw_pct, 1),
        "total_zones": total_zones,
        "unpaid_bills": unpaid_bills,
        "alerts_count": unread_alerts,
        "revenue_change_pct": round(revenue_change, 1),
        "prev_month_revenue": round(prev_paid, 2),
    }

@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    alerts = (
        db.query(models.Alert)
        .order_by(models.Alert.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id, "message": a.message, "severity": a.severity,
            "threshold_type": a.threshold_type, "is_read": a.is_read,
            "zone_id": a.zone_id, "created_at": a.created_at,
        }
        for a in alerts
    ]

@router.patch("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"ok": True}

@router.get("/kpi-cards")
def kpi_cards(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    """7-zone KPI summary cards for the executive dashboard."""
    now = date.today()
    zones = db.query(models.Zone).all()
    cards = []
    for zone in zones:
        bills = (
            db.query(models.Bill)
            .join(models.Customer)
            .filter(
                models.Customer.zone_id == zone.id,
                extract("year", models.Bill.bill_date) == now.year,
                extract("month", models.Bill.bill_date) == now.month,
            )
            .all()
        )
        billed = sum(b.amount_billed for b in bills)
        collected = sum(b.amount_paid for b in bills)
        nrw = sum(b.nrw_loss for b in bills)
        customers = db.query(models.Customer).filter(models.Customer.zone_id == zone.id).count()
        cards.append({
            "zone_id": zone.id,
            "zone_name": zone.name,
            "customers": customers,
            "billed": round(billed, 2),
            "collected": round(collected, 2),
            "nrw": round(nrw, 2),
            "collection_rate": round((collected / billed * 100) if billed else 0, 1),
            "target": zone.target_monthly_revenue,
            "target_pct": round((collected / zone.target_monthly_revenue * 100) if zone.target_monthly_revenue else 0, 1),
        })
    return sorted(cards, key=lambda x: x["collected"], reverse=True)
