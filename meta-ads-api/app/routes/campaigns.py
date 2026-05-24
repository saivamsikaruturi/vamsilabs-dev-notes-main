from fastapi import APIRouter, Query, HTTPException

from app.services.meta_client import MetaAdsClient, MetaAPIError
from app.services.data_transformer import transform_campaigns
from app.config import settings

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/")
async def list_campaigns(
    date_preset: str = Query("last_30d"),
    status: str | None = Query(None, description="Filter: ACTIVE, PAUSED, or ALL"),
    access_token: str | None = Query(None),
):
    """
    List all campaigns with their insights merged in.
    Returns sorted by spend (highest first).
    """
    client = MetaAdsClient(access_token)
    try:
        # Fetch campaign objects
        status_filter = None
        if status and status != "ALL":
            status_filter = f'["{status}"]'

        campaigns = await client.get_campaigns(
            status_filter=[status] if status and status != "ALL" else None,
            date_preset=date_preset,
        )

        # Fetch insights for each campaign
        campaign_insights = []
        for camp in campaigns.get("data", []):
            try:
                insight_resp = await client.get_campaign_insights(
                    campaign_id=camp["id"],
                    date_preset=date_preset,
                    time_increment="all_days",
                )
                for item in insight_resp.get("data", []):
                    item["campaign_id"] = camp["id"]
                    campaign_insights.append(item)
            except MetaAPIError:
                pass  # Campaign may have no data in this period

        return {"campaigns": transform_campaigns(campaigns, campaign_insights)}
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()


@router.get("/{campaign_id}")
async def get_campaign_detail(
    campaign_id: str,
    date_preset: str = Query("last_30d"),
    access_token: str | None = Query(None),
):
    """
    Detailed view of a single campaign including daily breakdown.
    """
    client = MetaAdsClient(access_token)
    try:
        insights = await client.get_campaign_insights(
            campaign_id=campaign_id,
            date_preset=date_preset,
            time_increment="1",
        )

        from app.services.data_transformer import transform_account_insights
        transformed = transform_account_insights(insights)
        transformed["campaign_id"] = campaign_id
        return transformed
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()


@router.get("/{campaign_id}/adsets")
async def get_campaign_adsets(
    campaign_id: str,
    access_token: str | None = Query(None),
):
    """
    List ad sets for a specific campaign.
    """
    client = MetaAdsClient(access_token)
    try:
        return await client.get_adsets(campaign_id=campaign_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    finally:
        await client.close()
