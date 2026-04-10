"""
P2-201: Veri Toplama Scripti
EPİAŞ API → saatlik tüketim
Open-Meteo API → saatlik hava sıcaklığı
holidays paketi → TR tatil günleri
Supabase → energy_readings tablosuna kaydet
"""

import datetime as dt
from typing import Any

import holidays
import numpy as np
import pandas as pd
import requests
from supabase import create_client

from config import (
    DEFAULT_REGION,
    EPIAS_BASE_URL,
    OPEN_METEO_URL,
    SUPABASE_SERVICE_KEY,
    SUPABASE_URL,
)

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Türkiye resmi tatilleri
tr_holidays = holidays.Turkey()


# ---------------------------------------------------------------------------
# EPİAŞ — Saatlik Gerçek Zamanlı Tüketim
# ---------------------------------------------------------------------------
def fetch_epias_consumption(
    start_date: str, end_date: str
) -> pd.DataFrame:
    """
    EPİAŞ API'den saatlik tüketim verisi çeker.

    Args:
        start_date: ISO format (ör: "2024-01-01T00:00:00")
        end_date:   ISO format (ör: "2024-01-07T00:00:00")

    Returns:
        DataFrame: timestamp (UTC+3), consumption_mwh
    """
    url = f"{EPIAS_BASE_URL}/consumption/real-time-consumption"
    params = {"startDate": start_date, "endDate": end_date}

    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    items = data.get("body", {}).get("hourlyConsumptions", [])
    if not items:
        print(f"EPİAŞ: {start_date} — {end_date} arası veri bulunamadı.")
        return pd.DataFrame()

    rows = []
    for item in items:
        ts = pd.to_datetime(item["date"], utc=True).tz_convert("Europe/Istanbul")
        rows.append(
            {
                "timestamp": ts,
                "consumption_mwh": float(item.get("consumption", 0)),
            }
        )

    df = pd.DataFrame(rows)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


# ---------------------------------------------------------------------------
# Open-Meteo — Saatlik Hava Sıcaklığı (Ankara merkez)
# ---------------------------------------------------------------------------
def fetch_weather(start_date: str, end_date: str) -> pd.DataFrame:
    """
    Open-Meteo Archive API'den saatlik sıcaklık verisini çeker.
    Ankara koordinatları: lat=39.93, lon=32.86

    Returns:
        DataFrame: timestamp, weather_temp
    """
    params = {
        "latitude": 39.93,
        "longitude": 32.86,
        "start_date": start_date[:10],  # YYYY-MM-DD
        "end_date": end_date[:10],
        "hourly": "temperature_2m",
        "timezone": "Europe/Istanbul",
    }

    resp = requests.get(OPEN_METEO_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])

    df = pd.DataFrame({"timestamp": pd.to_datetime(times), "weather_temp": temps})
    df["timestamp"] = df["timestamp"].dt.tz_localize("Europe/Istanbul")
    return df


# ---------------------------------------------------------------------------
# Birleştir + Zenginleştir
# ---------------------------------------------------------------------------
def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Haftanın günü ve tatil bilgisi ekler."""
    df["day_of_week"] = df["timestamp"].dt.dayofweek  # 0=Pazartesi
    df["is_holiday"] = df["timestamp"].dt.date.apply(lambda d: d in tr_holidays)
    df["region"] = DEFAULT_REGION
    df["source"] = "epias"
    return df


def merge_weather(
    consumption_df: pd.DataFrame, weather_df: pd.DataFrame
) -> pd.DataFrame:
    """Tüketim ve hava durumu verilerini saatlik bazda birleştirir."""
    consumption_df["_merge_key"] = consumption_df["timestamp"].dt.floor("h")
    weather_df["_merge_key"] = weather_df["timestamp"].dt.floor("h")

    merged = consumption_df.merge(
        weather_df[["_merge_key", "weather_temp"]],
        on="_merge_key",
        how="left",
    )
    merged.drop(columns=["_merge_key"], inplace=True)
    return merged


# ---------------------------------------------------------------------------
# Supabase'e Kaydet
# ---------------------------------------------------------------------------
def save_to_supabase(df: pd.DataFrame) -> int:
    """
    DataFrame'i energy_readings tablosuna upsert eder.
    Returns: eklenen/güncellenen satır sayısı
    """
    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        records.append(
            {
                "timestamp": row["timestamp"].isoformat(),
                "consumption_mwh": float(row["consumption_mwh"]),
                "production_mwh": (
                    float(row["production_mwh"])
                    if "production_mwh" in row and pd.notna(row.get("production_mwh"))
                    else None
                ),
                "region": row["region"],
                "source": row["source"],
                "weather_temp": (
                    float(row["weather_temp"])
                    if pd.notna(row.get("weather_temp"))
                    else None
                ),
                "day_of_week": int(row["day_of_week"]),
                "is_holiday": bool(row["is_holiday"]),
            }
        )

    # Batch upsert (timestamp UNIQUE constraint üzerinden)
    batch_size = 500
    total = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        supabase.table("energy_readings").upsert(
            batch, on_conflict="timestamp"
        ).execute()
        total += len(batch)
        print(f"  Kaydedildi: {total}/{len(records)}")

    return total


# ---------------------------------------------------------------------------
# Ana Fonksiyon
# ---------------------------------------------------------------------------
def collect_data(start_date: str, end_date: str) -> int:
    """
    Belirli tarih aralığı için tüm verileri toplar ve Supabase'e kaydeder.

    Args:
        start_date: "2024-01-01T00:00:00"
        end_date:   "2024-12-31T23:00:00"

    Returns:
        Kaydedilen satır sayısı
    """
    print(f"Veri toplama başlatılıyor: {start_date} → {end_date}")

    # 1. EPİAŞ tüketim verisi
    print("EPİAŞ'tan tüketim verisi çekiliyor...")
    consumption_df = fetch_epias_consumption(start_date, end_date)
    if consumption_df.empty:
        print("Tüketim verisi boş — çıkılıyor.")
        return 0

    # 2. Open-Meteo hava durumu
    print("Open-Meteo'dan hava durumu çekiliyor...")
    weather_df = fetch_weather(start_date, end_date)

    # 3. Birleştir
    print("Veriler birleştiriliyor...")
    df = merge_weather(consumption_df, weather_df)
    df = enrich_dataframe(df)

    print(f"Toplam satır: {len(df)}")
    print(f"Tarih aralığı: {df['timestamp'].min()} — {df['timestamp'].max()}")
    print(f"Eksik hava durumu: {df['weather_temp'].isna().sum()} satır")

    # 4. Supabase'e kaydet
    print("Supabase'e kaydediliyor...")
    saved = save_to_supabase(df)
    print(f"Tamamlandı! {saved} satır kaydedildi.")
    return saved


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Son 2 yıl verisi
    end = dt.datetime.now()
    start = end - dt.timedelta(days=730)

    # Aylık parçalar halinde çek (API limitleri için)
    current = start
    total_saved = 0
    while current < end:
        chunk_end = min(current + dt.timedelta(days=30), end)
        start_str = current.strftime("%Y-%m-%dT00:00:00")
        end_str = chunk_end.strftime("%Y-%m-%dT23:00:00")

        try:
            saved = collect_data(start_str, end_str)
            total_saved += saved
        except Exception as e:
            print(f"HATA ({start_str}): {e}")

        current = chunk_end + dt.timedelta(days=1)

    print(f"\n=== Toplam: {total_saved} satır kaydedildi ===")
