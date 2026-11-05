// Calculators: what pesos from any month are worth today, a savings race, a salary check and a term deposit today.
(function () {
  const { p, sp, money, usd, month, monthLabel } = AR;
  MH.shell("calculators");
  const $ = (id) => document.getElementById(id);
  // Zeros removed at each currency change: pesos of any month to today's pesos.
  const toCurrent = (m) => (m < "1970-01" ? 1e13 : m < "1983-06" ? 1e11 : m < "1985-07" ? 1e7 : m < "1992-01" ? 1e4 : 1);
  const CURRENCY = (m) => (m < "1970-01" ? "pesos moneda nacional" : m < "1983-06" ? "pesos ley 18.188" : m < "1985-07" ? "pesos argentinos" : m < "1992-01" ? "australes" : "pesos");

  Promise.all([MH.load("savings"), MH.load("prices"), MH.load("money")]).then(([S, P, M]) => {
    const cpi = new Map(P.index);
    const months = P.index.map((r) => r[0]);
    const last = months.at(-1);
    $("updated").textContent = `Prices through ${monthLabel(last)}.`;
    const col = Object.fromEntries(S.columns.map((c, i) => [c, i]));
    const rows = S.rows.filter((r) => r[0] <= last);
    const byM = new Map(rows.map((r) => [r[0], r]));
    const tile = (a, b, c = "") => `<div class="tile"><p class="label">${a}</p><div class="value">${b}</div><div class="delta"><span>${c}</span></div></div>`;
    const big = (v) => (v >= 1e15 ? v.toExponential(2) : money(v, v < 100 ? 2 : 0));

    /* ---------- worth today ---------- */
    AR.monthOptions($("w-month"), months.slice().reverse(), "2001-12");
    ["w-amt", "w-month", "w-cur"].forEach((id) => $(id).addEventListener("input", worth));
    function worth() {
      const a = +$("w-amt").value || 0, m = $("w-month").value, then = $("w-cur").value === "then";
      const inCurrent = then ? a / toCurrent(m) : a;
      const factor = cpi.get(last) / cpi.get(m);
      const out = inCurrent * factor;
      $("w-out").textContent = big(out);
      $("w-note").textContent = `${then ? `${a.toLocaleString("en-US")} ${CURRENCY(m)}` : money(a, 2) + " (today's pesos)"} in ${monthLabel(m)} buys as much as ${big(out)} in ${monthLabel(last)}: prices rose ${factor >= 10 ? `${factor >= 100 ? Math.round(factor).toLocaleString("en-US") : factor.toFixed(1)} times` : p((factor - 1) * 100, 1)}.` +
        (then && toCurrent(m) > 1 ? ` Since then the currency has lost ${Math.log10(toCurrent(m))} zeros.` : "");
      const r = byM.get(m), lastR = byM.get(last);
      const yrs = (months.indexOf(last) - months.indexOf(m)) / 12;
      const tiles = [tile("Average inflation", yrs >= 1 ? p((Math.pow(factor, 1 / yrs) - 1) * 100, 1) : "–", "a year over the period")];
      if (r && r[col.official]) tiles.push(tile("In dollars then", usd(inCurrent / r[col.official], 2), `at ${money(r[col.official], 2)} official`), tile("Those dollars today", money(inCurrent / r[col.official] * lastR[col.official]), "in pesos at today's official rate"));
      $("w-tiles").innerHTML = tiles.join("");
    }
    worth();

    /* ---------- savings race ---------- */
    const STRATS = [
      { key: "infl", label: "Keep up with inflation", color: "var(--ink-2)" },
      { key: "cash", label: "Pesos under the mattress", color: "var(--muted)" },
      { key: "dep", label: "30-day term deposits", color: "var(--s1)" },
      { key: "uva", label: "UVA", color: "var(--s3)" },
      { key: "official", label: "Official dollar", color: "var(--s7)" },
      { key: "blue", label: "Blue dollar", color: "var(--s2)" },
      { key: "mep", label: "MEP dollar", color: "var(--s4)" },
    ];
    const startMonths = rows.filter((r) => r[col.official] && r[col.deposit30] != null).map((r) => r[0]);
    AR.monthOptions($("r-month"), startMonths.slice().reverse(), startMonths.includes("2016-04") ? "2016-04" : startMonths[0]);
    ["r-amt", "r-month"].forEach((id) => $(id).addEventListener("input", race));
    function race() {
      const a = +$("r-amt").value || 0, m0 = $("r-month").value;
      const span = rows.filter((r) => r[0] >= m0);
      const r0 = span[0];
      const paths = Object.fromEntries(STRATS.map((s) => [s.key, []]));
      let dep = a;
      span.forEach((r, i) => {
        if (i > 0) { const prev = span[i - 1]; dep *= 1 + (prev[col.deposit30] ?? 0) / 100 * 30 / 365; }
        const real = cpi.get(last) / r[col.cpi]; // to today's pesos
        const put = (k, v) => paths[k].push([month(r[0]), v == null ? null : v * real]);
        put("infl", a * r[col.cpi] / r0[col.cpi]);
        put("cash", a);
        put("dep", dep);
        put("uva", r0[col.uva] && r[col.uva] ? a * r[col.uva] / r0[col.uva] : null);
        for (const k of ["official", "blue", "mep"]) put(k, r0[col[k]] && r[col[k]] ? a / r0[col[k]] * r[col[k]] : null);
      });
      const finals = STRATS.map((s) => {
        const v = paths[s.key].at(-1)[1];
        return { s, v, nominal: v == null ? null : v }; // already in today's pesos at the last month
      }).filter((x) => x.v != null).sort((x, y) => y.v - x.v);
      const keep = a * cpi.get(last) / r0[col.cpi];
      const max = d3.max(finals, (x) => x.v);
      $("r-rank").innerHTML = finals.map((x) => `<div class="rank-row"><span>${x.s.label}</span><div class="bar"><i style="width:${(x.v / max) * 100}%;background:${x.s.color}"></i></div><b>${money(x.v)}<small>${x.s.key === "infl" ? "break-even" : `${sp((x.v / keep - 1) * 100, 1)} after inflation`}</small></b></div>`).join("");
      const best = finals.find((x) => x.s.key !== "infl");
      $("r-note").textContent = `${money(a)} in ${monthLabel(m0)} is worth ${money(keep)} in today's money. Best: ${best.s.key === "uva" ? "UVA" : best.s.label.toLowerCase()}, ${money(best.v)}. Pesos left idle kept ${p(a / keep * 100, 1)} of their value.`;
      const series = STRATS.filter((s) => paths[s.key].some((q) => q[1] != null)).map((s) => ({ id: s.key, name: s.label, color: s.color, values: paths[s.key].filter((q) => q[1] != null), width: s.key === "infl" ? 1.5 : 2 }));
      MH.lineChart($("r-chart"), { series, height: 340, endLabels: false, log: true, yFormat: (v) => `$${AR.compact(v, 0)}`, tipFormat: (v) => money(v), label: "Savings over time" });
      $("r-legend").innerHTML = AR.lineLegend(series.map((s) => [s.color, s.name])) + `<p class="note" style="margin:4px 0 0">Every line is in pesos of ${monthLabel(last)}, so a flat line keeps its purchasing power. Logarithmic scale.</p>`;
    }
    race();

    /* ---------- salary ---------- */
    AR.monthOptions($("s-month"), months.filter((m) => m >= "2002-01").reverse(), months[months.length - 13]);
    ["s-then", "s-month", "s-now"].forEach((id) => $(id).addEventListener("input", salary));
    function salary() {
      const a = +$("s-then").value || 0, m = $("s-month").value, b = +$("s-now").value || 0;
      const factor = cpi.get(last) / cpi.get(m), needed = a * factor, ch = (b / needed - 1) * 100;
      $("s-out").textContent = sp(ch, 1);
      $("s-out").className = `big-answer ${MH.signClass(ch)}`;
      $("s-note").textContent = `To buy what ${money(a)} bought in ${monthLabel(m)}, you would need ${money(needed)} in ${monthLabel(last)}. Prices rose ${p((factor - 1) * 100, 1)}; your salary rose ${p((b / a - 1) * 100, 1)}.`;
      const r = byM.get(m), l = byM.get(last);
      const tiles = [];
      if (r && r[col.official]) tiles.push(tile("In official dollars", `${usd(a / r[col.official])} → ${usd(b / l[col.official])}`, sp((b / l[col.official] / (a / r[col.official]) - 1) * 100, 1)));
      if (r && r[col.blue]) tiles.push(tile("In blue dollars", `${usd(a / r[col.blue])} → ${usd(b / l[col.blue])}`, sp((b / l[col.blue] / (a / r[col.blue]) - 1) * 100, 1)));
      tiles.push(tile("Raise needed", p((factor - 1) * 100, 1), "to keep up with prices"));
      $("s-tiles").innerHTML = tiles.join("");
    }
    salary();

    /* ---------- term deposit today ---------- */
    const exp = M.expectations.at(-1)[1];
    $("d-infl").value = ((Math.pow(1 + exp / 100, 1 / 12) - 1) * 100).toFixed(1);
    ["d-amt", "d-days", "d-infl"].forEach((id) => $(id).addEventListener("input", deposit));
    function deposit() {
      const a = +$("d-amt").value || 0, days = Math.max(30, +$("d-days").value || 30), infl = +$("d-infl").value || 0;
      const lose = a * (Math.pow(1 + infl / 100, days / 30) - 1);
      const list = S.banks.map((b) => ({ ...b, interest: a * b.rate * days / 365 }));
      const max = d3.max(list, (x) => x.interest) || 1;
      $("d-rank").innerHTML = list.slice(0, 15).map((x) => `<div class="rank-row"><span>${x.bank}</span><div class="bar"><i style="width:${(x.interest / max) * 100}%;background:${x.interest >= lose ? "var(--s3)" : "var(--s2)"}"></i></div><b>${money(x.interest)}<small>${p(x.rate * 100, 2)} a year</small></b></div>`).join("");
      $("d-note").textContent = `Prices rising ${p(infl, 1)} a month would cost ${money(lose)} of purchasing power over ${days} days. Green bars beat that; orange ones do not. Rates for existing customers, as published by the Central Bank; the expected inflation defaults to analysts' median forecast (${p(exp, 1)} for the next 12 months).`;
    }
    deposit();
  }).catch(MH.fail);
})();
