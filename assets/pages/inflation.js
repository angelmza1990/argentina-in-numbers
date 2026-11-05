// Inflation: monthly and 12-month rates in any period, a year in detail, categories, core and expectations.
(function () {
  const { p, sp, month, monthLabel, INDEC_BAND } = AR;
  MH.shell("inflation");
  const $ = (id) => document.getElementById(id);

  MH.load("prices").then((P) => {
    const lastM = P.monthly.at(-1)[0];
    $("updated").textContent = `Latest month: ${monthLabel(lastM)}.`;
    const lastY = +lastM.slice(0, 4);

    /* ---------- main chart ---------- */
    const PERIODS = [["3", "Last 3 years"], ["10", "Last 10 years"], ["2002", "Since 2002"], ["1943", "Since 1943"]];
    const state = { period: "10", measure: "monthly" };
    MH.seg($("period"), PERIODS, state.period, (v) => { state.period = v; main(); });
    MH.seg($("measure"), [["monthly", "Monthly rate"], ["yoy", "Last 12 months"]], state.measure, (v) => { state.measure = v; main(); });
    function main() {
      const from = state.period === "1943" ? "1943-01" : state.period === "2002" ? "2002-01" : `${lastY - +state.period}-${lastM.slice(5, 7)}`;
      const rows = (state.measure === "monthly" ? P.monthly : P.yoy).filter((r) => r[0] >= from);
      const log = state.measure === "yoy" && (state.period === "1943" || state.period === "2002");
      const vals = rows.filter((r) => !log || r[1] > 0).map((r) => [month(r[0]), r[1]]);
      MH.lineChart($("main"), {
        series: [{ id: "i", name: state.measure === "monthly" ? "Monthly inflation" : "12-month inflation", color: "var(--s2)", values: vals }],
        height: 340, endLabels: false, log, area: !log, baseline: log ? null : 0,
        yFormat: (v) => p(v, Math.abs(v) < 10 && v % 1 ? 1 : 0), tipFormat: (v) => p(v, 1), recessions: INDEC_BAND,
        annotations: from <= "1989-07" ? [{ date: new Date(1989, 6, 1), label: "1989 hyperinflation" }, { date: new Date(1991, 3, 1), label: "Convertibility" }, { date: new Date(2002, 0, 1), label: "Devaluation" }].filter((a) => a.date >= month(from)) : [],
        label: "Inflation",
      });
      const peak = d3.greatest(rows, (r) => r[1]);
      $("main-note").textContent = `Highest in the period: ${p(peak[1], 1)} in ${monthLabel(peak[0])}. ${log ? "Logarithmic scale; months with deflation are left out. " : ""}The shaded years, 2007–2015, are when the official index is widely considered to have understated inflation.`;
    }
    main();

    /* ---------- one year ---------- */
    const years = [...new Set(P.monthly.map((r) => +r[0].slice(0, 4)))].sort((a, b) => b - a);
    const sel = $("year");
    sel.replaceChildren(...years.map((y) => new Option(y, y)));
    const q = +new URLSearchParams(location.search).get("year");
    sel.value = years.includes(q) ? q : lastY;
    sel.addEventListener("change", () => year(+sel.value));
    function year(y) {
      sel.value = y;
      history.replaceState(null, "", `?year=${y}`);
      const rows = P.monthly.filter((r) => +r[0].slice(0, 4) === y);
      const total = rows.reduce((a, r) => a * (1 + r[1] / 100), 1) - 1;
      const max = d3.greatest(rows, (r) => r[1]), min = d3.least(rows, (r) => r[1]);
      $("year-tiles").innerHTML = [
        [rows.length === 12 ? "Year" : `Year to ${monthLabel(rows.at(-1)[0])}`, p(total * 100, 1)],
        ["Average month", p((Math.pow(1 + total, 1 / rows.length) - 1) * 100, 2)],
        ["Highest month", `${p(max[1])} in ${monthLabel(max[0]).slice(0, 3)}`],
        ["Lowest month", `${p(min[1])} in ${monthLabel(min[0]).slice(0, 3)}`],
        ["Prices doubled every", total > 0 ? doubling(total, rows.length) : "–"],
      ].map(([a, b]) => `<div class="tile"><p class="label">${a}</p><div class="value">${b}</div></div>`).join("");
      $("year-title").textContent = `Monthly inflation in ${y}`;
      MH.responsive($("year-bars"), (W) => {
        const H = 240, m = { t: 22, r: 8, b: 26, l: 8 };
        const x = d3.scaleBand().domain(rows.map((r) => r[0])).range([m.l, W - m.r]).padding(0.25);
        const ymax = d3.max(rows, (r) => r[1]), ymin = Math.min(0, d3.min(rows, (r) => r[1]));
        const yy = d3.scaleLinear().domain([ymin, ymax]).range([H - m.b, m.t]);
        const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", `Monthly inflation in ${y}`);
        rows.forEach((r) => {
          const x0 = x(r[0]), h = Math.abs(yy(r[1]) - yy(0));
          svg.append("rect").attr("x", x0).attr("width", x.bandwidth()).attr("y", Math.min(yy(0), yy(r[1]))).attr("height", Math.max(1, h)).attr("rx", 2)
            .attr("fill", r[1] < 0 ? "var(--s1)" : "var(--s2)");
          svg.append("text").attr("x", x0 + x.bandwidth() / 2).attr("y", r[1] >= 0 ? yy(r[1]) - 6 : yy(r[1]) + 14).attr("text-anchor", "middle").text(p(r[1], r[1] >= 100 ? 0 : 1));
          svg.append("text").attr("x", x0 + x.bandwidth() / 2).attr("y", H - 8).attr("text-anchor", "middle").style("fill", "var(--muted)").text(monthLabel(r[0]).slice(0, 3));
        });
        svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", yy(0)).attr("y2", yy(0)).attr("stroke", "var(--ink-2)");
        $("year-bars").replaceChildren(svg.node());
      });
    }
    // Months for prices to double at the year's average pace.
    function doubling(total, n) {
      const g = Math.pow(1 + total, 1 / n);
      const months = Math.log(2) / Math.log(g);
      return months < 1 ? `${Math.round(months * 30)} days` : months < 24 ? `${months.toFixed(1)} months` : `${(months / 12).toFixed(1)} years`;
    }
    year(+sel.value);

    AR.inflationGrid($("grid"), P.annual, { onPick: (y) => { year(y); $("year").scrollIntoView({ behavior: "smooth", block: "center" }); } });
    AR.inflationLegend($("grid-legend"));

    /* ---------- categories ---------- */
    const months = P.all.map((r) => r[0]);
    AR.monthOptions($("cat-from"), months.slice(0, -1), months[Math.max(0, months.length - 13)]);
    AR.monthOptions($("cat-to"), months.slice(1), months.at(-1));
    $("cat-from").addEventListener("change", cats);
    $("cat-to").addEventListener("change", cats);
    function cats() {
      let a = $("cat-from").value, b = $("cat-to").value;
      if (a >= b) { a = months[months.indexOf(b) - 1]; $("cat-from").value = a; }
      const ch = (rows) => { const m = new Map(rows); return m.get(b) / m.get(a) - 1; };
      const list = P.categories.map((c) => ({ label: c.label, v: ch(c.values) })).sort((x, y) => y.v - x.v);
      const all = ch(P.all);
      $("cat-sub").textContent = `Price rise from ${monthLabel(a)} to ${monthLabel(b)}, by category of INDEC's national CPI. All items: ${p(all * 100, 1)}.`;
      MH.responsive($("cat-bars"), (W) => {
        const narrow = W < 560, row = 30, m = { t: 8, r: 64, b: 8, l: narrow ? 150 : 270 };
        const H = m.t + m.b + row * list.length;
        const x = d3.scaleLinear().domain([Math.min(0, d3.min(list, (d) => d.v)), d3.max(list, (d) => d.v)]).range([m.l, W - m.r]);
        const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Price rise by category");
        list.forEach((d, i) => {
          const y0 = m.t + i * row;
          svg.append("text").attr("x", m.l - 8).attr("y", y0 + row / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(narrow && d.label.length > 24 ? d.label.slice(0, 22) + "…" : d.label);
          svg.append("rect").attr("x", Math.min(x(0), x(d.v))).attr("y", y0 + 6).attr("height", row - 12).attr("width", Math.max(1, Math.abs(x(d.v) - x(0)))).attr("rx", 2)
            .attr("fill", d.v > all ? "var(--s2)" : "var(--s1)");
          svg.append("text").attr("x", x(Math.max(0, d.v)) + 6).attr("y", y0 + row / 2).attr("dy", "0.35em").text(p(d.v * 100, 1));
        });
        svg.append("line").attr("x1", x(all)).attr("x2", x(all)).attr("y1", 0).attr("y2", H).attr("stroke", "var(--ink)").attr("stroke-dasharray", "3 3");
        svg.append("text").attr("x", x(all) + 4).attr("y", H - 2).style("fill", "var(--ink)").style("font-weight", 600).text("all items");
        $("cat-bars").replaceChildren(svg.node());
      });
    }
    cats();

    /* ---------- core and expectations ---------- */
    const yoy = (rows) => rows.map((r, i) => (i >= 12 ? [month(r[0]), (r[1] / rows[i - 12][1] - 1) * 100] : null)).filter(Boolean);
    MH.lineChart($("core"), {
      series: [
        { id: "all", name: "All items", color: "var(--ink-2)", values: yoy(P.all), width: 1.5 },
        { id: "core", name: "Core", color: "var(--s1)", values: yoy(P.core) },
        { id: "reg", name: "Regulated", color: "var(--s2)", values: yoy(P.regulated) },
      ],
      height: 280, yFormat: (v) => p(v, 0), tipFormat: (v) => p(v, 1), baseline: 0, label: "Core and regulated inflation", endLabels: false,
    });
    $("core-legend").innerHTML = AR.lineLegend([["var(--ink-2)", "All items"], ["var(--s1)", "Core"], ["var(--s2)", "Regulated"]]);
    const y12 = new Map(P.yoy);
    const later = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + 12, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
    MH.lineChart($("expect"), {
      series: [
        { id: "exp", name: "Expected, next 12 months", short: "Expected", color: "var(--s7)", values: P.expectations.filter((r) => r[0] >= "2016-06").map((r) => [month(r[0]), r[1]]) },
        { id: "act", name: "What followed", short: "Actual", color: "var(--s2)", values: P.expectations.filter((r) => r[0] >= "2016-06" && y12.has(later(r[0]))).map((r) => [month(r[0]), y12.get(later(r[0]))]) },
      ],
      height: 280, yFormat: (v) => p(v, 0), tipFormat: (v) => p(v, 1), baseline: 0, label: "Expected and actual inflation", endLabels: false,
    });
    $("expect-legend").innerHTML = AR.lineLegend([["var(--s7)", "Expected for the next 12 months"], ["var(--s2)", "Inflation in those 12 months"]]);
  }).catch(MH.fail);
})();
