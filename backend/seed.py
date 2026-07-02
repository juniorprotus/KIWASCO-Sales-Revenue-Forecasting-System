"""
seed.py — Populate KIWASCO database with synthetic billing data.
Run: python seed.py

Generates:
  - 7 zones
  - ~1,050 customers
  - ~36 months of billing history (Jan 2022 - Dec 2024)
  - 7 demo users (all roles)
  - System alerts
  - Sample NRW leak tickets
  - Sample revenue anomalies
  - Sample data quality flags
  - Audit log entries
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models
from app.database import Base
from app.auth import get_password_hash
from app.ml.data_generator import (
    ZONES, generate_customers, generate_bills,
    get_zone_customer_count,
)

Base.metadata.create_all(bind=engine)

START_DATE = date(2022, 1, 1)
END_DATE   = date(2025, 1, 1)  # exclusive

def months_between(start: date, end: date) -> int:
    delta = relativedelta(end, start)
    return delta.years * 12 + delta.months

def seed():
    db: Session = SessionLocal()
    try:
        # ── Guard: skip if already seeded ─────────────────────────────────
        if db.query(models.Zone).count() > 0:
            print("Database already seeded - skipping.")
            return

        print("Seeding KIWASCO database...")

        # ── Zones ─────────────────────────────────────────────────────────
        zone_objs = []
        for zd in ZONES:
            z = models.Zone(**zd)
            db.add(z)
            zone_objs.append(z)
        db.flush()
        print(f"  {len(zone_objs)} zones created")

        # ── Users ─────────────────────────────────────────────────────────
        users = [
            models.User(
                username="admin", email="admin@kiwasco.go.ke",
                full_name="KIWASCO System Administrator",
                hashed_password=get_password_hash("admin1234"),
                role="admin", is_active=True,
            ),
            models.User(
                username="analyst", email="analyst@kiwasco.go.ke",
                full_name="Revenue Analyst",
                hashed_password=get_password_hash("analyst1234"),
                role="analyst", is_active=True,
            ),
            models.User(
                username="steward", email="steward@kiwasco.go.ke",
                full_name="Data Quality Steward",
                hashed_password=get_password_hash("steward1234"),
                role="data_steward", is_active=True,
            ),
            models.User(
                username="revenue", email="revenue@kiwasco.go.ke",
                full_name="Revenue Officer",
                hashed_password=get_password_hash("revenue1234"),
                role="revenue_officer", is_active=True,
            ),
            models.User(
                username="field", email="field@kiwasco.go.ke",
                full_name="Field Operations Officer",
                hashed_password=get_password_hash("field1234"),
                role="field_officer", is_active=True,
            ),
            models.User(
                username="viewer", email="viewer@kiwasco.go.ke",
                full_name="Management Viewer",
                hashed_password=get_password_hash("viewer1234"),
                role="viewer", is_active=True,
            ),
            models.User(
                username="auditor", email="auditor@wasreb.go.ke",
                full_name="WASREB External Auditor",
                hashed_password=get_password_hash("auditor1234"),
                role="auditor", is_active=True,
            ),
        ]
        for u in users:
            db.add(u)
        db.flush()
        print(f"  {len(users)} users created")

        # ── Customers + Bills ─────────────────────────────────────────────
        months = months_between(START_DATE, END_DATE)
        total_bills = 0
        total_customers = 0

        for zone in zone_objs:
            count = get_zone_customer_count(zone.name, zone.population)
            # Cap for performance during seeding
            count = min(count, 150)
            customer_dicts = generate_customers(zone.id, zone.name, count)

            for cd in customer_dicts:
                conn_date = cd.pop("connection_date", START_DATE)
                c = models.Customer(**cd, connection_date=conn_date)
                db.add(c)
                db.flush()

                bill_dicts = generate_bills(
                    c.id, zone.name, getattr(c.customer_type, 'value', c.customer_type),
                    start_month=START_DATE, months=months,
                )
                for bd in bill_dicts:
                    db.add(models.Bill(**bd))
                total_bills += len(bill_dicts)
            total_customers += count
            print(f"    -> {zone.name}: {count} customers, {count * months} bills")

        print(f"  {total_customers} customers, {total_bills} bills created")

        # ── Alerts ────────────────────────────────────────────────────────
        alerts_data = [
            {"zone_id": None, "message": "System initialized with synthetic KIWASCO billing data.",
             "threshold_type": "info", "severity": "info"},
            {"zone_id": zone_objs[3].id, "message": f"{zone_objs[3].name}: NRW rate exceeds 35% threshold. Pipe inspection recommended.",
             "threshold_type": "high_nrw", "severity": "critical"},
            {"zone_id": zone_objs[1].id, "message": f"{zone_objs[1].name}: Default rate above 20% for 3 consecutive months.",
             "threshold_type": "defaulter_surge", "severity": "warning"},
            {"zone_id": zone_objs[4].id, "message": f"{zone_objs[4].name}: Revenue collection below 70% of monthly target.",
             "threshold_type": "revenue_drop", "severity": "warning"},
            {"zone_id": zone_objs[0].id, "message": f"{zone_objs[0].name}: Demand projected to exceed supply capacity by Q3 2025.",
             "threshold_type": "capacity_risk", "severity": "critical"},
        ]
        for ad in alerts_data:
            db.add(models.Alert(**ad))

        # ── NRW Leak Tickets (for Field Officers) ─────────────────────────
        leak_tickets = [
            models.LeakTicket(
                zone_id=zone_objs[3].id,
                title=f"AI NRW Alert: {zone_objs[3].name} - 42% above baseline",
                description=(
                    f"Prophet model predicted NRW of 8,450 m3 in the next 3 months for "
                    f"{zone_objs[3].name}, which is 42% above the historical average. "
                    "Suspected pipe burst near Kondele market. Immediate inspection required."
                ),
                predicted_nrw=8450.0,
                nrw_threshold_pct=42.0,
                priority="critical",
                status="open",
            ),
            models.LeakTicket(
                zone_id=zone_objs[1].id,
                title=f"AI NRW Alert: {zone_objs[1].name} - 28% above baseline",
                description=(
                    f"Elevated NRW detected in {zone_objs[1].name}. "
                    "Possible illegal connection or aging pipe infrastructure."
                ),
                predicted_nrw=3200.0,
                nrw_threshold_pct=28.0,
                priority="high",
                status="confirmed",
                field_notes="Field team confirmed a burst main pipe near the estate junction. Repair crew dispatched.",
            ),
            models.LeakTicket(
                zone_id=zone_objs[5].id,
                title=f"Routine NRW Check: {zone_objs[5].name}",
                description="Monthly NRW review ticket. Values within acceptable range but trending upward.",
                predicted_nrw=1800.0,
                nrw_threshold_pct=21.5,
                priority="medium",
                status="resolved",
                field_notes="Inspection complete. Minor valve leakage found and repaired.",
            ),
        ]
        for t in leak_tickets:
            db.add(t)
        db.flush()
        print(f"  {len(leak_tickets)} leak tickets created")

        # ── Revenue Anomalies (for Revenue Officers) ───────────────────────
        revenue_anomalies = [
            models.RevenueAnomaly(
                anomaly_type="prolonged_non_payment",
                description="Customer account has not paid for over 90 days. Amount outstanding: KES 12,450.",
                amount_discrepancy=12450.0,
                status="pending",
            ),
            models.RevenueAnomaly(
                anomaly_type="sudden_drop",
                description="Zone revenue dropped 35% in October 2024 vs same period last year. No corresponding reduction in consumption.",
                amount_discrepancy=450000.0,
                status="pending",
            ),
            models.RevenueAnomaly(
                anomaly_type="zero_usage_high_bill",
                description="Customer recorded zero consumption for 3 months but was billed the minimum charge. Possible meter fault.",
                amount_discrepancy=3600.0,
                status="validated",
                officer_notes="Confirmed meter fault. Meter replaced on 15 Jan 2025. Bill adjustment issued.",
            ),
        ]
        for a in revenue_anomalies:
            db.add(a)
        db.flush()
        print(f"  {len(revenue_anomalies)} revenue anomalies created")

        # ── Data Quality Flags (for Data Stewards) ─────────────────────────
        data_quality_flags = [
            models.DataQualityFlag(
                zone_id=zone_objs[2].id,
                meter_no="MTR-0245",
                issue_type="zero_readings",
                description="Meter MTR-0245 has reported zero consumption for 14 consecutive days. Possible sensor disconnection or tampering.",
                affected_records=14,
                status="investigating",
                steward_notes="Field team notified. Physical inspection scheduled for 5 July 2025.",
            ),
            models.DataQualityFlag(
                zone_id=zone_objs[0].id,
                meter_no="MTR-0089",
                issue_type="spike_anomaly",
                description="Meter MTR-0089 reported 1,200 m3 consumption in a single day — 40x the normal reading. Data entry error suspected.",
                affected_records=1,
                status="open",
            ),
            models.DataQualityFlag(
                zone_id=zone_objs[4].id,
                issue_type="missing_data",
                description=f"Zone {zone_objs[4].name} has 23 customers with no billing data for November 2024. Manual data entry backlog.",
                affected_records=23,
                status="resolved",
                steward_notes="Data recovered from physical meter reading sheets and entered manually. Records corrected.",
            ),
        ]
        for f in data_quality_flags:
            db.add(f)
        db.flush()
        print(f"  {len(data_quality_flags)} data quality flags created")



        db.commit()
        print("\nSeeding complete!")
        print("\nLogin credentials:")
        print("   Admin:          username=admin    password=admin1234")
        print("   Analyst:        username=analyst  password=analyst1234")
        print("   Data Steward:   username=steward  password=steward1234")
        print("   Revenue Officer:username=revenue  password=revenue1234")
        print("   Field Officer:  username=field    password=field1234")
        print("   Viewer:         username=viewer   password=viewer1234")
        print("   Auditor:        username=auditor  password=auditor1234")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
