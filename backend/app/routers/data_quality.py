"""
data_quality.py — Data quality flag management for Data Stewards.
Data Stewards flag dirty meter/sensor data to prevent bad data
from feeding the Prophet forecasting models (garbage in, garbage out).
Also hosts the Audit Log endpoint for Auditors and Admins.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime
from app.database import get_db
from app import models
from app.auth import get_current_active_user, require_data_steward, require_auditor, log_action

router = APIRouter(prefix="/api/data-quality", tags=["Data Quality"])

ISSUE_TYPES = [
    "zero_readings",
    "sensor_error",
    "missing_data",
    "manual_entry_error",
    "spike_anomaly",
    "meter_tampering",
]

# ── Data Quality Flags ────────────────────────────────────────────────────────

@router.get("/flags")
def list_flags(
    status: Optional[str] = None,
    zone_id: Optional[int] = None,
    issue_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """List data quality flags. Visible to all authenticated users."""
    q = db.query(models.DataQualityFlag).order_by(desc(models.DataQualityFlag.created_at))
    if status:
        q = q.filter(models.DataQualityFlag.status == status)
    if zone_id:
        q = q.filter(models.DataQualityFlag.zone_id == zone_id)
    if issue_type:
        q = q.filter(models.DataQualityFlag.issue_type == issue_type)
    flags = q.all()
    return [_serialize_flag(f) for f in flags]

@router.get("/flags/stats/summary")
def flag_summary(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    all_flags = db.query(models.DataQualityFlag).all()
    return {
        "total": len(all_flags),
        "open": sum(1 for f in all_flags if f.status == "open"),
        "investigating": sum(1 for f in all_flags if f.status == "investigating"),
        "resolved": sum(1 for f in all_flags if f.status == "resolved"),
        "total_affected_records": sum(f.affected_records or 0 for f in all_flags if f.status != "resolved"),
    }

@router.get("/flags/{flag_id}")
def get_flag(
    flag_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    flag = db.query(models.DataQualityFlag).filter(models.DataQualityFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    return _serialize_flag(flag)

@router.post("/flags")
def create_flag(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_data_steward),
):
    """Data stewards raise a new data quality flag."""
    if payload.get("issue_type") not in ISSUE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid issue_type. Must be one of: {ISSUE_TYPES}")
    flag = models.DataQualityFlag(
        zone_id=payload.get("zone_id"),
        meter_no=payload.get("meter_no"),
        issue_type=payload["issue_type"],
        description=payload.get("description", ""),
        affected_records=payload.get("affected_records", 0),
        status="open",
        raised_by=current_user.id,
    )
    db.add(flag)
    db.flush()
    log_action(db, current_user.id, "create_data_quality_flag", "DataQualityFlag", flag.id,
               f"Issue: {payload['issue_type']} | Meter: {payload.get('meter_no', 'N/A')}")
    db.commit()
    db.refresh(flag)
    return _serialize_flag(flag)

@router.patch("/flags/{flag_id}")
def update_flag(
    flag_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_data_steward),
):
    """Data stewards update or resolve a data quality flag."""
    flag = db.query(models.DataQualityFlag).filter(models.DataQualityFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    allowed_status = ["open", "investigating", "resolved"]
    new_status = payload.get("status")
    if new_status and new_status not in allowed_status:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_status}")

    if new_status:
        flag.status = new_status
    if payload.get("steward_notes"):
        flag.steward_notes = payload["steward_notes"]
    if new_status == "resolved":
        flag.resolved_by = current_user.id
        flag.resolved_at = datetime.utcnow()

    log_action(db, current_user.id, "update_data_quality_flag", "DataQualityFlag", flag_id,
               f"Status: {new_status}. Notes: {payload.get('steward_notes', '')}")
    db.commit()
    db.refresh(flag)
    return _serialize_flag(flag)

# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit")
def get_audit_log(
    limit: int = 100,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(require_auditor),
):
    """
    Immutable audit trail for WASREB / Auditor-General compliance.
    Auditors and Admins only.
    """
    q = db.query(models.AuditLog).order_by(desc(models.AuditLog.created_at)).limit(limit)
    if action:
        q = q.filter(models.AuditLog.action == action)
    if resource_type:
        q = q.filter(models.AuditLog.resource_type == resource_type)
    logs = q.all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": log.user.username if log.user else "system",
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]

def _serialize_flag(f: models.DataQualityFlag) -> dict:
    return {
        "id": f.id,
        "zone_id": f.zone_id,
        "zone_name": f.zone.name if f.zone else None,
        "meter_no": f.meter_no,
        "issue_type": f.issue_type,
        "description": f.description,
        "affected_records": f.affected_records,
        "status": f.status,
        "steward_notes": f.steward_notes,
        "raised_by": f.raised_by,
        "resolved_by": f.resolved_by,
        "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
