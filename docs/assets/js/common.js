/* Shared helpers for both dashboards: theme toggle, data loading, formatting,
 * and Plotly layout defaults built from the CSS design tokens. */

const THEME_KEY = "dashboard-theme";

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
  }
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;
  updateToggleLabel(toggle);
  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark = current ? current === "dark" : prefersDark;
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateToggleLabel(toggle);
    document.dispatchEvent(new CustomEvent("theme-changed"));
  });
}

function updateToggleLabel(toggle) {
  const current = document.documentElement.getAttribute("data-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = current ? current === "dark" : prefersDark;
  toggle.textContent = isDark ? "Light mode" : "Dark mode";
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function loadSeries() {
  const res = await fetch("assets/data/series.json");
  if (!res.ok) throw new Error(`Failed to load series.json: ${res.status}`);
  return res.json();
}

async function loadGeoJson() {
  const res = await fetch("assets/data/chile-regions.json");
  if (!res.ok) throw new Error(`Failed to load chile-regions.json: ${res.status}`);
  return res.json();
}

/** Returns the aligned value array for one region/sex/projection combination. */
function getSeries(data, dataset, projection, regionCode, sexCode) {
  const region = data.series[dataset]?.[projection]?.[regionCode];
  return region?.[sexCode] ?? new Array(data.periods.length).fill(null);
}

/** Index of the last non-null value at or before `maxIdx` (defaults to end). */
function lastValidIndex(values, maxIdx = values.length - 1) {
  for (let i = maxIdx; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined) return i;
  }
  return -1;
}

function formatValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (unit === "%") return `${value.toFixed(1)}%`;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDelta(delta, unit) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  if (unit === "%") return `${sign}${delta.toFixed(1)} pp`;
  return `${sign}${delta.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Year-over-year comparison: latest valid value vs the value ~12 periods earlier. */
function computeYoY(values) {
  const latestIdx = lastValidIndex(values);
  if (latestIdx < 0) return { latest: null, previous: null, delta: null, latestIdx: -1 };
  const priorIdx = latestIdx - 12;
  const latest = values[latestIdx];
  const previous = priorIdx >= 0 ? values[priorIdx] : null;
  const delta = previous !== null && previous !== undefined ? latest - previous : null;
  return { latest, previous, delta, latestIdx };
}

function plotlyBaseLayout(overrides = {}) {
  const font = {
    family: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: cssVar("--text-secondary"),
    size: 12,
  };
  return Object.assign(
    {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font,
      margin: { l: 48, r: 20, t: 10, b: 40 },
      hovermode: "x unified",
      legend: { orientation: "h", y: 1.12, x: 0 },
      xaxis: {
        gridcolor: cssVar("--gridline"),
        linecolor: cssVar("--baseline"),
        zeroline: false,
        tickfont: { color: cssVar("--text-muted") },
      },
      yaxis: {
        gridcolor: cssVar("--gridline"),
        linecolor: cssVar("--baseline"),
        zeroline: false,
        tickfont: { color: cssVar("--text-muted") },
      },
    },
    overrides,
  );
}

const PLOTLY_CONFIG = { displaylogo: false, responsive: true };
