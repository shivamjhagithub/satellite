from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration comes from environment variables. No secrets in code."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_service_port: int = 8000
    vlm_model_name: str = "Qwen/Qwen3-VL-4B-Instruct"
    vlm_device: str = "auto"
    vlm_tile_size: int = 768
    vlm_max_tiles: int = 4
    vlm_max_new_tokens: int = 96
    vlm_load_in_4bit: bool = True
    hf_home: str | None = None
    minio_endpoint: str | None = None
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_bucket: str = "satellite-images"


settings = Settings()