# portfolio-dashboards

Two interactive Plotly.js dashboards over INE Chile's National Employment
Survey (ENE): occupancy (employment) rate and labour force, by region and
sex, from 2010 to 2024.

- **Time Series** (`docs/dashboard-timeseries.html`) — trend over time with a
  period range slider, KPIs, and a region-by-region ranking chart.
- **Geographic** (`docs/dashboard-geo.html`) — a Chile choropleth map linked
  to a ranking chart and a region detail trend/table.

The site is plain static HTML/CSS/JS (Plotly.js vendored locally, no build
tool required) so it can be served as-is from GitHub Pages.

## Project layout

```
data/                     Raw INE CSV extracts + vendored Chile regions GeoJSON (source inputs)
scripts/                  Python data pipeline (transform.py + build_data.py)
tests/                    Unit tests for the data pipeline
docs/                     The static site (GitHub Pages root)
  assets/css/             Shared stylesheet (light/dark design tokens)
  assets/js/              Shared helpers + one script per dashboard
  assets/vendor/          Vendored Plotly.js builds
  assets/data/            Generated JSON payloads (gitignored, built locally/in CI)
```

## Running locally

Requires Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

# Regenerate docs/assets/data/*.json from the CSVs in data/
python scripts/build_data.py

# Serve the static site
cd docs && python -m http.server 8000
```

Open http://localhost:8000 in a browser.

### Tests, linting, formatting

```bash
pytest
ruff check scripts tests
ruff format scripts tests
```

### Pre-commit hooks

This repo uses [pre-commit](https://pre-commit.com) to run Ruff (lint +
format) and the test suite before every commit:

```bash
pre-commit install
```

### Deployment

Pushes to `main` trigger `.github/workflows/pages.yml`, which lints, tests,
rebuilds `docs/assets/data/*.json` from the CSVs, and publishes `docs/` to
GitHub Pages.

## Data sources

- Instituto Nacional de Estadísticas (INE) Chile — Encuesta Nacional de
  Empleo (ENE): `data/occupancy-rate.csv`, `data/work-force.csv`.
- Chile region boundaries: [caracena/chile-geojson](https://github.com/caracena/chile-geojson)
  (`data/chile-regions-raw.geojson`, coordinates simplified at build time).

### Known data-quality note

Both source CSVs contain a trailing row labeled `"<year> dec-feb"` that
breaks the monthly cadence of the mobile-trimester series (it isn't the next
chronological period after the preceding row). `scripts/build_data.py`
excludes this row rather than guess its intended label; see
`KNOWN_BAD_PERIODS` in that file.
