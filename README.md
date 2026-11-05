# Argentina in Numbers

> **Not financial advice.** An educational project built on public data.

Argentina's economy in data, updated every week: inflation since 1943, every dollar rate, reserves, country risk, activity, jobs, poverty, real wages, interest rates, the economy under each president since 1983, and calculators to see what pesos, salaries and savings are really worth.

**Live site:** https://angelmza1990.github.io/argentina-in-numbers/

## Pages

- **[Overview](https://angelmza1990.github.io/argentina-in-numbers/)**: the latest figure of fourteen headline indicators with their last three years, and every calendar year of inflation since 1944 in one grid.
- **[Inflation](https://angelmza1990.github.io/argentina-in-numbers/inflation/)**: monthly and 12-month inflation for any period since 1943, any year month by month (how often prices doubled in 1989), the price rise of each CPI category between two months, core against regulated prices, and analysts' expectations against what happened.
- **[Dollar](https://angelmza1990.github.io/argentina-in-numbers/dollar/)**: today's official, wholesale, blue, MEP, CCL, crypto and card rates with their changes, every rate over time with the key policy events, the gap over the official rate, the wholesale dollar at today's prices since 2002, and a converter for any date.
- **[Economy](https://angelmza1990.github.io/argentina-in-numbers/economy/)**: GDP per person and growth since 1960, monthly activity (EMAE), unemployment, poverty, real wages by sector, the real minimum wage since 1965 and the minimum pension since 1971 against the poverty line, trade since 1910, and the national government's primary balance.
- **[Money & rates](https://angelmza1990.github.io/argentina-in-numbers/money/)**: Central Bank reserves since 1996, country risk since 1999, 30-day deposit rates against the inflation that followed and the real return since 1985, the monetary base and M2 in today's pesos, and credit to the private sector.
- **[By presidency](https://angelmza1990.github.io/argentina-in-numbers/presidents/)**: inflation, GDP per person, the dollar, reserves, country risk, unemployment, poverty and the real minimum wage at the start and end of every term since 1983, measured the same way for everyone.
- **[Calculators](https://angelmza1990.github.io/argentina-in-numbers/calculators/)**: what an amount from any month since 1943 is worth today (in today's pesos or the currency of the time), which savings did best since a given month (term deposits, UVA, official, blue or MEP dollars, or pesos kept idle), your salary then and now in real terms and in dollars, and a term deposit today by bank against expected inflation.
- **[Method](https://angelmza1990.github.io/argentina-in-numbers/method/)**: sources, definitions and limitations.

## Data

| Source | What |
|---|---|
| [INDEC](https://www.indec.gob.ar/) via [datos.gob.ar](https://datos.gob.ar/) series API | CPI by category, EMAE, unemployment, poverty, wages, trade, minimum wage, pensions, primary balance |
| [Banco Central de la República Argentina](https://www.bcra.gob.ar/), API v4 | Reserves, wholesale dollar, monetary base, M2, loans, interest rates, inflation expectations, CER, ICL |
| [argentinadatos.com](https://argentinadatos.com/) | Daily dollar rates, monthly inflation since 1943, country risk, UVA, term deposit rates by bank |
| [World Bank](https://data.worldbank.org/) | GDP, GDP per person, population, Gini since 1960 |

Pesos of any era are converted to today's currency (13 zeros removed in four currency changes since 1970) and adjusted by the CPI. INDEC's index for 2007–2015 is widely considered to have understated inflation; it is shown as published, with those years shaded.

## How it works

Static HTML, CSS and JavaScript with [D3.js](https://d3js.org/) (vendored), served by GitHub Pages. No build step for the site.

```
scripts/sources.py      every series and where it comes from
scripts/fetch_data.py   downloads every source into data/raw/ (kept as a snapshot)
scripts/build_data.py   builds data/*.json and checks known values (1989 and 2023 inflation, convertibility, the 2002 devaluation, 2001 reserves)
scripts/check_pages.mjs opens every page in headless Chrome
```

Two GitHub Actions workflows: **Update data** runs every Monday, refreshes the sources and commits the datasets if anything changed; **Check pages** runs on every push and fails on script errors, missing files, empty pages or sideways scrolling at phone width.

## Run it locally

```sh
python3 scripts/fetch_data.py   # optional: refresh the snapshot (about 7 minutes)
python3 scripts/build_data.py
python3 -m http.server 8080      # then open http://localhost:8080
```

## License

Code: MIT. Data belongs to its providers; INDEC and datos.gob.ar publish under CC BY 4.0, the World Bank under CC BY 4.0.
