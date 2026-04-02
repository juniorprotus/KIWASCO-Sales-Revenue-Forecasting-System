from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_active_user
from app.ml.prophet_model import forecast_zone

router = APIRouter(prefix="/api/forecasts", tags=["Forecasting"])

@router.post("/run")
def run_forecast(
    payload: schemas.ForecastRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Trigger a Prophet forecast for a zone."""
    zone = db.query(models.Zone).filter(models.Zone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    result = forecast_zone(db, payload.zone_id, payload.forecast_type, payload.periods)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    # Persist forecast rows to DB
    for fc in result.get("forecast", []):
        existing = (
            db.query(models.Forecast)
            .filter(
                models.Forecast.zone_id == payload.zone_id,
                models.Forecast.forecast_month == fc["forecast_month"],
            )
            .first()
        )
        kwargs = {
            "zone_id": payload.zone_id,
            "forecast_month": fc["forecast_month"],
            "lower_bound": fc["lower_bound"],
            "upper_bound": fc["upper_bound"],
            "model_used": "Prophet",
            "mae": result.get("mae"),
            "rmse": result.get("rmse"),
        }
        field_map = {
            "revenue": "predicted_revenue",
            "consumption": "predicted_consumption",
            "nrw": "predicted_nrw",
            "default_rate": "predicted_default_rate",
        }
        kwargs[field_map[payload.forecast_type]] = fc["predicted"]

        if existing:
            for k, v in kwargs.items():
                setattr(existing, k, v)
        else:
            db.add(models.Forecast(**kwargs))
    db.commit()

    return {
        "zone_id": payload.zone_id,
        "zone_name": zone.name,
        "metric": payload.forecast_type,
        "periods": payload.periods,
        "mae": result.get("mae"),
        "rmse": result.get("rmse"),
        "forecast": result.get("forecast", []),
        "historical": result.get("historical", []),
    }

@router.get("/zone/{zone_id}")
def get_zone_forecasts(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    forecasts = (
        db.query(models.Forecast)
        .filter(models.Forecast.zone_id == zone_id)
        .order_by(models.Forecast.forecast_month)
        .all()
    )
    return [schemas.ForecastOut.model_validate(f) for f in forecasts]

@router.get("/summary")
def forecast_summary(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    """Aggregated next-month forecast across all zones."""
    from datetime import date
    from dateutil.relativedelta import relativedelta
    next_month = (date.today() + relativedelta(months=1)).replace(day=1)
    forecasts = (
        db.query(models.Forecast)
        .filter(models.Forecast.forecast_month == next_month)
        .all()
    )
    total_revenue = sum(f.predicted_revenue or 0 for f in forecasts)
    total_consumption = sum(f.predicted_consumption or 0 for f in forecasts)
    avg_default = (
        sum(f.predicted_default_rate or 0 for f in forecasts) / len(forecasts)
        if forecasts else 0
    )
    return {
        "next_month": next_month.strftime("%Y-%m"),
        "zones_forecasted": len(forecasts),
        "total_predicted_revenue": round(total_revenue, 2),
        "total_predicted_consumption": round(total_consumption, 2),
        "avg_predicted_default_rate": round(avg_default, 2),
    }
