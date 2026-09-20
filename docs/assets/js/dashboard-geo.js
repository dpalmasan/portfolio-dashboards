/* Dashboard 2: Geographic — regional breakdown of employment indicators. */

let DATA = null;
let GEOJSON = null;
let latestIdx = 0;

const state = {
  metric: "occupancy_rate",
  projection: "2017",
  sex: "M",
  periodIdx: 0,
  region: "NAT",
};

const SEQ_COLORSCALE = [
  [0, "#cde2fb"],
  [0.15, "#9ec5f4"],
  [0.3, "#6da7ec"],
  [0.45, "#3987e5"],
  [0.6, "#256abf"],
  [0.75, "#1c5cab"],
  [0.9, "#184f95"],
  [1, "#0d366b"],
];

function regionByCode(code) {
  if (code === "NAT") return { code: "NAT", name: "Nationwide total", codregion: 0 };
  return DATA.regions.find((r) => r.code === code);
}

function regionByCodregion(codregion) {
  return DATA.regions.find((r) => r.codregion === codregion);
}

function valuesAtSnapshot() {
  return DATA.regions.map((r) => {
    const series = getSeries(DATA, state.metric, state.projection, r.code, state.sex);
    return { ...r, value: series[state.periodIdx] ?? null };
  });
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
    renderDetail();
    renderMap();
  });
}

function wireSegmented(containerId, key) {
  const container = document.getElementById(containerId);
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state[key] = btn.dataset.value;
      renderAll();
    });
  });
}

function setupPeriodSlider() {
  const nat2017 = getSeries(DATA, state.metric, state.projection, "NAT", state.sex);
  latestIdx = lastValidIndex(nat2017);
  state.periodIdx = latestIdx;

  const slider = document.getElementById("period-slider");
  slider.min = "0";
  slider.max = String(DATA.periods.length - 1);
  slider.value = String(state.periodIdx);
  slider.addEventListener("input", () => {
    state.periodIdx = Number(slider.value);
    document.getElementById("period-label").textContent = DATA.periods[state.periodIdx];
    renderSnapshot();
  });
  document.getElementById("period-label").textContent = DATA.periods[state.periodIdx];
}

function renderKpis(rows) {
  const unit = DATA.meta.units[state.metric];
  const nat = getSeries(DATA, state.metric, state.projection, "NAT", state.sex);
  const nowVal = nat[state.periodIdx];
  const prevVal = state.periodIdx > 0 ? nat[state.periodIdx - 1] : null;
  const delta = nowVal != null && prevVal != null ? nowVal - prevVal : null;

  const valid = rows.filter((r) => r.value !== null);
  const top = valid.reduce((a, b) => (b.value > a.value ? b : a), valid[0]);
  const bottom = valid.reduce((a, b) => (b.value < a.value ? b : a), valid[0]);

  const tiles = [
    { label: "National value (snapshot)", value: formatValue(nowVal, unit), sub: null, delta },
    { label: "Highest region", value: formatValue(top?.value, unit), sub: top?.name },
    { label: "Lowest region", value: formatValue(bottom?.value, unit), sub: bottom?.name },
  ];

  const row = document.getElementById("kpi-row");
  row.innerHTML = "";
  for (const t of tiles) {
    const div = document.createElement("div");
    div.className = "kpi-tile";
    let deltaHtml = "";
    if (t.delta !== undefined) {
      let cls = "flat";
      let arrow = "→";
      if (t.delta !== null && Math.abs(t.delta) >= 0.05) {
        cls = t.delta > 0 ? "up" : "down";
        arrow = t.delta > 0 ? "↑" : "↓";
      }
      deltaHtml = `<div class="kpi-delta ${cls}">${arrow} ${formatDelta(t.delta, unit)} <span class="hint">vs previous period</span></div>`;
    }
    div.innerHTML = `
      <div class="kpi-label">${t.label}</div>
      <div class="kpi-value">${t.value} <small>${unit}</small></div>
      ${t.sub ? `<div class="hint">${t.sub}</div>` : ""}
      ${deltaHtml}
    `;
    row.appendChild(div);
  }
}

function renderMap(rows) {
  rows = rows ?? valuesAtSnapshot();
  const unit = DATA.meta.units[state.metric];
  const locations = rows.map((r) => r.codregion);
  const z = rows.map((r) => r.value);
  const text = rows.map((r) => r.name);

  const trace = {
    type: "choropleth",
    geojson: GEOJSON,
    featureidkey: "properties.codregion",
    locations,
    z,
    text,
    colorscale: SEQ_COLORSCALE,
    marker: { line: { color: cssVar("--surface-1"), width: 1 } },
    colorbar: {
      title: { text: unit, font: { size: 11, color: cssVar("--text-muted") } },
      tickfont: { color: cssVar("--text-muted"), size: 10 },
      thickness: 12,
    },
    hovertemplate: `<b>%{text}</b><br>%{z:.1f}${unit === "%" ? "%" : ""}<extra></extra>`,
  };

  const selected = regionByCode(state.region);
  if (selected && selected.code !== "NAT") {
    trace.marker.line = {
      color: rows.map((r) =>
        r.code === state.region ? cssVar("--text-primary") : cssVar("--surface-1"),
      ),
      width: rows.map((r) => (r.code === state.region ? 2.5 : 1)),
    };
  }

  const layout = plotlyBaseLayout({
    margin: { l: 0, r: 0, t: 0, b: 0 },
    height: 520,
    geo: {
      fitbounds: "locations",
      visible: false,
      projection: { type: "mercator" },
      bgcolor: "rgba(0,0,0,0)",
    },
  });
  delete layout.xaxis;
  delete layout.yaxis;
  delete layout.hovermode;
  delete layout.legend;

  Plotly.react("geo-map", [trace], layout, PLOTLY_CONFIG);

  const mapEl = document.getElementById("geo-map");
  mapEl.removeAllListeners?.("plotly_click");
  mapEl.on("plotly_click", (evt) => {
    const point = evt.points?.[0];
    if (!point) return;
    const region = regionByCodregion(point.location);
    if (!region) return;
    state.region = region.code;
    document.getElementById("region-select").value = region.code;
    renderMap();
    renderDetail();
  });
}

function renderRanking(rows) {
  rows = rows ?? valuesAtSnapshot();
  const unit = DATA.meta.units[state.metric];
  const sorted = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  const colors = sorted.map((r) =>
    r.code === state.region ? cssVar("--accent") : cssVar("--seq-400"),
  );

  const trace = {
    type: "bar",
    orientation: "h",
    y: sorted.map((r) => r.name),
    x: sorted.map((r) => r.value),
    marker: { color: colors },
    hovertemplate: `%{x:.1f}${unit === "%" ? "%" : ""}<extra></extra>`,
  };

  const layout = plotlyBaseLayout({
    margin: { l: 150, r: 20, t: 10, b: 30 },
    height: 520,
    hovermode: "closest",
    showlegend: false,
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

  Plotly.react("ranking-chart", [trace], layout, PLOTLY_CONFIG);

  const chartEl = document.getElementById("ranking-chart");
  chartEl.removeAllListeners?.("plotly_click");
  chartEl.on("plotly_click", (evt) => {
    const point = evt.points?.[0];
    if (!point) return;
    const row = sorted[point.pointIndex];
    if (!row) return;
    state.region = row.code;
    document.getElementById("region-select").value = row.code;
    renderMap();
    renderDetail();
  });
}

function renderDetail() {
  const unit = DATA.meta.units[state.metric];
  const label = DATA.meta.labels[state.metric];
  const region = regionByCode(state.region);
  document.getElementById("detail-title").textContent = `${region.name} — trend detail`;

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
    },
    {
      x: dates,
      y: female,
      name: "Female",
      mode: "lines",
      line: { color: cssVar("--series-female"), width: 2 },
      connectgaps: false,
    },
  ];

  const layout = plotlyBaseLayout({
    height: 260,
    margin: { l: 48, r: 16, t: 10, b: 30 },
    yaxis: {
      gridcolor: cssVar("--gridline"),
      linecolor: cssVar("--baseline"),
      zeroline: false,
      tickfont: { color: cssVar("--text-muted") },
      title: { text: unit, font: { size: 11, color: cssVar("--text-muted") } },
    },
    xaxis: {
      gridcolor: cssVar("--gridline"),
      linecolor: cssVar("--baseline"),
      zeroline: false,
      tickfont: { color: cssVar("--text-muted") },
      type: "date",
    },
  });

  Plotly.react("detail-chart", traces, layout, PLOTLY_CONFIG);

  const tbody = document.getElementById("detail-table-body");
  tbody.innerHTML = "";
  const n = DATA.periods.length;
  const startIdx = Math.max(0, n - 12);
  for (let i = n - 1; i >= startIdx; i--) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${DATA.periods[i]}</td>
      <td>${formatValue(male[i], unit)}</td>
      <td>${formatValue(female[i], unit)}</td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById("detail-table-caption").textContent =
    `${label} by sex, most recent 12 periods for ${region.name}`;
}

function renderSnapshot() {
  const rows = valuesAtSnapshot();
  renderKpis(rows);
  renderMap(rows);
  renderRanking(rows);
}

function renderAll() {
  setupPeriodSlider();
  renderSnapshot();
  renderDetail();
}

async function init() {
  initTheme();
  [DATA, GEOJSON] = await Promise.all([loadSeries(), loadGeoJson()]);
  populateRegionSelect();
  wireSegmented("metric-toggle", "metric");
  wireSegmented("projection-toggle", "projection");
  wireSegmented("sex-toggle", "sex");
  document.addEventListener("theme-changed", renderAll);
  renderAll();
}

init();
