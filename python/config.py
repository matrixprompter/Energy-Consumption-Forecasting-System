"""Merkezi konfigürasyon — ortam değişkenlerinden okunur."""

import os
from dotenv import load_dotenv

from pathlib import Path

# .env.local veya .env dosyasını bul (override=False → Render/sistem env var'ları korunur)
_env_local = Path(__file__).resolve().parent.parent / ".env.local"
_env = Path(__file__).resolve().parent.parent / ".env"

if _env_local.exists():
    load_dotenv(_env_local, override=False)
elif _env.exists():
    load_dotenv(_env, override=False)
else:
    load_dotenv(override=False)

# Supabase
SUPABASE_URL: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ENTSO-E (opsiyonel)
ENTSOE_API_KEY: str = os.environ.get("ENTSOE_API_KEY", "")

# EPİAŞ Şeffaflık 2.0 (eptr2 kütüphanesi)
EPIAS_USERNAME: str = os.environ.get("EPIAS_USERNAME", "")
EPIAS_PASSWORD: str = os.environ.get("EPIAS_PASSWORD", "")

# Startup debug — Render loglarında env var durumunu göster
print(f"[CONFIG] SUPABASE_URL = {'SET (' + SUPABASE_URL[:20] + '...)' if SUPABASE_URL else 'EMPTY!'}")
print(f"[CONFIG] SUPABASE_SERVICE_KEY = {'SET (' + SUPABASE_SERVICE_KEY[:10] + '...)' if SUPABASE_SERVICE_KEY else 'EMPTY!'}")
print(f"[CONFIG] EPIAS_USERNAME = {'SET' if EPIAS_USERNAME else 'EMPTY!'}")
print(f"[CONFIG] All env var keys: {[k for k in os.environ.keys() if 'SUPA' in k.upper() or 'NEXT' in k.upper()]}")

# Open-Meteo (kayıt gereksiz)
OPEN_METEO_URL: str = "https://archive-api.open-meteo.com/v1/archive"

# Model varsayılanları
DEFAULT_REGION: str = "TR"
FORECAST_HORIZONS: list[int] = [24, 48, 168]
