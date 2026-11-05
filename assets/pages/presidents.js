// By presidency: the same indicators at the start and end of every term since 1983.
(function () {
  const { p, sp, money, usd, monthLabel, dayLabel } = AR;
  MH.shell("presidents");
  const $ = (id) => document.getElementById(id);

  MH.load("presidents").then((list) => {
    const years = (x) => (x.months / 12).toFixed(1);
    const term = (x) => `${dayLabel(x.start)} – ${x.end ? dayLabel(x.end) : "present"} · ${years(x)} years`;
    const change = (pair) => (pair ? pair[1][1] / pair[0][1] - 1 : null);
    const METRICS = [
      { key: "inflationYear", label: "Inflation a year", get: (x) => x.inflationYear * 100, fmt: (v) => p(v, 1), better: "low" },
      { key: "gdp", label: "GDP per person a year", get: (x) => (x.gdpPerCapYear == null ? null : x.gdpPerCapYear * 100), fmt: (v) => sp(v, 1), better: "high" },
      { key: "dollar", label: "Dollar (wholesale)", get: (x) => (x.dollar ? (x.dollar[1] / x.dollar[0] - 1) * 100 : null), fmt: (v) => sp(v, 0), better: "low" },
      { key: "reserves", label: "Reserves", get: (x) => (x.reserves ? (x.reserves[1][1] - x.reserves[0][1]) / 1000 : null), fmt: (v) => `${v >= 0 ? "+" : "−"}US$${Math.abs(v).toFixed(1)}B`, better: "high" },
      { key: "minWage", label: "Real minimum wage", get: (x) => (x.minWage ? change(x.minWage) * 100 : null), fmt: (v) => sp(v, 0), better: "high" },
      { key: "poverty", label: "Poverty (points)", get: (x) => (x.poverty ? x.poverty[1][1] - x.poverty[0][1] : null), fmt: (v) => sp(v, 1).replace("%", " pts"), better: "low" },
      { key: "unemployment", label: "Unemployment (points)", get: (x) => (x.unemployment ? x.unemployment[1][1] - x.unemployment[0][1] : null), fmt: (v) => sp(v, 1).replace("%", " pts"), better: "low" },
      { key: "risk", label: "Country risk", get: (x) => (x.risk ? x.risk[1][1] - x.risk[0][1] : null), fmt: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v)).toLocaleString("en-US")} bp`, better: "low" },
    ];
    let metric = "inflationYear";
    MH.seg($("metric"), METRICS.map((m) => [m.key, m.label]), metric, (v) => { metric = v; compare(); });

    function compare() {
      const M = METRICS.find((m) => m.key === metric);
      const rows = list.map((x) => ({ x, v: M.get(x) })).filter((d) => d.v != null && isFinite(d.v));
      MH.responsive($("compare"), (W) => {
        const narrow = W < 600, row = 34, m = { t: 6, r: 90, b: 6, l: narrow ? 120 : 230 };
        const H = m.t + m.b + row * rows.length;
        // Inflation and the dollar span two orders of magnitude, so they get a symmetric log scale.
        const sym = metric === "inflationYear" || metric === "dollar";
        const lo = Math.min(0, d3.min(rows, (d) => d.v)), hi = Math.max(0, d3.max(rows, (d) => d.v));
        const x = (sym ? d3.scaleSymlog().constant(10) : d3.scaleLinear()).domain([lo, hi]).range([m.l, W - m.r]);
        const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", `${M.label} by presidency`);
        rows.forEach((d, i) => {
          const y0 = m.t + i * row;
          const good = M.better === "high" ? d.v >= 0 : d.v <= 0;
          svg.append("text").attr("x", m.l - 10).attr("y", y0 + row / 2).attr("dy", "0.35em").attr("text-anchor", "end").style("font-weight", 600).text(narrow ? d.x.name.split(" ").slice(-1)[0] : d.x.name);
          svg.append("rect").attr("x", Math.min(x(0), x(d.v))).attr("width", Math.max(1.5, Math.abs(x(d.v) - x(0)))).attr("y", y0 + 7).attr("height", row - 14).attr("rx", 2)
            .attr("fill", metric === "inflationYear" ? "var(--s2)" : good ? "var(--pos-3)" : "var(--neg-3)");
          svg.append("text").attr("x", x(Math.max(0, d.v)) + 6).attr("y", y0 + row / 2).attr("dy", "0.35em").text(M.fmt(d.v));
        });
        svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", H).attr("stroke", "var(--ink-2)");
        $("compare").replaceChildren(svg.node());
      });
      $("compare-note").textContent = metric === "inflationYear" ? "Average annual inflation over the term, compressed (symmetric log) scale." :
        metric === "dollar" ? "Change in the wholesale rate over the term, compressed scale; one peso per dollar under convertibility (1991–2001)." : metric === "gdp" ? "Average annual change in real GDP per person over the calendar years each president governed most of." :
        `Change from the start to the end of each term. ${M.better === "high" ? "Blue: a rise" : "Blue: a fall"}; red: the opposite.`;
    }
    compare();

    const cell = (l, v, s = "") => `<div><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    const span = (pair, f) => (pair ? `${f(pair[0][1])} → ${f(pair[1][1])}` : "");
    $("list").innerHTML = list.slice().reverse().map((x) => `
      <article class="pres-card">
        <div class="pres-head"><h3>${x.name}</h3><span>${x.party} · ${term(x)}</span></div>
        <div class="pres-grid">
          ${cell("Inflation in the term", p(x.inflation * 100, x.inflation >= 10 ? 0 : 1), `${p(x.inflationYear * 100, 1)} a year`)}
          ${x.gdpPerCapYear != null ? cell("GDP per person", sp(x.gdpPerCapYear * 100, 1) + " a year", `${x.gdpYears[0]}–${x.gdpYears[1]}`) : ""}
          ${x.dollar ? cell("Wholesale dollar", sp((x.dollar[1] / x.dollar[0] - 1) * 100, 0), `${money(x.dollar[0], 2)} → ${money(x.dollar[1], 0)}`) : ""}
          ${x.reserves ? cell("Reserves", `US$${(x.reserves[1][1] / 1000).toFixed(1)}B`, `from US$${(x.reserves[0][1] / 1000).toFixed(1)}B`) : ""}
          ${x.risk ? cell("Country risk", `${x.risk[1][1].toLocaleString("en-US")} bp`, `from ${x.risk[0][1].toLocaleString("en-US")} bp`) : ""}
          ${x.unemployment ? cell("Unemployment", p(x.unemployment[1][1]), `from ${p(x.unemployment[0][1])}`) : ""}
          ${x.poverty ? cell("Poverty", p(x.poverty[1][1]), `from ${p(x.poverty[0][1])}`) : ""}
          ${x.minWage ? cell("Real minimum wage", sp(change(x.minWage) * 100, 0), span(x.minWage, (v) => money(v)) + " today's pesos") : ""}
        </div>
      </article>`).join("");
  }).catch(MH.fail);
})();
