# -*- coding: utf-8 -*-
"""Citește rapoartele „Estimate test geotechnical parameters” exportate din GeoStru Dynamic Probing
(fereastra Process > File > Save as, format RTF) și scrie scripts/dynamic.json.

    python3 scripts/parse_dynamic.py --rtf "../Dynamic export" --out scripts/dynamic.json

Necesită LibreOffice (soffice) pentru conversia RTF -> HTML. Valorile sunt preluate 1:1 din export;
unitățile rămân cele din Dynamic (kg/cm², t/m³).
"""
import os, re, json, html, glob, argparse, subprocess, tempfile, shutil

def clean(s):
    s = re.sub(r"<[^>]+>", " ", s); return " ".join(html.unescape(s).split())

def parse(path):
    tmp = tempfile.mkdtemp()
    try:
        src = os.path.join(tmp, "in.rtf"); shutil.copy(path, src)
        subprocess.run(["soffice", "--headless", "--convert-to", "html", "--outdir", tmp, src], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=150)
        t = open(os.path.join(tmp, "in.html"), encoding="utf-8", errors="replace").read()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    t = re.sub(r"<(script|style).*?</\1>", "", t, flags=re.S)
    out = {"coezive": [], "necoezive": []}; cat = None; pos = 0
    for m in re.finditer(r"<table.*?</table>", t, flags=re.S):
        before = clean(t[pos:m.start()]); pos = m.end()
        if "COHESIONLESS" in before: cat = "necoezive"
        elif "COHESIVE" in before: cat = "coezive"
        titlu = re.sub(r".*(COHESIONLESS|COHESIVE)\s+SOILS", "", before).strip()
        rows = [[clean(c) for c in re.findall(r"<t[dh].*?</t[dh]>", r, flags=re.S)] for r in re.findall(r"<tr.*?</tr>", m.group(0), flags=re.S)]
        if not rows or cat is None: continue
        head = rows[0]; strate = []
        for r in rows[1:]:
            if len(r) != len(head): continue
            d = dict(zip(head, r)); k = re.match(r"Layer \((\d+)\)\s*(.*)", d.get("Description", ""))
            strate.append(dict(strat=int(k.group(1)) if k else None, descriere=k.group(2) if k else d.get("Description"),
                               nspt=float(d["NSPT"]), interval=d.get("Layer depth (m)"), corelatie=d.get("Correlation"),
                               valoare=r[-1], n_calcul=d.get("N. Calculation")))
        out[cat].append(dict(parametru=titlu, unitate=(re.search(r"\(([^)]*)\)\s*$", head[-1]) or [None, ""])[1], coloana=head[-1], strate=strate))
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--rtf", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
    D = {}
    for f in sorted(glob.glob(os.path.join(a.rtf, "* parametri Dynamic.rtf"))):
        pid = os.path.basename(f).split(" ")[0]; D[pid] = parse(f)
        print(pid, len(D[pid]["coezive"]), "tabele coezive,", len(D[pid]["necoezive"]), "tabele necoezive")
    json.dump(D, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
