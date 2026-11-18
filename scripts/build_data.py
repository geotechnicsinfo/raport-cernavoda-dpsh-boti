# -*- coding: utf-8 -*-
"""Generatorul data.json + poze pentru raportul DPSH – H2 Plant Cernavodă.

Sursa de adevăr pentru lovituri: "DPSH Cernavoda - lovituri.csv" (transcrierea fișelor de teren).
Pentru o corecție (ex. L4 la 0,80 m: 39 -> 33) se modifică CSV-ul și se rulează din nou:

    python3 scripts/build_data.py --csv "../DPSH Cernavoda - lovituri.csv" --poze "../Raw data" \
        --meteo scripts/meteo.json --figuri "../Qgis/figuri" --dynamic scripts/dynamic.json --out .

Calculul urmează presetul GeoStru Dynamic Probing „DPSH TG 63-200 PAGANI”:
    Rpd = M²·H / [A·e·(M+P)],  e = δ/N20,  P = nicovală + tije (prima îmbinare la 0,40 m)
    Nspt = 1,47 · N20
Necesită Pillow. Pozele deja procesate sunt sărite.
"""
import os, re, csv, json, math, argparse, datetime, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stereo70 import wgs2stereo

ECH = dict(nume="DPSH TG 63-200 PAGANI (preset GeoStru Dynamic Probing)", M=63.5, H=75.0, A=20.43, pas=20.0,
           tija_kg=6.31, nicovala_kg=0.63, unghi=90, prima_imbinare=0.40, beta=1.47, norma="SR EN ISO 22476-2")
BAZA_TERASAMENT = 1.00   # m, conform detaliului de secțiune din planul de amplasare Rev. 03
CLASE = [(0, 5, "#D9E8F5", "sub 5"), (5, 10, "#9CC3E4", "5–9"), (10, 20, "#4F93CE", "10–19"),
         (20, 30, "#0069B4", "20–29"), (30, 999, "#0A2F4F", "30 și peste")]

def dms(s):
    d, m, sec = s.split(); return float(d) + float(m) / 60 + float(sec) / 3600
def dms_txt(s, hemi, w):
    d, m, sec = s.split(); return "%s %0*d°%s'%s\"" % (hemi, w, int(d), m, sec.replace(".", ","))
def clasa(n):
    for k, (a, b, c, _) in enumerate(CLASE):
        if a <= n < b: return k
def tije(z):
    return 1 if z <= ECH["prima_imbinare"] + 1e-9 else 1 + math.ceil(z - ECH["prima_imbinare"] - 1e-9)
def rpd(n, z):
    P = ECH["nicovala_kg"] + ECH["tija_kg"] * tije(z)
    return ECH["M"] ** 2 * ECH["H"] / (ECH["A"] * (ECH["pas"] / n) * (ECH["M"] + P))

def poze(src, dst, pid, fisa, rot_f, etic, rot_e):
    from PIL import Image, ImageOps
    os.makedirs(dst, exist_ok=True)
    def proc(fn, name, rot=0, big=1200):
        out, th = os.path.join(dst, name + ".jpg"), os.path.join(dst, "t_" + name + ".jpg")
        if not (os.path.exists(out) and os.path.exists(th)):
            im = ImageOps.exif_transpose(Image.open(os.path.join(src, fn))).convert("RGB")
            if rot: im = im.rotate(rot, expand=True)
            a = im.copy(); a.thumbnail((big, big)); a.save(out, quality=84)
            b = im.copy(); b.thumbnail((420, 420)); b.save(th, quality=78)
        from PIL import Image as I
        w, h = I.open(out).size
        m = re.search(r"at (\d+)\.(\d+)\.(\d+) (AM|PM)", fn); ts = None
        if m:
            hh = int(m.group(1)) % 12 + (12 if m.group(4) == "PM" else 0); ts = "%02d:%s" % (hh, m.group(2))
        return dict(src="photos/%s/%s.jpg" % (pid, name), thumb="photos/%s/t_%s.jpg" % (pid, name), original=fn, w=w, h=h, ora=ts)
    r = dict(fisa_foto=proc(fisa, "fisa1", rot_f, 1400), eticheta_foto=proc(etic, "eticheta", rot_e), poze=[])
    rest = sorted(f for f in os.listdir(src) if f.lower().endswith((".jpg", ".jpeg", ".png")) and f not in (fisa, etic))
    for k, f in enumerate(rest, 1): r["poze"].append(proc(f, "%02d" % k))
    return r

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True); ap.add_argument("--poze", required=True)
    ap.add_argument("--meteo", required=True); ap.add_argument("--out", default=".")
    ap.add_argument("--figuri", default=None, help="folder cu figurile exportate din QGIS (optional)")
    ap.add_argument("--dynamic", default=None, help="scripts/dynamic.json, generat de parse_dynamic.py (optional)")
    a = ap.parse_args()
    T = []
    for r in csv.DictReader(open(a.csv, encoding="utf-8-sig"), delimiter=";"):
        pid = r["punct"].strip(); lat, lon = dms(r["lat"]), dms(r["lon"]); N, E = wgs2stereo(lat, lon)
        rows = []
        for k in range(1, 11):
            z = round(0.2 * k, 2); n = int(r["N_%03d" % (k * 20)]); R = rpd(n, z)
            rows.append(dict(z=z, N=n, tije=tije(z), rpd=round(R, 2), qd=round(R * 0.0980665, 2), nspt=round(ECH["beta"] * n, 1), cls=clasa(n)))
        sup = [x for x in rows if x["z"] <= BAZA_TERASAMENT + 1e-9]; inf = [x for x in rows if x["z"] > BAZA_TERASAMENT + 1e-9]
        med = lambda L, key: round(sum(x[key] for x in L) / len(L), 1)
        t = dict(id=pid, eticheta="Penetrare dinamică super-grea " + pid, data=r["data"], adancime=rows[-1]["z"],
                 gps_dms=[dms_txt(r["lat"], "N", 2), dms_txt(r["lon"], "E", 3)], lat=round(lat, 6), lon=round(lon, 6),
                 stereo70=dict(N=round(N, 1), E=round(E, 1)), randuri=rows,
                 N_min=min(x["N"] for x in rows), N_max=max(x["N"] for x in rows),
                 N_med_sup=med(sup, "N"), N_med_inf=med(inf, "N"), qd_med_sup=med(sup, "qd"), qd_med_inf=med(inf, "qd"),
                 note=[s.strip() for s in r["de_verificat"].split("|") if s.strip()])
        t.update(poze(os.path.join(a.poze, pid), os.path.join(a.out, "photos", pid), pid, r["fisa"], int(r["rot_fisa"] or 0), r["eticheta"], int(r["rot_eticheta"] or 0)))
        ore = [p["ora"] for p in [t["fisa_foto"], t["eticheta_foto"]] + t["poze"] if p["ora"]]
        t["ora_poze"] = min(ore) if ore else None
        T.append(t)
    if a.dynamic and os.path.exists(a.dynamic):
        DY = json.load(open(a.dynamic, encoding="utf-8"))
        for t in T: t["dynamic"] = DY.get(t["id"])
    T.sort(key=lambda t: (t["data"], t["ora_poze"] or "", t["id"]))
    for k, t in enumerate(T, 1): t["ordine"] = k
    m = json.load(open(a.meteo, encoding="utf-8")); d = m["daily"]; meteo = {}
    for i, day in enumerate(d["time"]): meteo[day] = {k: d[k][i] for k in d if k != "time"}
    meteo["_meta"] = dict(sursa="Open-Meteo (model de prognoză, nu reanaliză)", lat=round(m["latitude"], 3), lon=round(m["longitude"], 3), elevatie_m=m.get("elevation"))
    figuri = []
    if a.figuri and os.path.isdir(a.figuri):
        TIT = {"fig1_plan_satelit.png": "Plan de situație pe imagine satelitară", "fig_incadrare_satelit.png": "Încadrarea în zonă", "fig_harta_geologica_200k.png": "Harta geologică 1:200 000",
               "fig_relief.png": "Unități și forme de relief", "fig_topo_50k.png": "Harta topografică 1:50 000"}
        from PIL import Image
        os.makedirs(os.path.join(a.out, "photos", "qgis"), exist_ok=True)
        for fn, tit in TIT.items():
            p = os.path.join(a.figuri, fn)
            if not os.path.exists(p): continue
            im = Image.open(p).convert("RGB"); b = fn[:-4]
            x = im.copy(); x.thumbnail((2000, 2000)); x.save(os.path.join(a.out, "photos", "qgis", b + ".jpg"), quality=86)
            y = im.copy(); y.thumbnail((640, 640)); y.save(os.path.join(a.out, "photos", "qgis", "t_" + b + ".jpg"), quality=80)
            figuri.append(dict(src="photos/qgis/%s.jpg" % b, thumb="photos/qgis/t_%s.jpg" % b, titlu=tit))
    D = dict(
        proiect=dict(titlu="Penetrări dinamice super-grele (DPSH) – H2 Plant Cernavodă",
                     obiectiv="Construire capacitate de producție hidrogen verde prin electroliză, capacități de comprimare și stocare",
                     beneficiar_lucrare="S.C. ELEKTRA POWER S.R.L.",
                     amplasament="Orașul Cernavodă, extravilan, parcela A164/14, nr. cadastral 107056, jud. Constanța",
                     tip_lucrari="Penetrări dinamice super-grele (DPSH, SR EN ISO 22476-2), adâncime 2,00 m, pe terasamentul din pământ coeziv stabilizat cu liant hidraulic",
                     plan="Planuri Amplasare Teste In Situ Rev. 03 (17.11.2026), S.C. Eco Geo Project S.R.L.",
                     perioada=dict(de_la=min(t["data"] for t in T), pana_la=max(t["data"] for t in T)),
                     generat=datetime.date.today().isoformat()),
        echipament=ECH, baza_terasament=BAZA_TERASAMENT, clase=[dict(de=a_, la=b_, culoare=c, nume=n) for a_, b_, c, n in CLASE],
        sectiune=[dict(de=0.0, la=1.0, nume="Terasament din pământ coeziv stabilizat cu liant hidraulic (4 straturi × 0,25 m)"),
                  dict(de=1.0, la=2.0, nume="Teren natural – praf argilos loessoid")],
        dpsh=T, meteo=meteo, figuri=figuri,
        observatii=["În teren punctele sunt notate L4 … L12, iar planul Rev. 03 le numește DPSH 1 … 23; corespondența nu reiese din documente.",
                    "Împărțirea 0–1,00 m / 1,00–2,00 m presupune că testele au pornit de la cota superioară a stratului IV (C.S.T.).",
                    "Modelul exact al penetrometrului Pagani nu se citește din fotografii; s-a folosit presetul TG 63-200.",
                    "Ordinea din animație urmează ora transmiterii fotografiilor (WhatsApp), nu ora execuției."])
    json.dump(D, open(os.path.join(a.out, "data.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("data.json:", len(T), "penetrări;", sum(len(t["poze"]) + 2 for t in T), "fotografii;", len(figuri), "figuri QGIS")

if __name__ == "__main__":
    main()
