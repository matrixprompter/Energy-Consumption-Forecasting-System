"""Merkezi konfigürasyon — ortam değişkenlerinden okunur."""

import os
from dotenv import load_dotenv

from pathlib import Path

# .env.local veya .env dosyasını bul
_env_local = Path(__file__).resolve().parent.parent / ".env.local"
_env = Path(__file__).resolve().parent.parent / ".env"

if _env_local.exists():
    load_dotenv(_env_local)
elif _env.exists():
    load_dotenv(_env)
else:
    load_dotenv()

# Supabase
SUPABASE_URL: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ENTSO-E (opsiyonel)
ENTSOE_API_KEY: str = os.environ.get("ENTSOE_API_KEY", "")

# EPİAŞ Şeffaflık 2.0 (eptr2 kütüphanesi)
EPIAS_USERNAME: str = os.environ.get("EPIAS_USERNAME", "")
EPIAS_PASSWORD: str = os.environ.get("EPIAS_PASSWORD", "")

# Open-Meteo (kayıt gereksiz)
OPEN_METEO_URL: str = "https://archive-api.open-meteo.com/v1/archive"

# Model varsayılanları
DEFAULT_REGION: str = "TR"
FORECAST_HORIZONS: list[int] = [24, 48, 168]
