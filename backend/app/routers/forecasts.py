from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_active_user, require_analyst, log_action
from app.ml.prophet_model import forecast_zone

router = APIRouter(prefix="/api/forecasts", tags=["Forecasting"])

@router.post("/run")
def run_forecast(
    payload: schemas.ForecastRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_analyst),  # analyst, data_steward, admin only
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
    log_action(db, current_user.id, "run_forecast", "Forecast", zone.id,
               f"Prophet forecast: {payload.forecast_type} | zone {zone.name} | {payload.periods} periods")

    # Auto-create a LeakTicket if NRW prediction spikes > 20% above zone historical average
    if payload.forecast_type == "nrw" and result.get("forecast"):
        from app.models import LeakTicket
        import numpy as np
        predicted_values = [fc["predicted"] for fc in result["forecast"]]
        historical_values = [h["actual"] for h in result.get("historical", []) if h["actual"] is not None]
        if historical_values and predicted_values:
            hist_avg = float(np.mean(historical_values))
            max_predicted = max(predicted_values)
            if hist_avg > 0:
                pct_above = ((max_predicted - hist_avg) / hist_avg) * 100
                if pct_above > 20:
                    ticket = LeakTicket(
                        zone_id=zone.id,
                        title=f"AI NRW Alert: {zone.name} — {pct_above:.0f}% above baseline",
                        description=(
                            f"Prophet model predicted NRW of {max_predicted:.1f} m3 in the next "
                            f"{payload.periods} months, which is {pct_above:.1f}% above the "
                            f"historical average of {hist_avg:.1f} m3. Immediate field inspection recommended."
                        ),
                        predicted_nrw=max_predicted,
                        nrw_threshold_pct=round(pct_above, 1),
                        priority="critical" if pct_above > 50 else "high",
                        status="open",
                    )
                    db.add(ticket)
                    log_action(db, current_user.id, "auto_create_leak_ticket", "LeakTicket", None,
                               f"NRW spike {pct_above:.1f}% above baseline for {zone.name}")

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
