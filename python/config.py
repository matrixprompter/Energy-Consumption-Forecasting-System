"""Merkezi konfigürasyon — ortam değişkenlerinden okunur."""

import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ENTSO-E (opsiyonel)
ENTSOE_API_KEY: str = os.environ.get("ENTSOE_API_KEY", "")

# EPİAŞ
EPIAS_BASE_URL: str = "https://seffaflik.epias.com.tr/transparency/service"

# Open-Meteo (kayıt gereksiz)
OPEN_METEO_URL: str = "https://archive-api.open-meteo.com/v1/archive"

# Model varsayılanları
DEFAULT_REGION: str = "TR"
FORECAST_HORIZONS: list[int] = [24, 48, 168]
