// Economy: GDP, activity, jobs, poverty, real wages, minimum wage and pension, trade and the fiscal balance.
(function () {
  const { p, sp, money, compact, month, monthLabel, INDEC_BAND } = AR;
  MH.shell("economy");
  const $ = (id) => document.getElementById(id);
  const yr = (y) => new Date(y, 6, 1);

  MH.load("economy").then((E) => {
    $("updated").textContent = `Pesos at prices of ${monthLabel(E.priceBase)}.`;

    /* ---------- GDP ---------- */
    const pc = E.gdpPerCapReal, g = E.gdpGrowth;
    const peak = d3.greatest(pc, (r) => r[1]);
    const recessions = g.filter((r) => r[1] < 0).length;
    const decadeGrowth = (a, b) => { const x = new Map(pc); return x.get(b) && x.get(a) ? (Math.pow(x.get(b) / x.get(a), 1 / (b - a)) - 1) * 100 : null; };
    $("gdp-tiles").innerHTML = [
      ["GDP per person, " + pc.at(-1)[0], AR.usd(pc.at(-1)[1]), `peak ${AR.usd(peak[1])} in ${peak[0]}`],
      ["Growth since 1960", sp(decadeGrowth(1960, pc.at(-1)[0]), 2), "a year, per person"],
      ["Years of recession", `${recessions} of ${g.length}`, "GDP fell"],
      ["Worst year", `${d3.least(g, (r) => r[1])[0]}: ${sp(d3.least(g, (r) => r[1])[1])}`, ""],
      ["GDP, " + E.gdp.at(-1)[0], `US$${Math.round(E.gdp.at(-1)[1])}B`, `population ${(E.population.at(-1)[1] / 1e6).toFixed(1)} million`],
    ].map(([a, b, c]) => `<div class="tile"><p class="label">${a}</p><div class="value">${b}</div><div class="delta"><span>${c}</span></div></div>`).join("");
    MH.lineChart($("gdppc"), { series: [{ id: "pc", name: "GDP per person", color: "var(--s1)", values: pc.map((r) => [yr(r[0]), r[1]]) }], height: 280, endLabels: false, yFormat: (v) => AR.usd(v), tipFormat: (v) => AR.usd(v), tipDate: d3.timeFormat("%Y"), label: "GDP per person" });
    MH.barChart($("growth"), { data: g.map((r) => ({ year: r[0], value: r[1] / 100 })), height: 280, name: "GDP growth", label: "GDP growth" });

    /* ---------- EMAE ---------- */
    const em = E.emae;
    MH.lineChart($("emae"), { series: [{ id: "emae", name: "EMAE", color: "var(--s1)", values: em.map((r) => [month(r[0]), r[1]]) }], height: 300, endLabels: false, yFormat: (v) => v.toFixed(0), tipFormat: (v) => v.toFixed(1), label: "Monthly activity" });
    const last = em.at(-1), yearAgo = em.at(-13), top = d3.greatest(em, (r) => r[1]);
    $("emae-note").textContent = `${monthLabel(last[0])}: ${sp((last[1] / yearAgo[1] - 1) * 100)} against a year earlier; the highest month on record was ${monthLabel(top[0])} (${top[1].toFixed(1)}).`;

    /* ---------- jobs and poverty ---------- */
    MH.lineChart($("unemp"), { series: [{ id: "u", name: "Unemployment", color: "var(--s7)", values: AR.breakGaps(E.unemployment.map((r) => [month(r[0]), r[1]])) }], height: 260, endLabels: false, baseline: 0, yFormat: (v) => p(v, 0), tipFormat: (v) => p(v), label: "Unemployment" });
    MH.lineChart($("poverty"), {
      series: [{ id: "pp", name: "People", color: "var(--s8)", values: AR.breakGaps(E.poverty.map((r) => [month(r[0]), r[1]])) }, { id: "ph", name: "Households", color: "var(--s4)", values: AR.breakGaps(E.povertyHouseholds.map((r) => [month(r[0]), r[1]])) }],
      height: 260, endLabels: false, baseline: 0, yFormat: (v) => p(v, 0), tipFormat: (v) => p(v), label: "Poverty",
    });
    $("poverty-legend").innerHTML = AR.lineLegend([["var(--s8)", "People"], ["var(--s4)", "Households"]]);

    /* ---------- real wages ---------- */
    const W = E.wagesReal;
    MH.lineChart($("wages"), {
      series: [
        { id: "all", name: "All workers", color: "var(--ink-2)", values: W.wages.map((r) => [month(r[0]), r[1]]), width: 1.5 },
        { id: "priv", name: "Registered private", color: "var(--s1)", values: W.wagesPrivate.map((r) => [month(r[0]), r[1]]) },
        { id: "pub", name: "Public sector", color: "var(--s2)", values: W.wagesPublic.map((r) => [month(r[0]), r[1]]) },
      ],
      height: 300, endLabels: false, yFormat: (v) => v.toFixed(0), tipFormat: (v) => v.toFixed(1), annotations: [], label: "Real wages",
    });
    $("wages-legend").innerHTML = AR.lineLegend([["var(--ink-2)", "All workers (includes unregistered)"], ["var(--s1)", "Registered private sector"], ["var(--s2)", "Public sector"]]);

    /* ---------- minimum wage, pension, poverty line ---------- */
    const mw = E.minWageReal, pen = E.pensionReal;
    const mwNow = mw.at(-1), mwPeak = d3.greatest(mw, (r) => r[1]);
    $("min-sub").textContent = `In pesos of ${monthLabel(E.priceBase)}. The minimum wage is ${money(mwNow[1])} today, ${Math.round((1 - mwNow[1] / mwPeak[1]) * 100)}% below its highest, ${money(mwPeak[1])} in ${monthLabel(mwPeak[0])}.`;
    MH.lineChart($("minwage"), {
      series: [
        { id: "mw", name: "Minimum wage", color: "var(--s1)", values: AR.breakGaps(mw.map((r) => [month(r[0]), r[1]]), 62) },
        { id: "pen", name: "Minimum pension", color: "var(--s3)", values: pen.map((r) => [month(r[0]), r[1]]) },
        { id: "pl", name: "Poverty line, one adult", color: "var(--s8)", values: E.povertyLineReal.map((r) => [month(r[0]), r[1]]), width: 1.5 },
      ],
      height: 340, endLabels: false, log: true, yFormat: (v) => `$${compact(v, 0)}`, tipFormat: (v) => money(v), recessions: INDEC_BAND, label: "Minimum wage and pension at today's prices",
    });
    $("min-legend").innerHTML = AR.lineLegend([["var(--s1)", "Minimum wage"], ["var(--s3)", "Minimum pension"], ["var(--s8)", "Poverty line, one adult (since 2016)"]]) + `<p class="note" style="margin:4px 0 0">Logarithmic scale.</p>`;

    /* ---------- trade ---------- */
    const t = E.trade, roll = [];
    for (let i = 11; i < t.length; i++) {
      const win = t.slice(i - 11, i + 1);
      roll.push([month(t[i][0]), d3.sum(win, (r) => r[1]) / 1000, d3.sum(win, (r) => r[2]) / 1000]);
    }
    MH.lineChart($("trade"), {
      series: [{ id: "x", name: "Exports", color: "var(--s3)", values: roll.map((r) => [r[0], r[1]]) }, { id: "m", name: "Imports", color: "var(--s2)", values: roll.map((r) => [r[0], r[2]]) }],
      height: 260, endLabels: false, baseline: 0, yFormat: (v) => `$${v.toFixed(0)}B`, tipFormat: (v) => `US$${v.toFixed(1)}B`, label: "Exports and imports",
    });
    $("trade-legend").innerHTML = AR.lineLegend([["var(--s3)", "Exports"], ["var(--s2)", "Imports"]]);
    MH.lineChart($("exports"), {
      series: [{ id: "x", name: "Exports", color: "var(--s3)", values: E.tradeYear.filter((r) => r[1] > 0).map((r) => [yr(r[0]), r[1] / 1000]) }],
      height: 260, endLabels: false, log: true, yFormat: (v) => `$${v >= 1 ? v.toFixed(0) : v.toFixed(1)}B`, tipFormat: (v) => `US$${v.toFixed(2)}B`, tipDate: d3.timeFormat("%Y"), label: "Exports since 1910",
    });

    /* ---------- fiscal ---------- */
    MH.lineChart($("primary"), {
      series: [{ id: "pr", name: "Primary balance, 12 months", color: "var(--s1)", values: E.primary12m.map((r) => [month(r[0]), r[1] / 1e6]) }],
      height: 280, endLabels: false, baseline: 0, area: true, yFormat: (v) => `$${compact(v * 1e12, 0)}`, tipFormat: (v) => `$${compact(v * 1e12, 1)}`, label: "Primary balance",
    });
  }).catch(MH.fail);
})();
