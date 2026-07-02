"""
tickets.py — NRW Leak Ticket management for Field Operations Officers.
When Prophet detects a predicted NRW spike, a ticket is auto-created here.
Field Officers receive, confirm, and resolve these tickets on the ground.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime
from app.database import get_db
from app import models
from app.auth import get_current_active_user, require_field_officer, require_analyst, log_action

router = APIRouter(prefix="/api/tickets", tags=["Leak Tickets"])

@router.get("/leaks")
def list_leak_tickets(
    status: Optional[str] = None,
    zone_id: Optional[int] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """List NRW leak tickets. Field officers see all open tickets."""
    q = db.query(models.LeakTicket).order_by(desc(models.LeakTicket.created_at))
    if status:
        q = q.filter(models.LeakTicket.status == status)
    if zone_id:
        q = q.filter(models.LeakTicket.zone_id == zone_id)
    if priority:
        q = q.filter(models.LeakTicket.priority == priority)
    tickets = q.all()
    return [_serialize_ticket(t) for t in tickets]

@router.get("/leaks/{ticket_id}")
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    ticket = db.query(models.LeakTicket).filter(models.LeakTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _serialize_ticket(ticket)

@router.post("/leaks")
def create_ticket(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_analyst),
):
    """Manually create a leak ticket. Analysts and admins only."""
    zone = db.query(models.Zone).filter(models.Zone.id == payload.get("zone_id")).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    ticket = models.LeakTicket(
        zone_id=payload["zone_id"],
        title=payload.get("title", f"NRW Alert - {zone.name}"),
        description=payload.get("description", ""),
        predicted_nrw=payload.get("predicted_nrw"),
        nrw_threshold_pct=payload.get("nrw_threshold_pct"),
        priority=payload.get("priority", "medium"),
        status="open",
    )
    db.add(ticket)
    db.flush()
    log_action(db, current_user.id, "create_leak_ticket", "LeakTicket", ticket.id,
               f"Created ticket for zone {zone.name}")
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket)

@router.patch("/leaks/{ticket_id}")
def update_ticket(
    ticket_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_field_officer),
):
    """
    Field Officers update ticket status after ground inspection.
    Allowed transitions: open -> confirmed, open -> false_positive, confirmed -> resolved
    """
    ticket = db.query(models.LeakTicket).filter(models.LeakTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    allowed_status = ["open", "confirmed", "false_positive", "resolved"]
    new_status = payload.get("status")
    if new_status and new_status not in allowed_status:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_status}")

    if new_status:
        ticket.status = new_status
    if payload.get("field_notes"):
        ticket.field_notes = payload["field_notes"]
    if payload.get("priority"):
        ticket.priority = payload["priority"]
    if payload.get("assigned_to"):
        ticket.assigned_to = payload["assigned_to"]
    if new_status == "resolved":
        ticket.resolved_at = datetime.utcnow()

    log_action(db, current_user.id, "update_leak_ticket", "LeakTicket", ticket.id,
               f"Status changed to {new_status}. Notes: {payload.get('field_notes', '')}")
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket)

@router.get("/leaks/stats/summary")
def ticket_summary(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Summary counts for dashboard KPI cards."""
    all_tickets = db.query(models.LeakTicket).all()
    return {
        "total": len(all_tickets),
        "open": sum(1 for t in all_tickets if t.status == "open"),
        "confirmed": sum(1 for t in all_tickets if t.status == "confirmed"),
        "false_positive": sum(1 for t in all_tickets if t.status == "false_positive"),
        "resolved": sum(1 for t in all_tickets if t.status == "resolved"),
        "critical": sum(1 for t in all_tickets if t.priority == "critical"),
        "high": sum(1 for t in all_tickets if t.priority == "high"),
    }

def _serialize_ticket(t: models.LeakTicket) -> dict:
    return {
        "id": t.id,
        "zone_id": t.zone_id,
        "zone_name": t.zone.name if t.zone else None,
        "assigned_to": t.assigned_to,
        "title": t.title,
        "description": t.description,
        "predicted_nrw": t.predicted_nrw,
        "nrw_threshold_pct": t.nrw_threshold_pct,
        "status": t.status,
        "priority": t.priority,
        "field_notes": t.field_notes,
        "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
