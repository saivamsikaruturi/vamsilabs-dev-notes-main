from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
import httpx

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
async def login():
    """
    Redirect user to Meta OAuth dialog.
    Requests ads_read + ads_management scopes for full Marketing API access.
    """
    oauth_url = (
        f"https://www.facebook.com/{settings.meta_api_version}/dialog/oauth"
        f"?client_id={settings.meta_app_id}"
        f"&redirect_uri={settings.redirect_uri}"
        f"&scope=ads_read,ads_management"
        f"&response_type=code"
    )
    return RedirectResponse(url=oauth_url)


@router.get("/callback")
async def callback(code: str):
    """
    Handle OAuth callback from Meta.
    Exchanges short-lived code for long-lived access token.
    """
    async with httpx.AsyncClient() as client:
        # Exchange code for short-lived token
        token_response = await client.get(
            f"{settings.meta_base_url}/oauth/access_token",
            params={
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "redirect_uri": settings.redirect_uri,
                "code": code,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")

        short_token = token_response.json().get("access_token")

        # Exchange short-lived for long-lived token (60 days)
        long_token_response = await client.get(
            f"{settings.meta_base_url}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "fb_exchange_token": short_token,
            },
        )

        if long_token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get long-lived token")

        data = long_token_response.json()

    return RedirectResponse(
        url=f"{settings.frontend_url}/meta-ads-dashboard.html?token={data['access_token']}&expires_in={data.get('expires_in', 5184000)}"
    )


@router.get("/ad-accounts")
async def get_ad_accounts(access_token: str):
    """
    List all ad accounts the authenticated user has access to.
    Used during onboarding to let user select which account to connect.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.meta_base_url}/me/adaccounts",
            params={
                "access_token": access_token,
                "fields": "name,account_id,account_status,currency,timezone_name",
                "limit": 50,
            },
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch ad accounts")

    return response.json()
