/* Dashboard 1: Time series — occupancy rate & labour force over time. */

let DATA = null;
const state = {
  metric: "occupancy_rate",
  projection: "2017",
  region: "NAT",
};

function regionName(code) {
  if (code === "NAT") return "Nationwide total";
  return DATA.regions.find((r) => r.code === code)?.name ?? code;
}

function populateRegionSelect() {
  const select = document.getElementById("region-select");
  select.innerHTML = "";
  const natOpt = document.createElement("option");
  natOpt.value = "NAT";
  natOpt.textContent = "Nationwide total";
  select.appendChild(natOpt);
  for (const r of DATA.regions) {
    const opt = document.createElement("option");
    opt.value = r.code;
    opt.textContent = r.name;
    select.appendChild(opt);
  }
  select.value = state.region;
  select.addEventListener("change", () => {
    state.region = select.value;
    render();
  });
}

function wireSegmented(containerId, key, onChange) {
  const container = document.getElementById(containerId);
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      container
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state[key] = btn.dataset.value;
      onChange?.();
      render();
    });
  });
}

function renderKpis() {
  const unit = DATA.meta.units[state.metric];
  const male = getSeries(DATA, state.metric, state.projection, state.region, "M");
  const female = getSeries(DATA, state.metric, state.projection, state.region, "F");
  const maleYoy = computeYoY(male);
  const femaleYoy = computeYoY(female);

  const gapIdx = Math.min(maleYoy.latestIdx, femaleYoy.latestIdx);
  const gapNow =
    gapIdx >= 0 ? male[gapIdx] - female[gapIdx] : null;
  const priorGapIdx = gapIdx - 12;
  const gapPrior =
    priorGapIdx >= 0 && male[priorGapIdx] != null && female[priorGapIdx] != null
      ? male[priorGapIdx] - female[priorGapIdx]
      : null;
  const gapDelta = gapPrior !== null && gapNow !== null ? gapNow - gapPrior : null;

  const tiles = [
    {
      label: `Male — latest (${DATA.periods[maleYoy.latestIdx] ?? "n/a"})`,
      value: formatValue(maleYoy.latest, unit),
      delta: maleYoy.delta,
      goodDirection: 1,
    },
    {
      label: `Female — latest (${DATA.periods[femaleYoy.latestIdx] ?? "n/a"})`,
      value: formatValue(femaleYoy.latest, unit),
      delta: femaleYoy.delta,
      goodDirection: 1,
    },
    {
      label: "Gender gap (Male − Female)",
      value: formatValue(gapNow, unit),
      delta: gapDelta,
      goodDirection: -1, // a shrinking gap is the favourable direction
      deltaLabel: "vs 12 mo. ago",
    },
  ];

  const row = document.getElementById("kpi-row");
  row.innerHTML = "";
  for (const t of tiles) {
    const div = document.createElement("div");
    div.className = "kpi-tile";
    let deltaClass = "flat";
    let arrow = "→";
    if (t.delta !== null && Math.abs(t.delta) >= 0.05) {
      const rising = t.delta > 0;
      const favourable = rising === (t.goodDirection > 0);
      deltaClass = favourable ? "up" : "down";
      arrow = rising ? "↑" : "↓";
    }
    div.innerHTML = `
      <div class="kpi-label">${t.label}</div>
      <div class="kpi-value">${t.value} <small>${unit}</small></div>
      <div class="kpi-delta ${deltaClass}">${arrow} ${formatDelta(t.delta, unit)} <span class="hint">${t.deltaLabel ?? "vs 12 mo. ago"}</span></div>
    `;
    row.appendChild(div);
  }
}

function renderMainChart() {
  const unit = DATA.meta.units[state.metric];
  const label = DATA.meta.labels[state.metric];
  const male = getSeries(DATA, state.metric, state.projection, state.region, "M");
  const female = getSeries(DATA, state.metric, state.projection, state.region, "F");
  const dates = DATA.period_dates;

  const traces = [
    {
      x: dates,
      y: male,
      name: "Male",
      mode: "lines",
      line: { color: cssVar("--series-male"), width: 2 },
      connectgaps: false,
      hovertemplate: `%{y:.1f}${unit === "%" ? "%" : ""}<extra>Male</extra>`,
    },
    {
      x: dates,
      y: female,
      name: "Female",
      mode: "lines",
      line: { color: cssVar("--series-female"), width: 2 },
      connectgaps: false,
      hovertemplate: `%{y:.1f}${unit === "%" ? "%" : ""}<extra>Female</extra>`,
    },
  ];

  const layout = plotlyBaseLayout({
    margin: { l: 52, r: 20, t: 10, b: 70 },
    yaxis: {
      gridcolor: cssVar("--gridline"),
      linecolor: cssVar("--baseline"),
      zeroline: false,
      tickfont: { color: cssVar("--text-muted") },
      title: { text: `${label} (${unit})`, font: { size: 11, color: cssVar("--text-muted") } },
    },
    xaxis: {
      gridcolor: cssVar("--gridline"),
      linecolor: cssVar("--baseline"),
      zeroline: false,
      tickfont: { color: cssVar("--text-muted") },
      type: "date",
      rangeslider: { visible: true, thickness: 0.08 },
      rangeselector: {
        buttons: [
          { count: 2, label: "2y", step: "year", stepmode: "backward" },
          { count: 5, label: "5y", step: "year", stepmode: "backward" },
          { step: "all", label: "All" },
        ],
        y: 1.12,
        x: 1,
        xanchor: "right",
        font: { color: cssVar("--text-secondary") },
        bgcolor: cssVar("--surface-2"),
        activecolor: cssVar("--accent-wash"),
      },
    },
  });

  Plotly.react("main-chart", traces, layout, PLOTLY_CONFIG);
}

function renderRankingChart() {
  const unit = DATA.meta.units[state.metric];
  const rows = DATA.regions.map((r) => {
    const male = getSeries(DATA, state.metric, state.projection, r.code, "M");
    const female = getSeries(DATA, state.metric, state.projection, r.code, "F");
    const mIdx = lastValidIndex(male);
    const fIdx = lastValidIndex(female);
    const mVal = mIdx >= 0 ? male[mIdx] : null;
    const fVal = fIdx >= 0 ? female[fIdx] : null;
    const avg = mVal !== null && fVal !== null ? (mVal + fVal) / 2 : (mVal ?? fVal);
    return { code: r.code, name: r.name, mVal, fVal, avg };
  });
  rows.sort((a, b) => (b.avg ?? -Infinity) - (a.avg ?? -Infinity));

  const names = rows.map((r) => r.name);
  const maleColors = rows.map(() => cssVar("--series-male"));
  const femaleColors = rows.map(() => cssVar("--series-female"));
  const lineWidths = rows.map((r) => (r.code === state.region ? 2 : 0));

  const traces = [
    {
      y: names,
      x: rows.map((r) => r.mVal),
      name: "Male",
      type: "bar",
      orientation: "h",
      marker: {
        color: maleColors,
        line: { color: cssVar("--text-primary"), width: lineWidths },
      },
      hovertemplate: `%{x:.1f}${unit === "%" ? "%" : ""}<extra>Male</extra>`,
    },
    {
      y: names,
      x: rows.map((r) => r.fVal),
      name: "Female",
      type: "bar",
      orientation: "h",
      marker: {
        color: femaleColors,
        line: { color: cssVar("--text-primary"), width: lineWidths },
      },
      hovertemplate: `%{x:.1f}${unit === "%" ? "%" : ""}<extra>Female</extra>`,
    },
  ];

  const layout = plotlyBaseLayout({
    barmode: "group",
    margin: { l: 150, r: 20, t: 10, b: 40 },
    height: 480,
    hovermode: "closest",
    yaxis: {
      automargin: true,
      tickfont: { color: cssVar("--text-muted"), size: 11 },
      autorange: "reversed",
    },
    xaxis: {
      gridcolor: cssVar("--gridline"),
      linecolor: cssVar("--baseline"),
      zeroline: false,
      tickfont: { color: cssVar("--text-muted") },
    },
  });

  Plotly.react("ranking-chart", traces, layout, PLOTLY_CONFIG);

  const chartEl = document.getElementById("ranking-chart");
  chartEl.removeAllListeners?.("plotly_click");
  chartEl.on("plotly_click", (evt) => {
    const point = evt.points?.[0];
    if (!point) return;
    const row = rows[point.pointIndex];
    if (!row) return;
    state.region = row.code;
    document.getElementById("region-select").value = row.code;
    render();
  });
}

function render() {
  renderKpis();
  renderMainChart();
  renderRankingChart();
}

async function init() {
  initTheme();
  DATA = await loadSeries();
  populateRegionSelect();
  wireSegmented("metric-toggle", "metric");
  wireSegmented("projection-toggle", "projection");
  document.addEventListener("theme-changed", render);
  render();
}

init();
