import httpx
from datetime import date, timedelta

from app.config import settings


class MetaAdsClient:
    """
    HTTP client for Meta Marketing API.
    Handles all requests to graph.facebook.com with proper auth and error handling.
    """

    def __init__(self, access_token: str | None = None):
        self.access_token = access_token or settings.meta_access_token
        self.base_url = settings.meta_base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def _request(self, endpoint: str, params: dict | None = None) -> dict:
        params = params or {}
        params["access_token"] = self.access_token
        url = f"{self.base_url}/{endpoint}"

        response = await self.client.get(url, params=params)

        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get("error", {}).get("message", "Unknown Meta API error")
            raise MetaAPIError(response.status_code, error_msg)

        return response.json()

    async def get_account_info(self, account_id: str | None = None) -> dict:
        account_id = account_id or settings.meta_ad_account_id
        return await self._request(
            account_id,
            {"fields": "name,account_id,currency,timezone_name,account_status,balance,amount_spent"}
        )

    async def get_account_insights(
        self,
        account_id: str | None = None,
        date_preset: str | None = None,
        since: str | None = None,
        until: str | None = None,
        time_increment: str = "1",
        breakdowns: str | None = None,
    ) -> dict:
        account_id = account_id or settings.meta_ad_account_id
        params = {
            "fields": ",".join([
                "spend", "impressions", "clicks", "ctr", "cpc", "cpm",
                "actions", "action_values", "cost_per_action_type",
                "reach", "frequency", "conversions", "conversion_values",
                "purchase_roas", "website_ctr",
            ]),
            "time_increment": time_increment,
        }

        if date_preset:
            params["date_preset"] = date_preset
        elif since and until:
            params["time_range"] = f'{{"since":"{since}","until":"{until}"}}'

        if breakdowns:
            params["breakdowns"] = breakdowns

        return await self._request(f"{account_id}/insights", params)

    async def get_campaigns(
        self,
        account_id: str | None = None,
        status_filter: list[str] | None = None,
        date_preset: str = "last_30d",
    ) -> dict:
        account_id = account_id or settings.meta_ad_account_id
        params = {
            "fields": ",".join([
                "name", "status", "objective", "daily_budget", "lifetime_budget",
                "bid_strategy", "buying_type", "created_time", "updated_time",
            ]),
            "limit": 100,
        }

        if status_filter:
            params["filtering"] = f'[{{"field":"effective_status","operator":"IN","value":{status_filter}}}]'

        return await self._request(f"{account_id}/campaigns", params)

    async def get_campaign_insights(
        self,
        campaign_id: str,
        date_preset: str = "last_30d",
        time_increment: str = "1",
    ) -> dict:
        params = {
            "fields": ",".join([
                "campaign_name", "spend", "impressions", "clicks", "ctr", "cpc",
                "actions", "action_values", "cost_per_action_type",
                "reach", "frequency", "purchase_roas",
            ]),
            "date_preset": date_preset,
            "time_increment": time_increment,
        }
        return await self._request(f"{campaign_id}/insights", params)

    async def get_adsets(
        self,
        account_id: str | None = None,
        campaign_id: str | None = None,
    ) -> dict:
        account_id = account_id or settings.meta_ad_account_id
        parent = campaign_id or account_id
        params = {
            "fields": ",".join([
                "name", "status", "targeting", "daily_budget", "bid_amount",
                "optimization_goal", "billing_event", "campaign_id",
            ]),
            "limit": 100,
        }
        return await self._request(f"{parent}/adsets", params)

    async def get_ads(
        self,
        account_id: str | None = None,
        adset_id: str | None = None,
    ) -> dict:
        account_id = account_id or settings.meta_ad_account_id
        parent = adset_id or account_id
        params = {
            "fields": ",".join([
                "name", "status", "creative", "adset_id", "campaign_id",
                "created_time", "effective_status",
            ]),
            "limit": 100,
        }
        return await self._request(f"{parent}/ads", params)

    async def get_ad_creatives(self, ad_id: str) -> dict:
        return await self._request(
            f"{ad_id}/adcreatives",
            {"fields": "name,title,body,image_url,thumbnail_url,video_id,object_story_spec"}
        )

    async def close(self):
        await self.client.aclose()


class MetaAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Meta API Error ({status_code}): {message}")
