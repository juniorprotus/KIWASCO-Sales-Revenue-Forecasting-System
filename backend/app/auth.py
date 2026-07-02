from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.config import settings
import bcrypt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Password helpers ──────────────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

# ── Base user dependencies ────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# ── Role permission factory ───────────────────────────────────────────────────

def require_roles(allowed_roles: List[str]):
    """
    Factory that returns a FastAPI dependency enforcing role access.
    Usage: _=Depends(require_roles(["admin", "analyst"]))
    """
    def role_guard(current_user: models.User = Depends(get_current_active_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_guard

# ── Role shortcut dependencies ────────────────────────────────────────────────

# System administrators
def require_admin(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Analysts and data stewards can run and view models
def require_analyst(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "superadmin", "analyst", "data_steward"]:
        raise HTTPException(status_code=403, detail="Analyst access required")
    return current_user

# Revenue officers validate billing anomalies
def require_revenue_officer(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "superadmin", "revenue_officer", "analyst"]:
        raise HTTPException(status_code=403, detail="Revenue Officer access required")
    return current_user

# Field officers action NRW tickets on the ground
def require_field_officer(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "superadmin", "field_officer", "analyst"]:
        raise HTTPException(status_code=403, detail="Field Officer access required")
    return current_user

# Data stewards manage input data quality
def require_data_steward(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "superadmin", "data_steward", "analyst"]:
        raise HTTPException(status_code=403, detail="Data Steward access required")
    return current_user

# Auditors get read-only regulatory access
def require_auditor(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "superadmin", "auditor", "analyst"]:
        raise HTTPException(status_code=403, detail="Auditor access required")
    return current_user

# ── Audit log helper ──────────────────────────────────────────────────────────

def log_action(
    db: Session,
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[str] = None,
):
    """Write an immutable audit log entry."""
    entry = models.AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )
    db.add(entry)
    # Do not commit here — caller controls transaction
