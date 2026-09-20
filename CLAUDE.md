# Dashboard Plotly

## INE Dashboards

I have two `.csv` datasets `occupancy-rate.csv` and `work-force.csv`. The relevant columns from the schema is the following:

* indicator: Name of the indicator
* Mobile Trimester
* Region: Chilean region
* Sex: We are not interested in `Total` as we can infer it from the others (i.e. summing `Male` and `Female`)
* Value of the indicator

The goal is generating two interactive dashboards. I need to use them as portfolio so they should be portable to a github.io page for viewing it. The requirement is using plotly.

The following specs:

### Dashboard 1

* time series
* period filter
* 2–3 KPIs / indicators
* at least two selectable variables/categories
* interactive charts

## Dashboard 2 — Geographic

* interactive map (Chile, South Africa, or any territorial dataset)
* breakdown by region/province/territory
* territorial filter
* 2–3 KPI indicators
* map ↔️ charts/table interaction

## Code requirements

* Modular code
* Commit hooks
    - Linters
    - Code formatters
    - Unit tests if needed
    - Github pages deployment
* Add instructions on how to run locally in the `README.md`
