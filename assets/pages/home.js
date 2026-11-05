// Overview: headline indicators and every year of inflation since 1944.
(function () {
  const { p, sp, spark, money, monthLabel, dayLabel } = AR;
  MH.shell("home");
  Promise.all([MH.load("overview"), MH.load("prices")]).then(([o, P]) => {
    document.getElementById("updated").textContent = `Data updated ${dayLabel(o.updated)}.`;
    const k = (label, value, sub, href, vals, color) =>
      `<a class="kpi" href="${href}"><span class="label">${label}</span><span class="value">${value}</span><span class="sub">${sub}</span>${vals ? spark(vals, { color }) : ""}</a>`;
    document.getElementById("kpis").innerHTML = [
      k("Monthly inflation", p(o.inflationMonthly[1]), monthLabel(o.inflationMonthly[0]), "inflation/", o.inflationSpark, "var(--s2)"),
      k("Inflation, last 12 months", p(o.inflationYoy[1]), `to ${monthLabel(o.inflationYoy[0])}`, "inflation/", P.yoy.slice(-36).map((x) => x[1]), "var(--s2)"),
      k("Official dollar", money(o.official[1]), `retail, ${dayLabel(o.official[0])}`, "dollar/"),
      k("Blue dollar", money(o.blue[1]), `gap over the official rate ${sp(o.gap * 100)}`, "dollar/"),
      k("MEP dollar", money(o.mep[1]), `CCL ${money(o.ccl[1])}`, "dollar/"),
      k("Country risk", `${o.risk[1].toLocaleString("en-US")} bp`, dayLabel(o.risk[0]), "money/", o.riskSpark, "var(--s8)"),
      k("Central Bank reserves", `US$${(o.reserves[1] / 1000).toFixed(1)}B`, `gross, ${monthLabel(o.reserves[0])}`, "money/", o.reservesSpark, "var(--s3)"),
      k("Economic activity", o.emae[1].toFixed(1), `EMAE, 2004 = 100, ${monthLabel(o.emae[0])}`, "economy/", o.emaeSpark, "var(--s1)"),
      k("Unemployment", p(o.unemployment[1]), `quarter from ${monthLabel(o.unemployment[0])}`, "economy/", o.unemploymentSpark, "var(--s7)"),
      k("Poverty", p(o.poverty[1]), `of people, half-year from ${monthLabel(o.poverty[0])}`, "economy/", o.povertySpark, "var(--s8)"),
      k("Real wages", o.wages[1].toFixed(1), `Jan 2017 = 100, ${monthLabel(o.wages[0])}`, "economy/", o.wagesSpark, "var(--s1)"),
      k("30-day deposit rate", p(o.deposit[1]), `a year; real return ${sp(o.realDeposit[1])} a year`, "money/"),
      k("Expected inflation", p(o.expectations[1]), `next 12 months, analysts' median`, "inflation/"),
      k("Minimum wage", money(o.minWage[1]), `a month, ${monthLabel(o.minWage[0])}`, "economy/"),
    ].join("");

    AR.inflationGrid(document.getElementById("grid"), P.annual, { onPick: (y) => { location.href = `inflation/?year=${y}`; } });
    AR.inflationLegend(document.getElementById("grid-legend"));
    const full = P.annual.filter((a) => !a[2]);
    const worst = d3.greatest(full, (a) => a[1]), lowest = d3.least(full, (a) => a[1]);
    const total = P.index.at(-1)[1] / P.index[0][1];
    // 4.1 × 10¹⁶, with superscript digits
    const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    const sci = (v) => { const e = Math.floor(Math.log10(v)); return `× ${(v / 10 ** e).toFixed(1)} × 10${String(e).split("").map((c) => SUP[+c]).join("")}`; };
    document.getElementById("infl-facts").innerHTML = [
      ["Highest year", `${worst[0]}: ${p(worst[1] * 100, 0)}`, "hyperinflation"],
      ["Lowest year", `${lowest[0]}: ${p(lowest[1] * 100, 1)}`, "under convertibility"],
      ["Years over 100%", String(full.filter((a) => a[1] >= 1).length), `of ${full.length}`],
      ["Years under 10%", String(full.filter((a) => a[1] < 0.1).length), `of ${full.length}`],
      ["Prices since 1943", sci(total), "while the currency lost 13 zeros"],
    ].map(([a, b, c]) => `<div class="tile"><p class="label">${a}</p><div class="value">${b}</div><div class="delta"><span>${c}</span></div></div>`).join("");
  }).catch(MH.fail);
})();
