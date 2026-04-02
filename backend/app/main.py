from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, zones, customers, bills, forecasts, dashboard, reports

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KIWASCO Sales & Revenue Forecasting API",
    description="AI-powered forecasting system for Kisumu Water & Sewerage Company",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production to your Render/Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(zones.router)
app.include_router(customers.router)
app.include_router(bills.router)
app.include_router(forecasts.router)
app.include_router(dashboard.router)
app.include_router(reports.router)

@app.get("/")
def root():
    return {
        "system": "KIWASCO Sales & Revenue Forecasting System",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/api/docs",
    }

@app.get("/health")
def health():
    return {"status": "ok"}
