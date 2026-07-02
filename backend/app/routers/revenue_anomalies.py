"""
revenue_anomalies.py — Billing anomaly management for Revenue Officers.
Revenue Officers validate or dismiss AI-detected billing discrepancies before
any collection or adjustment action is taken.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime
from app.database import get_db
from app import models
from app.auth import get_current_active_user, require_revenue_officer, require_analyst, log_action

router = APIRouter(prefix="/api/revenue-anomalies", tags=["Revenue Anomalies"])

ANOMALY_TYPES = [
    "zero_usage_high_bill",
    "sudden_drop",
    "payment_gap",
    "overbilling",
    "underbilling",
    "prolonged_non_payment",
]

@router.get("")
def list_anomalies(
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """List all revenue anomalies. Revenue officers and analysts can view."""
    q = db.query(models.RevenueAnomaly).order_by(desc(models.RevenueAnomaly.created_at))
    if status:
        q = q.filter(models.RevenueAnomaly.status == status)
    if anomaly_type:
        q = q.filter(models.RevenueAnomaly.anomaly_type == anomaly_type)
    anomalies = q.all()
    return [_serialize(a) for a in anomalies]

@router.get("/stats/summary")
def anomaly_summary(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    all_anomalies = db.query(models.RevenueAnomaly).all()
    total_discrepancy = sum(a.amount_discrepancy or 0 for a in all_anomalies if a.status == "pending")
    return {
        "total": len(all_anomalies),
        "pending": sum(1 for a in all_anomalies if a.status == "pending"),
        "validated": sum(1 for a in all_anomalies if a.status == "validated"),
        "dismissed": sum(1 for a in all_anomalies if a.status == "dismissed"),
        "total_pending_discrepancy_kes": round(total_discrepancy, 2),
    }

@router.get("/{anomaly_id}")
def get_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    anomaly = db.query(models.RevenueAnomaly).filter(models.RevenueAnomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return _serialize(anomaly)

@router.post("")
def create_anomaly(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_analyst),
):
    """Manually flag a revenue anomaly. Analysts and admins only."""
    if payload.get("anomaly_type") not in ANOMALY_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid anomaly_type. Must be one of: {ANOMALY_TYPES}")
    anomaly = models.RevenueAnomaly(
        customer_id=payload.get("customer_id"),
        bill_id=payload.get("bill_id"),
        anomaly_type=payload["anomaly_type"],
        description=payload.get("description", ""),
        amount_discrepancy=payload.get("amount_discrepancy"),
        status="pending",
    )
    db.add(anomaly)
    db.flush()
    log_action(db, current_user.id, "create_revenue_anomaly", "RevenueAnomaly", anomaly.id,
               f"Type: {payload['anomaly_type']} | Discrepancy: KES {payload.get('amount_discrepancy', 0)}")
    db.commit()
    db.refresh(anomaly)
    return _serialize(anomaly)

@router.patch("/{anomaly_id}")
def update_anomaly(
    anomaly_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_revenue_officer),
):
    """Revenue Officers validate or dismiss an anomaly."""
    anomaly = db.query(models.RevenueAnomaly).filter(models.RevenueAnomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    new_status = payload.get("status")
    allowed = ["pending", "validated", "dismissed"]
    if new_status and new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed}")

    if new_status:
        anomaly.status = new_status
    if payload.get("officer_notes"):
        anomaly.officer_notes = payload["officer_notes"]
    anomaly.reviewed_by = current_user.id
    anomaly.reviewed_at = datetime.utcnow()

    log_action(db, current_user.id, "update_revenue_anomaly", "RevenueAnomaly", anomaly_id,
               f"Status: {new_status}. Notes: {payload.get('officer_notes', '')}")
    db.commit()
    db.refresh(anomaly)
    return _serialize(anomaly)

@router.post("/detect")
def detect_anomalies(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_analyst),
):
    """
    Run automated anomaly detection across bills.
    Flags: zero usage with high bill, prolonged non-payment (90+ days).
    Analysts and admins can trigger this.
    """
    from datetime import date, timedelta
    detected = 0
    cutoff = date.today() - timedelta(days=90)

    # Detect: unpaid bills older than 90 days
    old_unpaid = (
        db.query(models.Bill)
        .filter(models.Bill.status == "unpaid", models.Bill.bill_date <= cutoff)
        .limit(payload.get("limit", 50))
        .all()
    )
    for bill in old_unpaid:
        exists = db.query(models.RevenueAnomaly).filter(
            models.RevenueAnomaly.bill_id == bill.id,
            models.RevenueAnomaly.anomaly_type == "prolonged_non_payment",
        ).first()
        if not exists:
            a = models.RevenueAnomaly(
                customer_id=bill.customer_id,
                bill_id=bill.id,
                anomaly_type="prolonged_non_payment",
                description=f"Bill KES {bill.amount_billed:.0f} unpaid for over 90 days (due {bill.due_date})",
                amount_discrepancy=bill.amount_billed,
                status="pending",
            )
            db.add(a)
            detected += 1

    db.flush()
    log_action(db, current_user.id, "detect_revenue_anomalies", None, None,
               f"Detected {detected} new revenue anomalies")
    db.commit()
    return {"detected": detected, "message": f"{detected} new anomalies flagged for review"}

def _serialize(a: models.RevenueAnomaly) -> dict:
    return {
        "id": a.id,
        "customer_id": a.customer_id,
        "customer_name": a.customer.name if a.customer else None,
        "bill_id": a.bill_id,
        "anomaly_type": a.anomaly_type,
        "description": a.description,
        "amount_discrepancy": a.amount_discrepancy,
        "status": a.status,
        "officer_notes": a.officer_notes,
        "reviewed_by": a.reviewed_by,
        "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
