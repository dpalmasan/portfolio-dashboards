"""Build the static JSON payloads consumed by the two dashboards.

Reads the raw INE CSV extracts and the vendored Chile regions GeoJSON from
``data/``, cleans and pivots them with :mod:`transform`, and writes compact
JSON files into ``docs/assets/data/`` for the static site to load at runtime.

Usage:
    python scripts/build_data.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from transform import (
    build_series,
    period_to_date,
    region_metadata,
    simplify_geojson,
)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "docs" / "assets" / "data"

# Known source-export defect: both INE extracts carry a trailing row labeled
# "<year> dec-feb" that breaks the monthly cadence (it lands months after the
# preceding period with no "apr-jun" etc. in between, yet its value sits in
# the same narrow band as its neighbours). Rather than guess the intended
# label, the anomalous period is dropped from both datasets.
KNOWN_BAD_PERIODS = {"2024 dec-feb"}

DATASETS = {
    "occupancy_rate": {
        "csv": "occupancy-rate.csv",
        "period_col": "Mobile trimester",
        "unit": "%",
        "label": "Occupancy (employment) rate",
        "projections": {
            "Employment rate (2002-based projections)": "2002",
            "Employment rate (2017-based projections)": "2017",
        },
    },
    "labour_force": {
        "csv": "work-force.csv",
        "period_col": "Mobile Quarter",
        "unit": "thousand people",
        "label": "Labour force",
        "projections": {
            "Labour force (2002-based projections)": "2002",
            "Labour force (2017-based projections)": "2017",
        },
    },
}


def load_clean_csv(filename: str, period_col: str) -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / filename)
    return df[~df[period_col].isin(KNOWN_BAD_PERIODS)].copy()


def build_periods(frames: list[tuple[pd.DataFrame, str]]) -> list[str]:
    all_periods: set[str] = set()
    for df, period_col in frames:
        all_periods.update(df[period_col].unique())
    return sorted(all_periods, key=period_to_date)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    frames = {
        key: load_clean_csv(cfg["csv"], cfg["period_col"])
        for key, cfg in DATASETS.items()
    }

    periods = build_periods(
        [(df, DATASETS[key]["period_col"]) for key, df in frames.items()]
    )
    period_dates = [period_to_date(p) for p in periods]

    series = {}
    units = {}
    labels = {}
    for key, cfg in DATASETS.items():
        df = frames[key]
        series[key] = build_series(
            df,
            cfg["period_col"],
            periods,
            key,
            cfg["projections"],
        )
        units[key] = cfg["unit"]
        labels[key] = cfg["label"]

    regions = region_metadata(next(iter(frames.values())))

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "Instituto Nacional de Estadisticas (INE) Chile, ENE survey",
            "excluded_periods": sorted(KNOWN_BAD_PERIODS),
            "units": units,
            "labels": labels,
        },
        "periods": periods,
        "period_dates": period_dates,
        "regions": regions,
        "series": series,
    }

    series_path = OUT_DIR / "series.json"
    series_path.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {series_path} ({series_path.stat().st_size / 1024:.0f} KB)")

    raw_geojson = json.loads((DATA_DIR / "chile-regions-raw.geojson").read_text())
    simplified = simplify_geojson(raw_geojson)
    geo_path = OUT_DIR / "chile-regions.json"
    geo_path.write_text(json.dumps(simplified, separators=(",", ":")))
    print(f"wrote {geo_path} ({geo_path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
