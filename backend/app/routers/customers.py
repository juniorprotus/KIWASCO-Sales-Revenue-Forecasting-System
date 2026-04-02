from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_active_user, require_admin

router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.get("/", response_model=List[schemas.CustomerOut])
def list_customers(
    zone_id: Optional[int] = None,
    customer_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    q = db.query(models.Customer)
    if zone_id:
        q = q.filter(models.Customer.zone_id == zone_id)
    if customer_type:
        q = q.filter(models.Customer.customer_type == customer_type)
    if is_active is not None:
        q = q.filter(models.Customer.is_active == is_active)
    return q.offset(skip).limit(limit).all()

@router.get("/count")
def count_customers(zone_id: Optional[int] = None, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    q = db.query(models.Customer)
    if zone_id:
        q = q.filter(models.Customer.zone_id == zone_id)
    return {"total": q.count(), "active": q.filter(models.Customer.is_active == True).count()}

@router.get("/defaulters")
def get_defaulters(
    zone_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Customers with highest unpaid amounts."""
    from sqlalchemy import func
    q = (
        db.query(
            models.Customer.id,
            models.Customer.account_no,
            models.Customer.name,
            models.Customer.customer_type,
            models.Customer.zone_id,
            func.sum(models.Bill.amount_billed - models.Bill.amount_paid).label("outstanding"),
            func.count(models.Bill.id).label("unpaid_count"),
        )
        .join(models.Bill)
        .filter(models.Bill.status.in_(["unpaid", "partial"]))
    )
    if zone_id:
        q = q.filter(models.Customer.zone_id == zone_id)
    results = q.group_by(models.Customer.id).order_by(func.sum(models.Bill.amount_billed - models.Bill.amount_paid).desc()).limit(limit).all()
    return [
        {
            "id": r.id, "account_no": r.account_no, "name": r.name,
            "customer_type": r.customer_type, "zone_id": r.zone_id,
            "outstanding": round(r.outstanding, 2), "unpaid_bills": r.unpaid_count,
        }
        for r in results
    ]

@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    c = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@router.post("/", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer
