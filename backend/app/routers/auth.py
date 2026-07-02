from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app import models, schemas
from app.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_active_user, require_admin, log_action
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Valid roles the system accepts
VALID_ROLES = [
    "admin", "superadmin", "analyst", "data_steward",
    "revenue_officer", "field_officer", "viewer", "auditor"
]

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account deactivated")
    user.last_login = datetime.utcnow()
    log_action(db, user.id, "login", "User", user.id, f"User {user.username} logged in")
    db.commit()
    token = create_access_token({"sub": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "full_name": user.full_name,
        },
    }

@router.post("/register", response_model=schemas.UserOut)
def register(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),  # admin-only
):
    """Register a new user. Admin access required."""
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    role = payload.role or "viewer"
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
    user = models.User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=role,
    )
    db.add(user)
    db.flush()
    log_action(db, current_admin.id, "register_user", "User", user.id,
               f"Admin {current_admin.username} created user {payload.username} with role {role}")
    db.commit()
    db.refresh(user)
    return user

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_active_user)):
    return current_user

@router.get("/roles")
def list_roles(_=Depends(require_admin)):
    """List all available system roles with descriptions."""
    return [
        {"role": "admin", "description": "Full system access — user management, system config, security"},
        {"role": "data_steward", "description": "Validates input data quality, flags sensor and meter errors"},
        {"role": "analyst", "description": "Runs Prophet models, tunes parameters, generates reports"},
        {"role": "revenue_officer", "description": "Validates revenue anomalies, manages billing exceptions"},
        {"role": "field_officer", "description": "Receives NRW leak alerts, updates ticket status in the field"},
        {"role": "viewer", "description": "Read-only access to dashboards and reports"},
        {"role": "auditor", "description": "Read-only access for WASREB / Auditor-General regulatory compliance"},
    ]
