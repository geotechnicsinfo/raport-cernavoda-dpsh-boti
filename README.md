# Penetrări dinamice super-grele (DPSH) – H2 Plant Cernavodă

Aplicație web statică (fără backend), după modelul rapoartelor `raport-investigatii-sibiu` și
`raport-investigatii-balotesti`, pentru penetrările DPSH executate la 17.11.2026 pe terasamentul din
pământ coeziv stabilizat cu liant hidraulic (beneficiar S.C. Elektra Power S.R.L.).

Pentru fiecare penetrare: fișa de teren fotografiată + eticheta de la gura sondajului, transcrierea
loviturilor, diagrama N<sub>20</sub> + q<sub>d</sub>, tabelul pe tronsoane de 20 cm, GPS + Stereo 70,
mini-hartă, meteo, fotografii de teren. Plus: intro 3D (bloc de teren cu tijele „extrase”, colorate după
N<sub>20</sub>), hartă, hărți de egale lovituri pe primul metru (IDW, din 20 în 20 cm), comparație între puncte, figuri QGIS, calendar, centralizator + CSV.

## Structura

```
index.html            aplicația (HTML + CSS + JS, un singur fișier)
intro3d.js            intro 3D (Three.js r128)
data.json             penetrări + echipament + meteo + figuri (generat)
terrain.json          grilă de cote 17×17 (Copernicus DEM GLO-90, interpolat) – relieful dinaintea săpăturii
photos/<ID>/          poze optimizate (1200 px) + miniaturi t_*.jpg + fisa1.jpg + eticheta.jpg (generat)
photos/qgis/          figurile exportate din QGIS (generat)
scripts/build_data.py generatorul data.json + poze
scripts/stereo70.py   WGS84 -> Stereo 70 (copiat din Balotești)
scripts/meteo.json    răspunsul Open-Meteo pentru 14–17.11.2026
```

## Surse de date (`Work\2026\Penetrari dpsh Cernavoda`)

- `DPSH Cernavoda - lovituri.csv` – transcrierea fișelor (sursa de adevăr): punct, dată, GPS, cele 10 valori N<sub>20</sub>,
  numele fotografiei cu fișa și al celei cu eticheta (+ rotația), coloana opțională `de_verificat` (observații separate prin `|`, fără `;`; goală după confirmare).
- `Raw data\L4 … L12` – fotografiile WhatsApp din teren.
- `Input\Planuri Amplasare Teste In Situ Rev.03 …pdf` – planul Eco Geo Project (secțiunea 1,00 m terasament + 1,00 m teren natural).
- `Qgis\` – proiectul QGIS, GeoJSON-ul cu punctele în Stereo 70 și scriptul de figuri.
- `DPSH Cernavoda H2 Plant 17.11.2026.dips.dipx` – aceleași date în GeoStru Dynamic Probing.

## Regenerarea datelor

```bash
cd raport-investigatii-cernavoda
python3 scripts/build_data.py --csv "../DPSH Cernavoda - lovituri.csv" --poze "../Raw data" \
  --meteo scripts/meteo.json --figuri "../Qgis/figuri" --out .
```

Necesită `Pillow`. Pozele deja procesate sunt sărite. Pentru o corecție de citire (ex. L4 la 0,80 m: 39 → 33)
se modifică CSV-ul și se rulează din nou; valoarea trebuie corectată și în fișierul Dynamic.

Figurile QGIS: în consola Python din QGIS,
`exec(open(r'...\Penetrari dpsh Cernavoda\Qgis\fig_qgis_cernavoda.py', encoding='utf-8').read())`.

## Calcul

Preset GeoStru „DPSH TG 63-200 PAGANI”: M = 63,5 kg, H = 0,75 m, A = 20,43 cm², δ = 20 cm, tije 6,31 kg/m,
nicovală 0,63 kg, prima îmbinare la 0,40 m. R<sub>pd</sub> = M²·H / [A·e·(M+P)], e = δ/N<sub>20</sub>;
N<sub>SPT</sub> = 1,47·N<sub>20</sub>. Valorile coincid cu cele afișate de Dynamic Probing.

## Observații asupra datelor

- Citirile din fișe și coordonatele au fost confirmate de Ioan Boți (18.11.2026): L4 la 0,80 m = 39, L8 la 0,40 m = 30, L6 la 1,80 m = 2; L4 la N 44°20'09,3", L11 la N 44°20'08,2".
- Punctele sunt notate în teren L4 … L12; planul Rev. 03 le numește DPSH 1 … 23 – corespondența nu reiese din documente.
- Împărțirea 0–1 m / 1–2 m presupune că testele au pornit de la cota superioară a stratului IV (C.S.T.).
- Modelul penetrometrului Pagani nu se citește din fotografii; s-a folosit presetul TG 63-200.
- Relieful din intro-ul 3D este cel dinaintea săpăturii (DEM global, 90 m); platforma excavată nu este reprezentată.
- Meteo: model de prognoză Open-Meteo (punct de grilă la ~5 km), nu reanaliză.

## Rulare locală / publicare

```bash
python -m http.server 8000     # apoi http://localhost:8000
```

Deschis direct de pe disc (file://) nu se încarcă `data.json`. Pentru publicare: repo GitHub nou, Settings → Pages →
Source: *GitHub Actions*; workflow-ul `.github/workflows/pages.yml` publică la fiecare push pe `main`.
