// Money & rates: reserves, country risk, deposit rates against inflation, money and credit.
(function () {
  const { p, sp, money, compact, month, day, monthLabel, dayLabel, INDEC_BAND } = AR;
  MH.shell("money");
  const $ = (id) => document.getElementById(id);

  Promise.all([MH.load("money"), MH.load("prices")]).then(([M, P]) => {
    $("updated").textContent = `Latest reserves: ${monthLabel(M.reserves.at(-1)[0])}; country risk: ${dayLabel(M.risk.at(-1)[0])}.`;

    /* ---------- reserves ---------- */
    const res = M.reserves.map((r) => [month(r[0]), r[1] / 1000]);
    const peak = d3.greatest(M.reserves, (r) => r[1]), low = d3.least(M.reserves.filter((r) => r[0] >= "2002"), (r) => r[1]);
    const yearAgo = M.reserves.at(-13);
    $("res-tiles").innerHTML = [
      ["Latest", `US$${(M.reserves.at(-1)[1] / 1000).toFixed(1)}B`, monthLabel(M.reserves.at(-1)[0])],
      ["A year earlier", `US$${(yearAgo[1] / 1000).toFixed(1)}B`, `${sp((M.reserves.at(-1)[1] / yearAgo[1] - 1) * 100)}`],
      ["Highest", `US$${(peak[1] / 1000).toFixed(1)}B`, monthLabel(peak[0])],
      ["Lowest since 2002", `US$${(low[1] / 1000).toFixed(1)}B`, monthLabel(low[0])],
    ].map(([a, b, c]) => `<div class="tile"><p class="label">${a}</p><div class="value">${b}</div><div class="delta"><span>${c}</span></div></div>`).join("");
    MH.lineChart($("reserves"), {
      series: [{ id: "r", name: "Gross reserves", color: "var(--s3)", values: res }], height: 320, endLabels: false, area: true, baseline: 0,
      yFormat: (v) => `$${v.toFixed(0)}B`, tipFormat: (v) => `US$${v.toFixed(1)}B`,
      annotations: [{ date: new Date(2001, 11, 1), label: "2001 crisis" }, { date: new Date(2018, 5, 1), label: "IMF loan" }, { date: new Date(2025, 3, 1), label: "New IMF program" }],
      label: "Central Bank reserves",
    });

    /* ---------- country risk ---------- */
    const risk = M.risk.filter((r, i) => i % 3 === 0 || i === M.risk.length - 1).map((r) => [day(r[0]), r[1]]);
    MH.lineChart($("risk"), {
      series: [{ id: "risk", name: "Country risk", color: "var(--s8)", values: risk }], height: 340, endLabels: false, log: true,
      yFormat: (v) => v.toLocaleString("en-US"), tipFormat: (v) => `${Math.round(v).toLocaleString("en-US")} bp`, tipDate: d3.timeFormat("%b %-d, %Y"),
      annotations: [
        { date: new Date(2001, 11, 23), label: "Default" }, { date: new Date(2005, 1, 25), label: "Debt swap" },
        { date: new Date(2014, 6, 30), label: "Holdout default" }, { date: new Date(2016, 3, 22), label: "Back to markets" },
        { date: new Date(2020, 7, 31), label: "Restructuring" },
      ],
      label: "Country risk",
    });
    const rpeak = d3.greatest(M.risk, (r) => r[1]);
    const rlow = d3.least(M.risk, (r) => r[1]);
    $("risk-note").textContent = `Latest ${M.risk.at(-1)[1].toLocaleString("en-US")} bp. Highest ${rpeak[1].toLocaleString("en-US")} bp on ${dayLabel(rpeak[0])}; lowest ${rlow[1].toLocaleString("en-US")} bp on ${dayLabel(rlow[0])}.`;

    /* ---------- rates vs inflation ---------- */
    const y12 = new Map(P.yoy);
    const ahead = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + 12, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
    let period = "2003";
    MH.seg($("rate-period"), [["1985", "Since 1985"], ["2003", "Since 2003"], ["2017", "Since 2017"]], period, (v) => { period = v; rates(); });
    function rates() {
      const from = `${period}-01`;
      const dep = M.deposit30.filter((r) => r[0] >= from);
      const log = period === "1985";
      const pos = (v) => (log ? (v > 0 ? v : null) : v);
      MH.lineChart($("rates"), {
        series: [
          { id: "d", name: "30-day deposit rate", color: "var(--s1)", values: dep.map((r) => [month(r[0]), pos(r[1])]) },
          { id: "i", name: "Inflation, next 12 months", color: "var(--s2)", values: dep.filter((r) => y12.has(ahead(r[0]))).map((r) => [month(r[0]), pos(y12.get(ahead(r[0])))]) },
        ],
        height: 280, endLabels: false, log, baseline: log ? null : 0, yFormat: (v) => p(v, 0), tipFormat: (v) => p(v, 1), recessions: INDEC_BAND, label: "Deposit rate and inflation",
      });
      $("rates-legend").innerHTML = AR.lineLegend([["var(--s1)", "30-day deposit rate, annual"], ["var(--s2)", "Inflation over the next 12 months"]]);
      // Real return, 12-month moving average so the chart stays readable; clipped for the hyperinflation months.
      const real = M.realDeposit.filter((r) => r[0] >= from);
      const ma = real.map((r, i) => [month(r[0]), d3.mean(real.slice(Math.max(0, i - 11), i + 1), (x) => x[1])]);
      MH.lineChart($("realrate"), {
        series: [{ id: "rr", name: "Real return, 12-month average", color: "var(--s7)", values: ma.map((r) => [r[0], Math.max(-100, r[1])]) }],
        height: 280, endLabels: false, baseline: 0, area: true, yFormat: (v) => p(v, 0), tipFormat: (v) => sp(v, 1), recessions: INDEC_BAND, label: "Real deposit return",
      });
      const posShare = real.filter((r) => r[1] > 0).length / real.length;
      $("real-note").textContent = `A term deposit beat inflation in ${Math.round(posShare * 100)}% of the months since ${period}. Each month's real return is annualized and averaged over the previous 12 months; values below −100% are clipped. The 2007–2015 band uses the official CPI, so real returns there look better than they were.`;
    }
    rates();

    /* ---------- money and credit ---------- */
    const tn = (rows) => rows.map((r) => [month(r[0]), r[1] / 1e6]);
    MH.lineChart($("moneyreal"), {
      series: [{ id: "b", name: "Monetary base", color: "var(--s1)", values: tn(M.baseReal) }, { id: "m2", name: "M2", color: "var(--s4)", values: tn(M.m2Real) }],
      height: 280, endLabels: false, baseline: 0, yFormat: (v) => `$${compact(v * 1e12, 0)}`, tipFormat: (v) => `$${compact(v * 1e12, 1)}`, recessions: INDEC_BAND, label: "Money in today's pesos",
    });
    $("money-legend").innerHTML = AR.lineLegend([["var(--s1)", "Monetary base"], ["var(--s4)", "M2"]]);
    MH.lineChart($("loans"), {
      series: [{ id: "l", name: "Loans, US$ billions", color: "var(--s3)", values: M.loansUsd.map((r) => [month(r[0]), r[1] / 1000]) }],
      height: 280, endLabels: false, baseline: 0, area: true, yFormat: (v) => `$${v.toFixed(0)}B`, tipFormat: (v) => `US$${v.toFixed(1)}B`, label: "Loans to the private sector",
    });
  }).catch(MH.fail);
})();
