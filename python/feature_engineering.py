"""
P2-202: Özellik Mühendisliği
lag features, rolling stats, zaman özellikleri, tatil flag, hava durumu
"""

import numpy as np
import pandas as pd


def create_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    energy_readings DataFrame'inden ML özellikleri üretir.

    Beklenen kolonlar: timestamp, consumption_mwh, weather_temp, day_of_week, is_holiday

    Üretilen özellikler:
        - Lag: t-1, t-24, t-168 (1 saat, 1 gün, 1 hafta önce)
        - Rolling: 24h ortalama/std, 168h ortalama/std
        - Zaman: hour, day_of_week, month, season
        - Tatil: is_holiday (boolean → int)
        - Hava durumu: weather_temp
    """
    df = df.copy()
    df = df.sort_values("timestamp").reset_index(drop=True)

    # ----- Hedef değişken -----
    df["target"] = df["consumption_mwh"]

    # ----- Lag Özellikleri -----
    df["lag_1h"] = df["consumption_mwh"].shift(1)
    df["lag_24h"] = df["consumption_mwh"].shift(24)
    df["lag_168h"] = df["consumption_mwh"].shift(168)

    # ----- Rolling İstatistikler -----
    df["rolling_mean_24h"] = (
        df["consumption_mwh"].rolling(window=24, min_periods=1).mean()
    )
    df["rolling_std_24h"] = (
        df["consumption_mwh"].rolling(window=24, min_periods=1).std()
    )
    df["rolling_mean_168h"] = (
        df["consumption_mwh"].rolling(window=168, min_periods=1).mean()
    )
    df["rolling_std_168h"] = (
        df["consumption_mwh"].rolling(window=168, min_periods=1).std()
    )

    # ----- Zaman Özellikleri -----
    df["hour"] = df["timestamp"].dt.hour
    df["month"] = df["timestamp"].dt.month
    df["season"] = df["month"].map(
        {
            12: 0, 1: 0, 2: 0,   # Kış
            3: 1, 4: 1, 5: 1,    # İlkbahar
            6: 2, 7: 2, 8: 2,    # Yaz
            9: 3, 10: 3, 11: 3,  # Sonbahar
        }
    )

    # ----- Tatil (boolean → int) -----
    df["is_holiday_int"] = df["is_holiday"].astype(int)

    # ----- Hafta sonu -----
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # ----- Hava durumu (NaN → medyan ile doldur) -----
    if "weather_temp" in df.columns:
        df["weather_temp"] = df["weather_temp"].fillna(df["weather_temp"].median())
    else:
        df["weather_temp"] = 0.0

    return df


def get_feature_columns() -> list[str]:
    """ML modelleri için kullanılacak özellik kolon adları."""
    return [
        "lag_1h",
        "lag_24h",
        "lag_168h",
        "rolling_mean_24h",
        "rolling_std_24h",
        "rolling_mean_168h",
        "rolling_std_168h",
        "hour",
        "day_of_week",
        "month",
        "season",
        "is_holiday_int",
        "is_weekend",
        "weather_temp",
    ]


def prepare_train_test(
    df: pd.DataFrame, test_ratio: float = 0.2
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Özellik DataFrame'ini train/test olarak böler.
    Zaman serisi olduğu için shuffle yapmaz — son %20 test.

    Returns:
        X_train, X_test, y_train, y_test
    """
    features = get_feature_columns()

    # Lag değerleri dolana kadar NaN satırları at
    df_clean = df.dropna(subset=features + ["target"]).reset_index(drop=True)

    split_idx = int(len(df_clean) * (1 - test_ratio))

    X_train = df_clean.iloc[:split_idx][features]
    X_test = df_clean.iloc[split_idx:][features]
    y_train = df_clean.iloc[:split_idx]["target"]
    y_test = df_clean.iloc[split_idx:]["target"]

    print(f"Train: {len(X_train)} satır | Test: {len(X_test)} satır")
    print(f"Özellik sayısı: {len(features)}")

    return X_train, X_test, y_train, y_test


# Özellik adlarının Türkçe karşılıkları (dashboard için)
FEATURE_LABELS_TR: dict[str, str] = {
    "lag_1h": "1 Saat Önceki Tüketim",
    "lag_24h": "24 Saat Önceki Tüketim",
    "lag_168h": "1 Hafta Önceki Tüketim",
    "rolling_mean_24h": "24 Saatlik Ortalama",
    "rolling_std_24h": "24 Saatlik Standart Sapma",
    "rolling_mean_168h": "Haftalık Ortalama",
    "rolling_std_168h": "Haftalık Standart Sapma",
    "hour": "Saat",
    "day_of_week": "Haftanın Günü",
    "month": "Ay",
    "season": "Mevsim",
    "is_holiday_int": "Tatil Günü",
    "is_weekend": "Hafta Sonu",
    "weather_temp": "Sıcaklık (°C)",
}
