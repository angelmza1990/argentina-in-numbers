// Argentina in Numbers — helpers shared by the pages: dates, pesos, sparklines and the inflation grid.
(function () {
  const { esc } = { esc: (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])) };
  const MINUS = "−";
  const month = (m) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 15);
  const day = (d) => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const fmtM = d3.timeFormat("%b %Y");
  const fmtD = d3.timeFormat("%b %-d, %Y");
  const monthLabel = (m) => fmtM(month(m));
  const dayLabel = (d) => fmtD(day(d));

  /** Pesos: 1,234 / 12.3K / 4.5M / 6.7B / 8.9T, with the sign as a real minus. */
  function compact(v, d = 1) {
    if (v == null || !isFinite(v)) return "–";
    const a = Math.abs(v);
    const s = a >= 1e12 ? (a / 1e12).toFixed(d) + "T" : a >= 1e9 ? (a / 1e9).toFixed(d) + "B" : a >= 1e6 ? (a / 1e6).toFixed(d) + "M" : a >= 1e4 ? (a / 1e3).toFixed(d) + "K" : a.toLocaleString("en-US", { maximumFractionDigits: a < 10 ? 2 : 0 });
    return (v < 0 ? MINUS : "") + s;
  }
  const money = (v, d = 0) => (v == null || !isFinite(v) ? "–" : (v < 0 ? MINUS : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const usd = (v, d = 0) => (v == null || !isFinite(v) ? "–" : (v < 0 ? MINUS : "") + "US$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  /** A percentage already expressed in percent (2.7 -> "2.7%"). */
  const p = (v, d = 1) => (v == null || !isFinite(v) ? "–" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US").replace("-", MINUS) + "%" : v.toFixed(d).replace("-", MINUS) + "%");
  const sp = (v, d = 1) => (v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : v < 0 ? MINUS : "") + p(Math.abs(v), d));

  /** Inline sparkline SVG for a list of numbers. */
  function spark(values, { color = "var(--s1)", w = 120, h = 30, area = true } = {}) {
    const vals = values.filter((v) => v != null);
    if (vals.length < 2) return "";
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 2 - ((v - lo) / span) * (h - 4)]);
    const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("");
    const fill = area ? `<path d="${d}L${w},${h}L0,${h}Z" fill="${color}" opacity="0.1"/>` : "";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${fill}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="2.4" fill="${color}"/></svg>`;
  }

  // The official CPI is widely considered to have understated inflation between 2007 and 2015.
  const INDEC_BAND = [[new Date(2007, 0, 1), new Date(2015, 11, 31)]];

  /** Heat class for an annual inflation rate (a fraction: 0.25 = 25%). */
  function inflClass(v) {
    if (v == null) return "empty";
    if (v < 0) return "i-neg";
    if (v < 0.1) return "i-1";
    if (v < 0.25) return "i-2";
    if (v < 0.5) return "i-3";
    if (v < 1) return "i-4";
    if (v < 3) return "i-5";
    return "i-6";
  }
  const INFL_LEGEND = [["i-neg", "Deflation"], ["i-1", "Under 10%"], ["i-2", "10–25%"], ["i-3", "25–50%"], ["i-4", "50–100%"], ["i-5", "100–300%"], ["i-6", "300% or more"]];

  const cell = (v) => {
    const t = v >= 1000 ? Math.round(v).toLocaleString("en-US") : Math.abs(v) >= 10 ? String(Math.round(v)) : v.toFixed(1);
    return t === "-0.0" ? "0.0" : t.replace("-", MINUS);
  };

  /** Decades as rows, years as columns: every calendar year's inflation, coloured by band. */
  function inflationGrid(el, annual, { onPick } = {}) {
    const by = new Map(annual.map((a) => [a[0], a]));
    const first = Math.floor(annual[0][0] / 10) * 10, last = annual.at(-1)[0];
    let html = `<table class="igrid"><thead><tr><th></th>${d3.range(10).map((i) => `<th>${i}</th>`).join("")}</tr></thead><tbody>`;
    for (let dec = first; dec <= last; dec += 10) {
      html += `<tr><th>${dec}s</th>`;
      for (let i = 0; i < 10; i++) {
        const y = dec + i, a = by.get(y);
        if (!a) { html += `<td class="empty"></td>`; continue; }
        const v = a[1] * 100, ytd = a[2];
        html += `<td class="${inflClass(a[1])}${ytd ? " ytd" : ""}" data-y="${y}" title="${y}${ytd ? ` (to ${monthLabel(ytd)})` : ""}: ${p(v, 1)}">${cell(v)}</td>`;
      }
      html += "</tr>";
    }
    el.innerHTML = html + "</tbody></table>";
    if (onPick) el.querySelectorAll("td[data-y]").forEach((td) => td.addEventListener("click", () => onPick(+td.dataset.y)));
  }
  function inflationLegend(el) {
    el.className = "legend";
    el.innerHTML = INFL_LEGEND.map(([c, l]) => `<span class="key"><span class="sw ${c}"></span>${l}</span>`).join("") + `<span class="muted">Dashed: year to date.</span>`;
  }

  /** Fill a <select> with months from a list of "YYYY-MM". */
  function monthOptions(sel, months, value) {
    sel.replaceChildren(...months.map((m) => new Option(monthLabel(m), m)));
    sel.value = value;
  }

  /** A legend of coloured lines: [[color, label], ...]. */
  const lineLegend = (items) => `<div class="legend">${items.map(([c, l]) => `<span class="key"><span class="ln" style="background:${c}"></span>${l}</span>`).join("")}</div>`;

  window.AR = { lineLegend, month, day, monthLabel, dayLabel, compact, money, usd, p, sp, spark, INDEC_BAND, inflClass, inflationGrid, inflationLegend, monthOptions, esc };
})();
