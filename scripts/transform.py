"""Pure data-transformation functions for the INE employment dashboards.

Reads the two raw INE CSV extracts (occupancy rate / labour force) plus a
vendored Chile regions GeoJSON, and produces the compact JSON payloads the
static dashboards load at runtime. Kept free of file I/O so it is easy to
unit test.
"""

from __future__ import annotations

from datetime import date

import pandas as pd

MONTH_ABBR = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

SEX_CODES = {"Male": "M", "Female": "F"}

NATIONAL_CODE = "NAT"
NATIONAL_NAME = "Nationwide total"


def period_to_date(period: str) -> str:
    """Convert an INE mobile-trimester label to an ISO date string.

    The label is "<year> <start_month>-<end_month>", e.g. "2018 may-jul".
    The trimester's start month is used as the representative date so the
    resulting series can be plotted on a real time axis.
    """
    year_str, months = period.split(" ", 1)
    start_month = months.split("-", 1)[0]
    month = MONTH_ABBR[start_month.lower()]
    return date(int(year_str), month, 1).isoformat()


def region_code(dti_region: str) -> str:
    """Map an INE DTI_CL_REGION code (e.g. "CHL05", "_T") to a short code."""
    if dti_region == "_T":
        return NATIONAL_CODE
    return dti_region.replace("CHL", "")


def clean_region_name(name: str) -> str:
    """Strip the redundant "Region"/"Region of" prefix from an INE region name."""
    if name == NATIONAL_NAME:
        return name
    for prefix in ("Region Metropolitana de Santiago",):
        if name == prefix:
            return "Metropolitana de Santiago"
    if name.startswith("Region of "):
        return name[len("Region of ") :]
    return name


def build_series(
    df: pd.DataFrame,
    period_col: str,
    periods: list[str],
    dataset_key: str,
    projection_labels: dict[str, str],
) -> dict:
    """Pivot a raw INE dataframe into the nested series structure.

    Shape: series[projection_code][region_code][sex_code] -> list[float | None]
    aligned index-for-index with ``periods``.
    """
    period_index = {p: i for i, p in enumerate(periods)}
    n = len(periods)

    df = df[df["Sex"].isin(SEX_CODES)].copy()
    df["region_code"] = df["DTI_CL_REGION"].map(region_code)
    df["sex_code"] = df["Sex"].map(SEX_CODES)

    series: dict = {}
    for indicator, projection_code in projection_labels.items():
        sub = df[df["Indicator"] == indicator]
        by_region: dict = {}
        for (rcode, scode), group in sub.groupby(["region_code", "sex_code"]):
            values: list[float | None] = [None] * n
            for period, value in zip(group[period_col], group["Value"], strict=True):
                values[period_index[period]] = round(float(value), 2)
            by_region.setdefault(rcode, {})[scode] = values
        series[projection_code] = by_region

    return series


def region_metadata(df: pd.DataFrame) -> list[dict]:
    """Return sorted region metadata: code, display name, numeric codregion."""
    pairs = df[["DTI_CL_REGION", "Region"]].drop_duplicates()
    regions = []
    for _, row in pairs.iterrows():
        code = region_code(row["DTI_CL_REGION"])
        if code == NATIONAL_CODE:
            continue
        regions.append(
            {
                "code": code,
                "name": clean_region_name(row["Region"]),
                "codregion": int(code),
            }
        )
    regions.sort(key=lambda r: r["codregion"])
    return regions


def simplify_geojson(raw_geojson: dict, decimals: int = 4) -> dict:
    """Round coordinate precision and drop unused properties to shrink the file."""

    def round_coords(obj):
        if isinstance(obj, float):
            return round(obj, decimals)
        if isinstance(obj, list):
            return [round_coords(x) for x in obj]
        return obj

    features = []
    for feature in raw_geojson["features"]:
        props = feature["properties"]
        geometry = dict(feature["geometry"])
        geometry["coordinates"] = round_coords(geometry["coordinates"])
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "codregion": int(props["codregion"]),
                    "name": props["Region"],
                },
                "geometry": geometry,
            }
        )
    return {"type": "FeatureCollection", "features": features}
