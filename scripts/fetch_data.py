"""Download every source into data/raw/ (kept in the repo as a snapshot).

A source that fails keeps its previous file, and the script exits with an error at the end
so the scheduled workflow reports it.

Usage:
    python3 scripts/fetch_data.py
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sources import AD_INDICES, BCRA, DOLLARS, SERIES, WORLD_BANK  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
AGENT = "argentina-in-numbers/1.0 (+https://github.com/angelmza1990/argentina-in-numbers)"
failed: list[str] = []


def get(url: str, tries: int = 4) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            if attempt == tries - 1:
                raise
            print(f"  retry {url} ({err})", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


def save(name: str, data) -> None:
    path = RAW / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def step(name: str, fn) -> None:
    try:
        fn()
        print(f"ok   {name}")
    except Exception as err:  # keep the old snapshot and carry on
        failed.append(name)
        print(f"FAIL {name}: {err}", file=sys.stderr)


def argentinadatos() -> None:
    base = "https://api.argentinadatos.com/v1"
    for casa, _ in DOLLARS:
        step(f"dollar {casa}", lambda c=casa: save(f"argentinadatos/dolar-{c}.json", json.loads(get(f"{base}/cotizaciones/dolares/{c}"))))
    for k in AD_INDICES:
        step(f"index {k}", lambda k=k: save(f"argentinadatos/{k}.json", json.loads(get(f"{base}/finanzas/indices/{k}"))))
    step("deposit rates", lambda: save("argentinadatos/plazo-fijo.json", json.loads(get(f"{base}/finanzas/tasas/plazoFijo"))))


def bcra() -> None:
    base = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias"
    for vid, key, _, _ in BCRA:
        def one(vid=vid, key=key):
            rows, offset = [], 0
            while True:
                q = urllib.parse.urlencode({"desde": "1940-01-01", "hasta": "2100-01-01", "limit": 3000, "offset": offset})
                d = json.loads(get(f"{base}/{vid}?{q}"))
                page = d["results"][0]["detalle"] if d["results"] else []
                rows += [[r["fecha"], r["valor"]] for r in page]
                total = d["metadata"]["resultset"]["count"]
                offset += len(page)
                if not page or offset >= total:
                    break
            rows.sort()
            save(f"bcra/{key}.json", rows)
        step(f"bcra {key}", one)


def datos() -> None:
    base = "https://apis.datos.gob.ar/series/api/series/"
    for sid, key, _ in SERIES:
        def one(sid=sid, key=key):
            q = urllib.parse.urlencode({"ids": sid, "limit": 5000, "format": "json", "metadata": "simple"})
            d = json.loads(get(f"{base}?{q}"))
            save(f"datos/{key}.json", {"id": sid, "data": d["data"], "meta": d.get("meta")})
        step(f"datos {key}", one)
        time.sleep(0.3)


def world_bank() -> None:
    for ind, key, _ in WORLD_BANK:
        def one(ind=ind, key=key):
            d = json.loads(get(f"https://api.worldbank.org/v2/country/ARG/indicator/{ind}?format=json&per_page=200"))
            rows = sorted([int(r["date"]), r["value"]] for r in d[1] if r["value"] is not None)
            save(f"worldbank/{key}.json", rows)
        step(f"world bank {key}", one)


def main() -> None:
    argentinadatos()
    bcra()
    datos()
    world_bank()
    if failed:
        sys.exit(f"{len(failed)} source(s) failed, previous snapshots kept: {', '.join(failed)}")


if __name__ == "__main__":
    main()
