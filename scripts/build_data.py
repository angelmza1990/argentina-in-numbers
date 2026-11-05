"""Build the site's datasets in data/ from the raw snapshot in data/raw/.

    data/overview.json   latest value of every headline indicator, with a short history
    data/prices.json     inflation since 1943, CPI by category since 2017, expectations
    data/dollar.json     every exchange rate, daily, and the gap between them
    data/economy.json    activity, GDP, jobs, poverty, real wages, trade, fiscal balance
    data/money.json      reserves, money, interest rates, real rates, country risk
    data/savings.json    monthly series for the calculators

The build checks a few known values (inflation in 1989 and 2023, the 2001-02 devaluation,
convertibility) and stops if they are off.

Usage:
    python3 scripts/build_data.py
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sources import BCRA, DOLLARS, SERIES, WORLD_BANK  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
errors: list[str] = []


def raw(path: str):
    return json.loads((RAW / path).read_text(encoding="utf-8"))


def write(name: str, data) -> None:
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote data/{name} ({(OUT / name).stat().st_size // 1024} KB)")


def r(x, d=4):
    return None if x is None else round(x, d)


def ym(d: str) -> str:
    return d[:7]


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


# ---------- prices ----------

def cpi_chain() -> dict[str, float]:
    """A monthly price index since February 1943 (= 1) chained from monthly inflation."""
    rows = sorted(raw("argentinadatos/inflacion.json"), key=lambda x: x["fecha"])
    idx, level = {}, 1.0
    first = rows[0]["fecha"]
    y, m = int(first[:4]), int(first[5:7]) - 1
    idx[f"{y:04d}-{m:02d}" if m else f"{y - 1:04d}-12"] = 1.0
    for row in rows:
        level *= 1 + row["valor"] / 100
        idx[ym(row["fecha"])] = level
    return idx


def prices(cpi: dict[str, float]) -> dict:
    monthly = sorted((ym(x["fecha"]), x["valor"]) for x in raw("argentinadatos/inflacion.json"))
    yoy = sorted((ym(x["fecha"]), x["valor"]) for x in raw("argentinadatos/inflacionInteranual.json"))
    # Calendar-year inflation, December to December.
    annual = []
    for y in range(1944, int(max(cpi)[:4]) + 1):
        a, b = cpi.get(f"{y - 1}-12"), cpi.get(f"{y}-12")
        if a and b:
            annual.append([y, r(b / a - 1, 5)])
    last = max(cpi)
    if last[5:7] != "12":
        y = int(last[:4])
        annual.append([y, r(cpi[last] / cpi[f"{y - 1}-12"] - 1, 5), last])  # year to date
    ann = {row[0]: row[1] for row in annual}
    check(abs(ann.get(1989, 0) - 49.23) < 1.5, f"1989 inflation {ann.get(1989)} (expected about 4,923%)")
    check(abs(ann.get(2023, 0) - 2.114) < 0.05, f"2023 inflation {ann.get(2023)} (expected about 211%)")
    check(abs(ann.get(2001, 1) - (-0.015)) < 0.01, f"2001 inflation {ann.get(2001)} (expected about -1.5%)")

    cats = [s for s in SERIES if s[1].startswith("cpi_")]
    def series(key):
        return [[ym(d), r(v, 3)] for d, v in raw(f"datos/{key}.json")["data"] if v is not None]
    categories = [{"key": k[4:], "label": label, "values": series(k)} for _, k, label in cats]
    return {
        "monthly": [[k, v] for k, v in monthly],
        "yoy": [[k, v] for k, v in yoy],
        "annual": annual,
        "index": [[k, r(v, 6) if v < 1e6 else float(f"{v:.6g}")] for k, v in sorted(cpi.items())],
        "core": series("cpiCore"), "regulated": series("cpiRegulated"), "all": series("cpi"),
        "categories": categories,
        "expectations": [[ym(d), v] for d, v in raw("bcra/expectations.json")],
    }


# ---------- dollar ----------

def dollar(cpi: dict[str, float]) -> dict:
    rates = {}
    for casa, label in DOLLARS:
        rows = raw(f"argentinadatos/dolar-{casa}.json")
        rates[casa] = {x["fecha"]: x["venta"] for x in rows if x.get("venta")}
    # The BCRA wholesale rate goes back to 2002; use it before argentinadatos' series starts.
    wholesale = dict(raw("bcra/wholesaleFx.json"))
    for d, v in wholesale.items():
        rates["mayorista"].setdefault(d, v)
    dates = sorted(set().union(*[set(v) for v in rates.values()]))
    out = {"dates": dates, "series": []}
    for casa, label in DOLLARS:
        vals, prev = [], None
        for d in dates:
            v = rates[casa].get(d)
            vals.append(r(v, 2) if v else None)
        first = next(i for i, v in enumerate(vals) if v)
        out["series"].append({"key": casa, "label": label, "start": first, "values": vals[first:]})
    # Monthly averages and the gap of the blue and CCL rates over the official one.
    month = defaultdict(lambda: defaultdict(list))
    for casa in rates:
        for d, v in rates[casa].items():
            month[ym(d)][casa].append(v)
    monthly = []
    for m in sorted(month):
        row = {"m": m}
        for casa in rates:
            if month[m][casa]:
                row[casa] = r(sum(month[m][casa]) / len(month[m][casa]), 3)
        monthly.append(row)
    out["monthly"] = monthly
    # Real official rate: pesos per dollar at prices of the latest month (Argentine CPI only).
    lastm = max(k for k in cpi if k in {m["m"] for m in monthly}) if monthly else None
    out["real"] = [[m["m"], r(m["mayorista"] * cpi[lastm] / cpi[m["m"]], 2)] for m in monthly if "mayorista" in m and m["m"] in cpi]
    out["realBase"] = lastm
    w = {d: v for d, v in wholesale.items()}
    check(abs(w.get("2002-03-04", 0) - 2.0) < 0.2, "wholesale rate in March 2002 should be about 2 pesos")
    return out


# ---------- economy ----------

def money_to_current(d: str, v: float) -> float:
    """Pesos of any era in today's pesos: four currency changes removed 13 zeros."""
    if d < "1970-01": return v / 1e13
    if d < "1983-06": return v / 1e11
    if d < "1985-07": return v / 1e7  # the austral replaced the peso argentino in mid-June 1985; June is still in pesos
    if d < "1992-01": return v / 1e4
    return v


def deflate(rows, cpi, base):
    """Nominal monthly values to pesos of the base month."""
    return [[m, r(v * cpi[base] / cpi[m], 2)] for m, v in rows if m in cpi and v is not None]


def economy(cpi: dict[str, float]) -> dict:
    last = max(cpi)
    def ds(key):
        return [[ym(d), v] for d, v in raw(f"datos/{key}.json")["data"] if v is not None]
    wb = {k: raw(f"worldbank/{k}.json") for _, k, _ in WORLD_BANK}
    min_wage = [[m, money_to_current(m, v)] for m, v in ds("minWage") if m <= last]
    pension = [[m, v] for m, v in ds("minPension") if m <= last]
    # Wage indices against the CPI (both base 100 near the end of 2016).
    def real_index(key):
        rows = ds(key)
        base = next((m for m, _ in rows if m == "2017-01"), rows[0][0])
        b = dict(rows)[base]
        return [[m, r(v / b / (cpi[m] / cpi[base]) * 100, 2)] for m, v in rows if m in cpi]
    exports, imports = dict(ds("exports")), dict(ds("imports"))
    trade = [[m, r(exports[m], 1), r(imports.get(m), 1), r(exports[m] - imports[m], 1) if m in imports else None] for m in sorted(exports)]
    year_imp = defaultdict(float)
    year_n = defaultdict(int)
    for m, v in imports.items():
        year_imp[int(m[:4])] += v
        year_n[int(m[:4])] += 1
    trade_year = []
    for d, v in raw("datos/exportsYear.json")["data"]:
        y = int(d[:4])
        imp = year_imp[y] if year_n[y] == 12 else None
        trade_year.append([y, r(v, 1), r(imp, 1)])
    primary = ds("primary")
    # 12-month sum of the primary balance at today's prices.
    real_primary = deflate(primary, cpi, last)
    roll = []
    for i in range(11, len(real_primary)):
        roll.append([real_primary[i][0], r(sum(v for _, v in real_primary[i - 11:i + 1]), 0)])
    wbv = {k: dict(v) for k, v in wb.items()}
    mwr = dict(deflate(min_wage, cpi, last))
    check(0.5 < mwr["1985-07"] / mwr["1985-06"] < 1.5, "the minimum wage jumps at the 1985 currency change")
    check(abs(wbv["gdpGrowth"].get(2002, 0) - (-10.9)) < 1.0, f"2002 GDP growth {wbv['gdpGrowth'].get(2002)} (expected about -10.9%)")
    return {
        "priceBase": last,
        "emae": [[m, r(v, 2)] for m, v in ds("emae")],
        "gdpGrowth": [[y, r(v, 2)] for y, v in wb["gdpGrowth"]],
        "gdpPerCapReal": [[y, r(v, 0)] for y, v in wb["gdpPerCapReal"]],
        "gdpPerCap": [[y, r(v, 0)] for y, v in wb["gdpPerCap"]],
        "gdp": [[y, r(v / 1e9, 1)] for y, v in wb["gdp"]],
        "population": wb["population"],
        "gini": wb["gini"],
        "unemployment": [[m, r(v * 100, 1)] for m, v in ds("unemployment")],
        "poverty": [[m, r(v * 100, 1)] for m, v in ds("poverty")],
        "povertyHouseholds": [[m, r(v * 100, 1)] for m, v in ds("povertyHouseholds")],
        "povertyLine": [[m, r(v, 0)] for m, v in ds("povertyLine")],
        "povertyLineReal": deflate(ds("povertyLine"), cpi, last),
        "wagesReal": {k: real_index(k) for k in ["wages", "wagesPrivate", "wagesPublic"]},
        "minWageReal": deflate(min_wage, cpi, last),
        "minWage": [[m, r(v, 2)] for m, v in min_wage if m >= "1992-01"],
        "pensionReal": deflate([p for p in pension if p[0] >= "1971-01"], cpi, last),
        "trade": trade,
        "tradeYear": trade_year,
        "primary12m": roll,
    }


# ---------- money ----------

def monthly_last(rows):
    out = {}
    for d, v in rows:
        out[ym(d)] = v
    return sorted(out.items())


def monthly_mean(rows):
    acc = defaultdict(list)
    for d, v in rows:
        acc[ym(d)].append(v)
    return sorted((m, sum(v) / len(v)) for m, v in acc.items())


def money(cpi: dict[str, float]) -> dict:
    last = max(cpi)
    b = {key: raw(f"bcra/{key}.json") for _, key, _, _ in BCRA}
    wholesale = dict(monthly_mean(b["wholesaleFx"]))
    def in_usd(rows):
        return [[m, r(v / wholesale[m], 1)] for m, v in monthly_last(rows) if m in wholesale]
    infl = dict((ym(x["fecha"]), x["valor"]) for x in raw("argentinadatos/inflacion.json"))
    # Real monthly rate of a 30-day deposit: (1 + i/12) / (1 + inflation) - 1, annualized.
    dep = monthly_mean(b["deposit30"])
    real = []
    for m, rate in dep:
        if m in infl:
            mr = (1 + rate / 100 / 12) / (1 + infl[m] / 100) - 1
            real.append([m, r(((1 + mr) ** 12 - 1) * 100, 2)])
    risk = sorted((x["fecha"], x["valor"]) for x in raw("argentinadatos/riesgo-pais.json"))
    reserves = monthly_last(b["reserves"])
    check(any(m == "2001-12" and v < 16000 for m, v in reserves), "reserves at the end of 2001 should be below USD 16 billion")
    return {
        "priceBase": last,
        "reserves": [[m, r(v, 0)] for m, v in reserves],
        "reservesDaily": [[d, v] for d, v in b["reserves"] if d >= "2023-01-01"],
        "baseReal": deflate(monthly_last(b["base"]), cpi, last),
        "baseUsd": in_usd(b["base"]),
        "m2Real": deflate(monthly_last(b["m2"]), cpi, last),
        "loansReal": deflate(monthly_last(b["loans"]), cpi, last),
        "loansUsd": in_usd(b["loans"]),
        "deposit30": [[m, r(v, 2)] for m, v in dep],
        "badlar": [[m, r(v, 2)] for m, v in monthly_mean(b["badlar"])],
        "policy": [[m, r(v, 2)] for m, v in monthly_mean(b["policyRate"])],
        "realDeposit": real,
        "risk": [[d, v] for d, v in risk],
        "riskMonthly": [[m, r(v, 0)] for m, v in monthly_mean(risk)],
        "expectations": [[ym(d), v] for d, v in b["expectations"]],
    }


# ---------- calculators ----------

def savings(cpi: dict[str, float], dol: dict) -> dict:
    b = {key: raw(f"bcra/{key}.json") for _, key, _, _ in BCRA}
    dep = dict(monthly_mean(b["deposit30"]))
    uva = dict(monthly_last([[x["fecha"], x["valor"]] for x in raw("argentinadatos/uva.json")]))
    fx = {m["m"]: m for m in dol["monthly"]}
    months = [m for m in sorted(cpi) if m >= "1985-09"]
    rows = []
    for m in months:
        f = fx.get(m, {})
        rows.append([m, float(f"{cpi[m]:.8g}"), r(dep.get(m), 3), r(f.get("mayorista"), 3), r(f.get("blue"), 3), r(f.get("bolsa"), 3), r(uva.get(m), 3)])
    banks = [{"bank": x["entidad"].title().replace("S.A.", "").replace("S.A", "").strip(), "rate": x["tnaClientes"]}
             for x in raw("argentinadatos/plazo-fijo.json") if x.get("tnaClientes")]
    banks.sort(key=lambda x: -x["rate"])
    return {"columns": ["month", "cpi", "deposit30", "official", "blue", "mep", "uva"], "rows": rows, "banks": banks}


# ---------- presidencies ----------

# Presidents since the return of democracy, with the day they took and left office. The interim
# presidents of December 2001 (Puerta, Rodríguez Saá, Caamaño) served days and are left out.
PRESIDENTS = [
    ("Raúl Alfonsín", "UCR", "1983-12-10", "1989-07-08"),
    ("Carlos Menem", "PJ", "1989-07-08", "1999-12-10"),
    ("Fernando de la Rúa", "Alianza", "1999-12-10", "2001-12-21"),
    ("Eduardo Duhalde", "PJ", "2002-01-02", "2003-05-25"),
    ("Néstor Kirchner", "PJ (FPV)", "2003-05-25", "2007-12-10"),
    ("Cristina Fernández de Kirchner", "PJ (FPV)", "2007-12-10", "2015-12-10"),
    ("Mauricio Macri", "Cambiemos", "2015-12-10", "2019-12-10"),
    ("Alberto Fernández", "Frente de Todos", "2019-12-10", "2023-12-10"),
    ("Javier Milei", "La Libertad Avanza", "2023-12-10", None),
]


def presidencies(cpi: dict[str, float], eco: dict, mon: dict, dol: dict) -> list[dict]:
    last = max(cpi)
    def prev_month(d: str) -> str:
        y, m = int(d[:4]), int(d[5:7]) - 1
        return f"{y - 1}-12" if m == 0 else f"{y:04d}-{m:02d}"
    def near(rows, m, before=True):
        """Value at month m, or the closest one within 7 months on the requested side."""
        d = dict(rows)
        keys = sorted(d)
        cands = [k for k in keys if (k <= m if before else k >= m)]
        if not cands:
            return None
        k = cands[-1] if before else cands[0]
        gap = abs((int(k[:4]) * 12 + int(k[5:7])) - (int(m[:4]) * 12 + int(m[5:7])))
        return [k, d[k]] if gap <= 7 else None
    wholesale = {m["m"]: m.get("mayorista") for m in dol["monthly"]}
    # Convertibility fixed the peso at one dollar from April 1991 to the end of 2001.
    for y in range(1991, 2002):
        for mo in range(4 if y == 1991 else 1, 13):
            wholesale.setdefault(f"{y}-{mo:02d}", 1.0)
    out = []
    for name, party, start, end in PRESIDENTS:
        a = prev_month(start)                      # the month before taking office
        b = prev_month(end) if end else last       # the last full month in office
        if b > last:
            b = last
        months = (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))
        infl = cpi[b] / cpi[a] - 1
        row = {
            "name": name, "party": party, "start": start, "end": end, "from": a, "to": b, "months": months,
            "inflation": r(infl, 5), "inflationYear": r((1 + infl) ** (12 / months) - 1, 5) if months else None,
        }
        # GDP per person: a year counts for the president who held office most of it, so the base
        # is the year of taking office when that was in the second half, otherwise the year before.
        gdp = dict(eco["gdpPerCapReal"])
        y0 = int(start[:4]) if start[5:7] >= "07" else int(start[:4]) - 1
        y1 = (int(end[:4]) if end[5:7] >= "07" else int(end[:4]) - 1) if end else max(gdp)
        if y0 in gdp and y1 in gdp and y1 > y0:
            row["gdpPerCap"] = r(gdp[y1] / gdp[y0] - 1, 4)
            row["gdpPerCapYear"] = r((gdp[y1] / gdp[y0]) ** (1 / (y1 - y0)) - 1, 4)
            row["gdpYears"] = [y0, y1]
        if wholesale.get(a) and wholesale.get(b):
            row["dollar"] = [r(wholesale[a], 3), r(wholesale[b], 3)]
        for key, rows in (("reserves", mon["reserves"]), ("risk", mon["riskMonthly"]), ("unemployment", eco["unemployment"]),
                          ("poverty", eco["poverty"]), ("minWage", eco["minWageReal"])):
            s0, s1 = near(rows, a, before=True) or near(rows, a, before=False), near(rows, b, before=True)
            if s0 and s1 and s0[0] < s1[0]:
                row[key] = [s0, s1]
        out.append(row)
    menem = next(x for x in out if x["name"] == "Carlos Menem")
    check(menem["inflation"] > 30, "Menem's term should include the 1989-90 hyperinflation")
    return out


# ---------- overview ----------

def overview(p: dict, dol: dict, eco: dict, mon: dict) -> dict:
    def last(rows):
        rows = [x for x in rows if x[1] is not None]
        return rows[-1] if rows else None
    def spark(rows, n=36):
        return [x[1] for x in rows if x[1] is not None][-n:]
    s = {x["key"]: x for x in dol["series"]}
    def fx(k):
        vals = s[k]["values"]
        i = max(j for j, v in enumerate(vals) if v)
        return [dol["dates"][s[k]["start"] + i], vals[i]]
    off, blue, mep, ccl = fx("oficial"), fx("blue"), fx("bolsa"), fx("contadoconliqui")
    return {
        "updated": date.today().isoformat(),
        "inflationMonthly": last(p["monthly"]), "inflationYoy": last(p["yoy"]),
        "inflationSpark": spark(p["monthly"]),
        "official": off, "blue": blue, "mep": mep, "ccl": ccl,
        "gap": round(blue[1] / off[1] - 1, 4),
        "risk": last(mon["risk"]), "riskSpark": spark(mon["riskMonthly"]),
        "reserves": last(mon["reserves"]), "reservesSpark": spark(mon["reserves"]),
        "emae": last(eco["emae"]), "emaeSpark": spark(eco["emae"]),
        "unemployment": last(eco["unemployment"]), "unemploymentSpark": spark(eco["unemployment"], 20),
        "poverty": last(eco["poverty"]), "povertySpark": spark(eco["poverty"], 16),
        "wages": last(eco["wagesReal"]["wages"]), "wagesSpark": spark(eco["wagesReal"]["wages"]),
        "deposit": last(mon["deposit30"]), "realDeposit": last(mon["realDeposit"]),
        "expectations": last(mon["expectations"]),
        "minWage": last(eco["minWage"]),
        "gdpGrowth": last(eco["gdpGrowth"]),
        "population": last(eco["population"]),
    }


def main() -> None:
    cpi = cpi_chain()
    p = prices(cpi)
    dol = dollar(cpi)
    eco = economy(cpi)
    mon = money(cpi)
    sav = savings(cpi, dol)
    ov = overview(p, dol, eco, mon)
    pres = presidencies(cpi, eco, mon, dol)
    if errors:
        sys.exit("validation failed:\n  " + "\n  ".join(errors))
    write("prices.json", p)
    write("dollar.json", dol)
    write("economy.json", eco)
    write("money.json", mon)
    write("savings.json", sav)
    write("overview.json", ov)
    write("presidents.json", pres)


if __name__ == "__main__":
    main()
