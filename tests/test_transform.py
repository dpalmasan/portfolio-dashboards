import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from transform import (  # noqa: E402
    build_series,
    clean_region_name,
    period_to_date,
    region_code,
    region_metadata,
    simplify_geojson,
)


def test_period_to_date_within_year():
    assert period_to_date("2018 may-jul") == "2018-05-01"


def test_period_to_date_year_wrap():
    assert period_to_date("2023 nov-jan") == "2023-11-01"


def test_region_code_national():
    assert region_code("_T") == "NAT"


def test_region_code_region():
    assert region_code("CHL05") == "05"


def test_clean_region_name_strips_prefix():
    assert clean_region_name("Region of Valparaíso") == "Valparaíso"


def test_clean_region_name_metropolitana():
    assert (
        clean_region_name("Region Metropolitana de Santiago")
        == "Metropolitana de Santiago"
    )


def test_clean_region_name_national_unchanged():
    assert clean_region_name("Nationwide total") == "Nationwide total"


def _sample_df():
    rows = [
        ("Ind A", "2020 jan-mar", "_T", "Nationwide total", "Total", 50.0),
        ("Ind A", "2020 jan-mar", "_T", "Nationwide total", "Male", 60.0),
        ("Ind A", "2020 jan-mar", "_T", "Nationwide total", "Female", 40.0),
        ("Ind A", "2020 feb-apr", "_T", "Nationwide total", "Male", 61.0),
        ("Ind A", "2020 feb-apr", "_T", "Nationwide total", "Female", 41.0),
        ("Ind A", "2020 jan-mar", "CHL05", "Region of Valparaíso", "Male", 55.0),
        ("Ind A", "2020 jan-mar", "CHL05", "Region of Valparaíso", "Female", 45.0),
    ]
    return pd.DataFrame(
        rows,
        columns=[
            "Indicator",
            "Mobile trimester",
            "DTI_CL_REGION",
            "Region",
            "Sex",
            "Value",
        ],
    )


def test_build_series_excludes_total_and_aligns_periods():
    df = _sample_df()
    periods = ["2020 jan-mar", "2020 feb-apr"]
    series = build_series(df, "Mobile trimester", periods, "test", {"Ind A": "v1"})

    national_male = series["v1"]["NAT"]["M"]
    assert national_male == [60.0, 61.0]

    national_female = series["v1"]["NAT"]["F"]
    assert national_female == [40.0, 41.0]

    # Region present only in the first period must have a None gap, not a
    # misaligned shift.
    region_male = series["v1"]["05"]["M"]
    assert region_male == [55.0, None]


def test_build_series_excludes_total_sex():
    df = _sample_df()
    periods = ["2020 jan-mar", "2020 feb-apr"]
    series = build_series(df, "Mobile trimester", periods, "test", {"Ind A": "v1"})
    assert "T" not in series["v1"]["NAT"]


def test_region_metadata_excludes_national_and_sorts_by_codregion():
    df = _sample_df()
    regions = region_metadata(df)
    codes = [r["code"] for r in regions]
    assert "NAT" not in codes
    assert codes == sorted(codes, key=lambda c: int(c))
    assert regions[0] == {"code": "05", "name": "Valparaíso", "codregion": 5}


def test_simplify_geojson_rounds_and_slims_properties():
    raw = {
        "features": [
            {
                "properties": {
                    "codregion": 5,
                    "Region": "Región de Valparaíso",
                    "objectid": 999,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[-71.123456789, -33.987654321]]],
                },
            }
        ]
    }
    out = simplify_geojson(raw, decimals=3)
    feature = out["features"][0]
    assert feature["properties"] == {"codregion": 5, "name": "Región de Valparaíso"}
    assert feature["geometry"]["coordinates"] == [[[-71.123, -33.988]]]
