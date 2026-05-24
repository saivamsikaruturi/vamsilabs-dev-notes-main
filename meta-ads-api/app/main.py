from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import auth, insights, campaigns
from app.config import settings

app = FastAPI(
    title="Meta Ads Intelligence API",
    description="Backend proxy for Meta Marketing API — handles OAuth, data fetching, and transformation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(insights.router)
app.include_router(campaigns.router)


@app.get("/")
async def root():
    return {
        "service": "Meta Ads Intelligence API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "auth": "/auth/login",
            "overview": "/insights/overview?date_preset=last_7d",
            "daily_trend": "/insights/daily-trend?date_preset=last_30d",
            "breakdowns": "/insights/breakdowns/{publisher_platform|age|gender}",
            "comparison": "/insights/comparison?date_preset=last_7d",
            "campaigns": "/campaigns/?date_preset=last_30d",
            "campaign_detail": "/campaigns/{id}?date_preset=last_30d",
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "meta_api_version": settings.meta_api_version}
