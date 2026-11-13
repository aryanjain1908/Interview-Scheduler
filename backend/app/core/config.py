from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://grit:grit@localhost:5432/grit"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"
    log_json: bool = False

    timezone: str = "Asia/Kolkata"
    slot_minutes: int = 30
    booking_horizon_days: int = 14
    min_booking_lead_minutes: int = 30
    # An interviewer can open a slot inside that notice, but students still need this long to join.
    short_notice_min_minutes: int = 5
    change_cutoff_hours: int = 12
    max_reschedules: int = 2
    fail_cooldown_days: int = 14
    no_show_cooldown_days: int = 3
    max_retake_days: int = 60
    outcome_grace_hours: int = 24
    early_start_minutes: int = 10
    # How long either side waits for the other before reporting them absent.
    join_wait_minutes: int = 15
    # An interview still not started this long after its slot ends is closed as
    # "missed" (no attempt used). Absences can be reported until then.
    missed_grace_minutes: int = 15
    dispute_window_hours: int = 48
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60

    @property
    def cors_origin_list(self) -> list:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
