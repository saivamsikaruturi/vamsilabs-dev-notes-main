from fastapi import APIRouter, Query, HTTPException
from datetime import date, timedelta

from app.services.meta_client import MetaAdsClient, MetaAPIError
from app.services.data_transformer import (
    transform_account_insights,
    transform_breakdowns,
    build_funnel,
)
from app.config import settings

router = APIRouter(prefix="/insights", tags=["insights"])

DATE_PRESETS = [
    "today", "yesterday", "last_3d", "last_7d",
    "last_14d", "last_28d", "last_30d", "last_90d",
    "this_month", "last_month",
]


@router.get("/overview")
async def get_overview(
    date_preset: str = Query("last_7d", description="Meta date preset"),
    access_token: str | None = Query(None, description="Override access token"),
):
    """
    Full account overview: KPIs, daily trend, and funnel.
    This is the primary endpoint the dashboard calls on load + time range change.
    """
    client = MetaAdsClient(access_token)
    try:
        raw_insights = await client.get_account_insights(
            date_preset=date_preset,
            time_increment="1",
        )
        result = transform_account_insights(raw_insights)
        result["funnel"] = build_funnel(raw_insights)
        return result
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()


@router.get("/daily-trend")
async def get_daily_trend(
    since: str = Query(None, description="Start date YYYY-MM-DD"),
    until: str = Query(None, description="End date YYYY-MM-DD"),
    date_preset: str = Query("last_30d", description="Meta date preset (used if since/until not provided)"),
    access_token: str | None = Query(None),
):
    """
    Daily metrics for charting. Returns spend, revenue, clicks, conversions per day.
    """
    client = MetaAdsClient(access_token)
    try:
        raw = await client.get_account_insights(
            date_preset=date_preset if not since else None,
            since=since,
            until=until,
            time_increment="1",
        )
        transformed = transform_account_insights(raw)
        return {"daily_trend": transformed["daily_trend"]}
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()


@router.get("/breakdowns/{breakdown_type}")
async def get_breakdowns(
    breakdown_type: str,
    date_preset: str = Query("last_30d"),
    access_token: str | None = Query(None),
):
    """
    Get metrics broken down by dimension.
    Supported: publisher_platform, platform_position, age, gender, country, region
    """
    valid_breakdowns = [
        "publisher_platform", "platform_position", "age",
        "gender", "country", "region", "device_platform",
        "impression_device",
    ]

    if breakdown_type not in valid_breakdowns:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid breakdown. Must be one of: {', '.join(valid_breakdowns)}"
        )

    client = MetaAdsClient(access_token)
    try:
        raw = await client.get_account_insights(
            date_preset=date_preset,
            time_increment="all_days",
            breakdowns=breakdown_type,
        )
        return {"breakdown": breakdown_type, "data": transform_breakdowns(raw, breakdown_type)}
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()


@router.get("/comparison")
async def get_comparison(
    date_preset: str = Query("last_7d"),
    access_token: str | None = Query(None),
):
    """
    Compare current period vs previous period.
    Returns KPIs for both periods + percentage change.
    """
    days_map = {
        "today": 1, "yesterday": 1, "last_3d": 3, "last_7d": 7,
        "last_14d": 14, "last_28d": 28, "last_30d": 30, "last_90d": 90,
    }
    period_days = days_map.get(date_preset, 7)

    today = date.today()
    current_end = today - timedelta(days=1)
    current_start = current_end - timedelta(days=period_days - 1)
    prev_end = current_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    client = MetaAdsClient(access_token)
    try:
        current_raw = await client.get_account_insights(
            since=current_start.isoformat(),
            until=current_end.isoformat(),
            time_increment="all_days",
        )
        prev_raw = await client.get_account_insights(
            since=prev_start.isoformat(),
            until=prev_end.isoformat(),
            time_increment="all_days",
        )

        current = transform_account_insights(current_raw)
        previous = transform_account_insights(prev_raw)

        comparison = {}
        for key in current["kpis"]:
            curr_val = current["kpis"].get(key, 0)
            prev_val = previous["kpis"].get(key, 0)
            delta = ((curr_val - prev_val) / prev_val * 100) if prev_val != 0 else 0
            comparison[key] = {
                "current": curr_val,
                "previous": prev_val,
                "delta_percent": round(delta, 1),
            }

        return {"comparison": comparison, "period_days": period_days}
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()
