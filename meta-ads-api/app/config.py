from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_access_token: str = ""
    meta_ad_account_id: str = ""
    redirect_uri: str = "http://localhost:8000/auth/callback"
    frontend_url: str = "http://localhost:3000"
    meta_api_version: str = "v19.0"
    meta_graph_url: str = "https://graph.facebook.com"

    class Config:
        env_file = ".env"

    @property
    def meta_base_url(self) -> str:
        return f"{self.meta_graph_url}/{self.meta_api_version}"


settings = Settings()
