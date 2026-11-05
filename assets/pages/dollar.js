// Dollar: today's rates, every rate over time, the gap, the real official rate and a converter.
(function () {
  const { money, usd, p, sp, day, month, dayLabel, monthLabel, INDEC_BAND } = AR;
  MH.shell("dollar");
  const $ = (id) => document.getElementById(id);
  const COLOR = { oficial: "var(--s1)", mayorista: "var(--s7)", blue: "var(--s2)", bolsa: "var(--s3)", contadoconliqui: "var(--s4)", cripto: "var(--s5)", tarjeta: "var(--s8)" };
  const EVENTS = [
    ["2011-10-31", "Controls (cepo)"], ["2015-12-17", "Controls lifted"], ["2019-09-01", "Controls return"],
    ["2023-12-13", "Devaluation"], ["2025-04-14", "Controls lifted"],
  ];

  MH.load("dollar").then((D) => {
    const S = Object.fromEntries(D.series.map((s) => [s.key, s]));
    // Dates and values of one series, without gaps.
    const rows = (k) => S[k].values.map((v, i) => [D.dates[S[k].start + i], v]).filter((r) => r[1]);
    const R = Object.fromEntries(D.series.map((s) => [s.key, rows(s.key)]));
    const at = (k, d) => { const r = R[k]; let lo = 0, hi = r.length - 1; if (!r.length || d < r[0][0]) return null; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (r[mid][0] <= d) lo = mid; else hi = mid - 1; } return r[lo]; };
    const lastDay = D.dates.at(-1);
    $("updated").textContent = `Latest quote: ${dayLabel(lastDay)}.`;

    /* ---------- today ---------- */
    const back = (days) => { const d = day(lastDay); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
    const off = at("oficial", lastDay)[1];
    $("today").innerHTML = `<thead><tr><th>Rate</th><th class="num">Pesos</th><th class="num">1 day</th><th class="num">1 month</th><th class="num">1 year</th><th class="num">Over official</th></tr></thead><tbody>` +
      D.series.map((s) => {
        const now = at(s.key, lastDay); if (!now) return "";
        const ch = (days) => { const b = at(s.key, back(days)); return b ? (now[1] / b[1] - 1) * 100 : null; };
        const cell = (v) => `<td class="num ${MH.signClass(v)}">${sp(v)}</td>`;
        return `<tr><td><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:8px;background:${COLOR[s.key]}"></span>${s.label}</td><td class="num"><b>${money(now[1], 2)}</b></td>${cell(ch(1))}${cell(ch(30))}${cell(ch(365))}${s.key === "oficial" ? "<td class='num'>–</td>" : cell((now[1] / off - 1) * 100)}</tr>`;
      }).join("") + "</tbody>";

    /* ---------- rates over time ---------- */
    const PERIODS = [["d30", "1 month"], ["d365", "1 year"], ["d1826", "5 years"], ["2011", "Since 2011"], ["2002", "Since 2002"]];
    const state = { period: "d1826", log: false, on: new Set(["oficial", "blue", "bolsa", "contadoconliqui"]) };
    MH.seg($("period"), PERIODS, state.period, (v) => { state.period = v; if (v === "2002") state.log = true; scaleSeg(); rates(); });
    const scaleSeg = () => MH.seg($("scale"), [[false, "Linear"], [true, "Logarithmic"]], state.log, (v) => { state.log = v; rates(); });
    scaleSeg();
    $("pick").innerHTML = D.series.map((s) => `<button type="button" class="chip" data-k="${s.key}" aria-pressed="${state.on.has(s.key)}"><i style="background:${COLOR[s.key]}"></i>${s.label}</button>`).join("");
    $("pick").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k;
      if (state.on.has(k)) { if (state.on.size > 1) state.on.delete(k); } else state.on.add(k);
      b.setAttribute("aria-pressed", state.on.has(k));
      rates();
    }));
    function rates() {
      const days = state.period.startsWith("d") ? +state.period.slice(1) : null;
      const from = days ? back(days) : `${state.period}-01-01`;
      const step = days && days <= 365 ? 1 : days ? 3 : 7;
      const series = D.series.filter((s) => state.on.has(s.key)).map((s) => ({
        id: s.key, name: s.label, color: COLOR[s.key],
        values: R[s.key].filter((r, i) => r[0] >= from && (i % step === 0 || i === R[s.key].length - 1)).map((r) => [day(r[0]), r[1]]),
      })).filter((s) => s.values.length);
      MH.lineChart($("rates"), {
        series, height: 380, log: state.log, endLabels: false, yFormat: (v) => money(v), tipFormat: (v) => money(v, 2), tipDate: d3.timeFormat("%b %-d, %Y"),
        annotations: EVENTS.map(([d, l]) => ({ date: day(d), label: l })).filter((a) => a.date >= day(from)), label: "Exchange rates",
      });
      $("rates-legend").innerHTML = AR.lineLegend(series.map((s) => [s.color, s.name]));
    }
    rates();

    /* ---------- gap ---------- */
    const gapOf = (k) => D.monthly.filter((m) => m[k] && m.oficial).map((m) => [month(m.m), (m[k] / m.oficial - 1) * 100]);
    MH.lineChart($("gap"), {
      series: [{ id: "blue", name: "Blue over official", color: COLOR.blue, values: gapOf("blue") }, { id: "ccl", name: "CCL over official", color: COLOR.contadoconliqui, values: gapOf("contadoconliqui") }],
      height: 300, endLabels: false, baseline: 0, yFormat: (v) => p(v, 0), tipFormat: (v) => sp(v, 1),
      annotations: EVENTS.map(([d, l]) => ({ date: day(d), label: l })), label: "Gap over the official rate",
    });
    $("gap-legend").innerHTML = AR.lineLegend([[COLOR.blue, "Blue over official"], [COLOR.contadoconliqui, "CCL over official"]]);

    /* ---------- real rate ---------- */
    const real = D.real.map((r) => [month(r[0]), r[1]]);
    const now = real.at(-1)[1];
    const sorted = real.map((r) => r[1]).sort((a, b) => a - b);
    const pctile = sorted.filter((v) => v <= now).length / sorted.length;
    $("real-sub").textContent = `The wholesale dollar since 2002 in pesos of ${monthLabel(D.realBase)}: what each month's dollar would cost at today's prices. Today it costs ${money(now)}, more than in ${Math.round(pctile * 100)}% of the months since 2002.`;
    MH.lineChart($("real"), {
      series: [{ id: "real", name: `Wholesale dollar in pesos of ${monthLabel(D.realBase)}`, color: COLOR.mayorista, values: real }],
      height: 300, endLabels: false, yFormat: (v) => money(v), tipFormat: (v) => money(v), recessions: INDEC_BAND, area: true, baseline: 0, label: "Real wholesale dollar",
    });

    /* ---------- converter ---------- */
    $("date").value = lastDay;
    $("date").min = D.dates[0]; $("date").max = lastDay;
    ["amt", "dir", "date"].forEach((id) => $(id).addEventListener("input", conv));
    function conv() {
      const a = +$("amt").value || 0, toUsd = $("dir").value === "ars", d = $("date").value || lastDay;
      const list = D.series.map((s) => ({ s, q: at(s.key, d) })).filter((x) => x.q && d.slice(0, 7) >= x.q[0].slice(0, 7))
        .map((x) => ({ ...x, out: toUsd ? a / x.q[1] : a * x.q[1] }));
      const max = d3.max(list, (x) => x.out) || 1;
      $("conv").innerHTML = list.map((x) => `<div class="rank-row"><span>${x.s.label}</span><div class="bar"><i style="width:${(x.out / max) * 100}%;background:${COLOR[x.s.key]}"></i></div><b>${toUsd ? usd(x.out, 2) : money(x.out, 0)}<small>at ${money(x.q[1], 2)}, ${dayLabel(x.q[0])}</small></b></div>`).join("") || `<p class="note">No quotes for that date.</p>`;
      $("conv-note").textContent = `${toUsd ? money(a) : usd(a)} on ${dayLabel(d)}, at each rate's last quote on or before that day.`;
    }
    conv();
  }).catch(MH.fail);
})();
