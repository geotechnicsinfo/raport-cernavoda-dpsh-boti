/* ============================================================
   Intro 3D – bloc de teren stilizat (Copernicus DEM, relieful dinaintea săpăturii) cu
   penetrările DPSH „extrase” în ordinea transmiterii fotografiilor. Three.js r128.
   window.initIntro3D(D, INV, T)  –  D = data.json, INV = D.dpsh, T = terrain.json
   Dimensiuni în metri (proiecție locală); relieful este exagerat ×VE, iar tijele sunt
   redate la scară verticală ×CORE_S. Fiecare tronson de 20 cm e colorat după N20.
   ============================================================ */
(function () {
  const VE = 1.6;           // exagerare verticală relief (amplitudine ~13 m pe 120 m)
  const CORE_S = 11;        // 1 m de penetrare = 11 m în scenă
  const R_F = 1.5, R_C = 1; // raza tijei (m în plan)
  const GAP = 5;           // distanța dintre teren și baza carotei extrase
  const BLUE = 0x0069B4, ORANGE = 0xF28C00, NAVY = 0x0A2F4F, WATER = 0x1F8FD8;

  window.initIntro3D = function (D, INV, T) {
        const host = document.getElementById('intro3d');
    if (!host || host.dataset.ready || !window.THREE || !T || !T.z) return;
    const THREE = window.THREE;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { host.classList.add('off'); return; }
    host.dataset.ready = '1';
    document.querySelector('.hero').classList.add('has3d');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 0);
    host.appendChild(renderer.domElement);

    /* ---------- geometrie: proiecție locală (m) ---------- */
    const n = T.n, latc = (T.lat0 + T.lat1) / 2, lonc = (T.lon0 + T.lon1) / 2;
    const kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 110540;
    const X = lon => (lon - lonc) * kx, Z = lat => -(lat - latc) * ky;
    const zmin = Math.min.apply(null, T.z), zmax = Math.max.apply(null, T.z);
    const H = z => (z - zmin) * VE;
    function zAt(lat, lon) {
      let fi = (lat - T.lat0) / (T.lat1 - T.lat0) * (n - 1), fj = (lon - T.lon0) / (T.lon1 - T.lon0) * (n - 1);
      fi = Math.max(0, Math.min(n - 1.001, fi)); fj = Math.max(0, Math.min(n - 1.001, fj));
      const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, g = (r, c) => T.z[r * n + c];
      return g(i, j) * (1 - a) * (1 - b) + g(i + 1, j) * a * (1 - b) + g(i, j + 1) * (1 - a) * b + g(i + 1, j + 1) * a * b;
    }
    const inside = (lat, lon) => lat >= T.lat0 && lat <= T.lat1 && lon >= T.lon0 && lon <= T.lon1;

    const SPAN = Math.max((T.lon1 - T.lon0) * kx, (T.lat1 - T.lat0) * ky);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const sun = new THREE.DirectionalLight(0xffffff, 0.62); sun.position.set(-0.6, 1.4, 0.8); scene.add(sun);
    const world = new THREE.Group(); scene.add(world);

    /* ---------- teren ---------- */
    const pos = [], col = [], idx = [], cLo = new THREE.Color(0x8FB6D9), cHi = new THREE.Color(0xEAF1F7), c = new THREE.Color();
    const P = (i, j) => { const lat = T.lat0 + i * (T.lat1 - T.lat0) / (n - 1), lon = T.lon0 + j * (T.lon1 - T.lon0) / (n - 1); return [X(lon), H(T.z[i * n + j]), Z(lat)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = P(i, j); pos.push(p[0], p[1], p[2]);
      c.copy(cLo).lerp(cHi, Math.pow((T.z[i * n + j] - zmin) / (zmax - zmin), 1.6)); col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, d = a + n, e = d + 1; idx.push(a, b, d, b, e, d); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    world.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })));
    const gl = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = P(i, j);
      if (j < n - 1) { const q = P(i, j + 1); gl.push(p[0], p[1] + 0.5, p[2], q[0], q[1] + 0.5, q[2]); }
      if (i < n - 1) { const q = P(i + 1, j); gl.push(p[0], p[1] + 0.5, p[2], q[0], q[1] + 0.5, q[2]); }
    }
    const mkLines = (arr, color, op, w) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
    world.add(mkLines(gl, NAVY, 0.14));
    const BASE = -10, sp = [], si = [], rim = [], foot = [], border = [];
    for (let j = 0; j < n; j++) border.push([0, j]);
    for (let i = 1; i < n; i++) border.push([i, n - 1]);
    for (let j = n - 2; j >= 0; j--) border.push([n - 1, j]);
    for (let i = n - 2; i >= 0; i--) border.push([i, 0]);
    border.forEach((b, k) => {
      const p = P(b[0], b[1]); sp.push(p[0], p[1], p[2], p[0], BASE, p[2]);
      const q = P(border[(k + 1) % border.length][0], border[(k + 1) % border.length][1]);
      rim.push(p[0], p[1] + 0.5, p[2], q[0], q[1] + 0.5, q[2]); foot.push(p[0], BASE, p[2], q[0], BASE, q[2]);
      const a = 2 * k, a2 = 2 * ((k + 1) % border.length); si.push(a, a + 1, a2, a2, a + 1, a2 + 1);
    });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    world.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xDCE7F1, roughness: 1, flatShading: true, side: THREE.DoubleSide })));
    world.add(mkLines(rim, NAVY, 0.85)); world.add(mkLines(foot, NAVY, 0.45));
    [[0, 0], [0, n - 1], [n - 1, n - 1], [n - 1, 0]].forEach(b => { const p = P(b[0], b[1]); world.add(mkLines([p[0], p[1], p[2], p[0], BASE, p[2]], NAVY, 0.45)); });

    /* ---------- limita proprietății, marginea lacului, clădirile propuse ---------- */
    function drape(ring, color, op, lift, closed) {
      const arr = [], m = ring.length - (closed ? 0 : 1);
      for (let k = 0; k < m; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length]; if (!inside(a[0], a[1]) || !inside(b[0], b[1])) continue;
        const N = 6; for (let s = 0; s < N; s++) { const la1 = a[0] + (b[0] - a[0]) * s / N, lo1 = a[1] + (b[1] - a[1]) * s / N, la2 = a[0] + (b[0] - a[0]) * (s + 1) / N, lo2 = a[1] + (b[1] - a[1]) * (s + 1) / N; arr.push(X(lo1), H(zAt(la1, lo1)) + lift, Z(la1), X(lo2), H(zAt(la2, lo2)) + lift, Z(la2)); }
      }
      if (arr.length) world.add(mkLines(arr, color, op));
    }
    if (D.limita) drape(D.limita, ORANGE, 0.95, 0.8, false);
    if (D.lac) drape(D.lac, WATER, 0.95, 0.8, false);
    (D.cladiri || []).forEach(c => {
      // amprenta clădirii: prismă joasă așezată pe teren
      const pts = c.contur.slice(0, -1); if (pts.some(p => !inside(p[0], p[1]))) return;
      const zc = Math.min.apply(null, pts.map(p => H(zAt(p[0], p[1])))), shp = new THREE.Shape();
      pts.forEach((p, k) => { const x = X(p[1]), y = -Z(p[0]); if (k) shp.lineTo(x, y); else shp.moveTo(x, y); });
      const hgt = c.tip === 'conexe' ? 9 : 6;
      const geo = new THREE.ExtrudeGeometry(shp, { depth: hgt, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c.tip === 'conexe' ? 0xF7C98A : 0xC9D6E3, transparent: true, opacity: 0.72, roughness: 1 }));
      mesh.position.y = zc - 0.5; world.add(mesh);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.45 })); e.position.y = zc - 0.5; world.add(e);
    });

    /* ---------- foraje proiectate, neexecutate ---------- */
    const execIds = new Set(INV.map(i => i.id)), pp = [];
    (D.puncte_proiectate || []).forEach(p => { if (execIds.has(p.id) || !inside(p.lat, p.lon)) return; pp.push(X(p.lon), H(zAt(p.lat, p.lon)) + 2, Z(p.lat)); });
    if (pp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); world.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x7B8794, size: 5, sizeAttenuation: false }))); }

    /* ---------- carote (foraje) + tije (CPT) ---------- */
    const items = [];
    INV.forEach(i => { if (i.lat != null && inside(i.lat, i.lon)) items.push({ kind: 'dpsh', id: i.id, data: i.data, ord: i.ordine || 0, ad: +i.adancime || 2, lat: i.lat, lon: i.lon, i }); });
    const order = items.sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || a.ord - b.ord || a.id.localeCompare(b.id, undefined, { numeric: true }));
    const cores = [], hits = [], matCache = {};
    const mat = hex => matCache[hex] || (matCache[hex] = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.85, metalness: 0 }));
    const CL = D.clase || [], zb = (D.baza_terasament || 1) * CORE_S;
    order.forEach((it, k) => {
      const R = R_F, L = it.ad * CORE_S;
      const g = new THREE.Group(); g.position.set(X(it.lon), H(zAt(it.lat, it.lon)), Z(it.lat)); world.add(g);
      const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.4, R * 2.3, 24), new THREE.MeshBasicMaterial({ color: ORANGE, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; g.add(ring);
      const stemG = new THREE.BufferGeometry(); stemG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      const stem = new THREE.Line(stemG, new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.5 })); g.add(stem);
      const core = new THREE.Group(); g.add(core);
      // tronsoane de 20 cm: culoare = clasa N20, grosime ușor crescută cu N20
      it.i.randuri.forEach(r => {
        const h = 0.2 * CORE_S, rr = R * (0.75 + 0.7 * Math.min(r.N, 40) / 40);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, h * 0.94, 14), mat((CL[r.cls] || {}).culoare || '#0069B4')); m.position.y = -(r.z - 0.1) * CORE_S; core.add(m);
      });
      const tipc = new THREE.Mesh(new THREE.ConeGeometry(R * 1.5, 3.2, 14), new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.6 }));
      tipc.rotation.x = Math.PI; tipc.position.y = -L - 1.6; core.add(tipc);                 // conul la bază
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.7, R * 1.7, 1.6, 14), new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.6 })); cap.position.y = 0.8; core.add(cap);
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(R * 3, R * 3, 0.5, 26), new THREE.MeshBasicMaterial({ color: NAVY, transparent: true, opacity: 0.35, depthWrite: false })); bt.position.y = -zb; core.add(bt);  // baza terasamentului (plan)
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(R * 3.2, R * 3.2, L + 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = -L / 2 + 3; hit.userData.it = it; core.add(hit); hits.push(hit);
      cores.push({ it, g, core, stem, L, k, label: null });
    });

    function addLabels() {
      cores.forEach(o => {
        const txt = o.it.id;
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const x = cv.getContext('2d');
        x.font = (o.it.kind === 'cpt' ? '500 46px' : '600 58px') + ' "Barlow Condensed", "Barlow", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,.95)'; x.strokeText(txt, 128, 50);
        x.fillStyle = o.it.kind === 'cpt' ? '#9a5a00' : '#0A2F4F'; x.fillText(txt, 128, 50);
        const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        const s = 15; sp.scale.set(s, s * 0.375, 1); sp.position.y = 5.5; o.core.add(sp); o.label = sp;
      });
    }
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(addLabels, addLabels);

    /* ---------- HUD ---------- */
    const hud = document.createElement('div'); hud.className = 'i3-hud';
    hud.innerHTML = '<div class="i3-date"><b id="i3-d">—</b><span id="i3-n"></span></div>' +
      '<div class="i3-leg">' + CL.map(c => '<span><i style="background:' + c.culoare + ';border:1px solid #0A2F4F"></i>' + c.nume + '</span>').join('') + '</div>' +
      '<div class="i3-leg"><span>N<sub>20</sub> [lovituri / 20 cm]</span><span><i style="background:#0A2F4F;opacity:.4;border-radius:50%"></i>baza terasamentului (1,00 m, plan)</span></div>' +
      '<div class="i3-note">Relief Copernicus DEM GLO-90, anterior săpăturii (platforma excavată nu este reprezentată), scară verticală ×' + VE + ' · penetrări redate ×' + CORE_S + ' · ordinea = ora transmiterii fotografiilor · trage pentru a roti</div>' +
      '<button class="btn" id="i3-replay" type="button">↻ Reia animația</button>';
    host.appendChild(hud);
    const tip = document.createElement('div'); tip.className = 'i3-tip'; host.appendChild(tip);
    const elD = hud.querySelector('#i3-d'), elN = hud.querySelector('#i3-n');
    const fmt = s => { if (!s) return '—'; const p = s.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };

    /* ---------- cameră ---------- */
    const camera = new THREE.PerspectiveCamera(30, 2, 2, 8000);
    const target = new THREE.Vector3(0, 16, 0);
    let az = -0.65, el = 0.46, elBase = 0.46, Rad = 2500, W = 0, Hh = 0, lastUser = 0;
    function resize() {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; W = w; Hh = h;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      Rad = SPAN * 2.25 * Math.max(1, 1.75 / camera.aspect); if (Rad > SPAN * 5) Rad = SPAN * 5;
      if (w > 900) camera.setViewOffset(w, h, -w * 0.13, -h * 0.02, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
    resize();

    /* ---------- interacțiune ---------- */
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let drag = null, moved = 0, hover = null;
    const cvs = renderer.domElement; cvs.style.touchAction = 'pan-y';
    function pick(ev) {
      const r = cvs.getBoundingClientRect(); mouse.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(hits, false); return h.length ? h[0].object.userData.it : null;
    }
    cvs.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az, el: elBase }; moved = 0; try { cvs.setPointerCapture(e.pointerId); } catch (_) {} });
    cvs.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
        az = drag.az - dx * 0.006; if (e.pointerType !== 'touch') elBase = Math.max(0.18, Math.min(1.25, drag.el + dy * 0.004));
        lastUser = performance.now(); tip.style.display = 'none'; return;
      }
      const it = pick(e); hover = it; cvs.style.cursor = it ? 'pointer' : 'grab';
      if (it) {
        const r = host.getBoundingClientRect(); const f1 = v => (+v).toFixed(1).replace('.', ',');
        const body = '<b>' + it.id + '</b> · DPSH<br>' + fmt(it.data) + ' · ' + it.ad.toFixed(2).replace('.', ',') + ' m<br>N<sub>20</sub> mediu: ' + f1(it.i.N_med_sup) + ' (0–1 m) · ' + f1(it.i.N_med_inf) + ' (1–2 m)<br><em>click pentru fișă</em>';
        tip.innerHTML = body; tip.style.display = 'block'; tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
      } else tip.style.display = 'none';
    });
    const end = e => { if (drag && moved < 6) { const it = pick(e); if (it) location.hash = '#/p/' + it.id; } drag = null; };
    cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', () => { drag = null; });
    cvs.addEventListener('pointerleave', () => { tip.style.display = 'none'; hover = null; });

    /* ---------- animație ---------- */
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STEP = 0.55, DUR = 1.4, T0 = 0.7; let t0 = performance.now(), visible = true, lastShown = -1;
    hud.querySelector('#i3-replay').onclick = () => { t0 = performance.now(); lastShown = -1; };
    if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
    const ease = x => 1 - Math.pow(1 - x, 3);
    let prev = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !W || document.hidden) { prev = now; return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; const t = (now - t0) / 1000;
      let shown = -1, ml = 0, mc = 0;
      cores.forEach(o => {
        let p = reduce ? 1 : (t - T0 - o.k * STEP) / DUR; p = p < 0 ? 0 : p > 1 ? 1 : p; const e = ease(p);
        if (p > 0) { shown = Math.max(shown, o.k); const v = o.it.ad * (p >= 1 ? 1 : e); if (o.it.kind === 'cpt') mc += v; else ml += v; }
        o.core.position.y = e * (o.L + GAP) + (p >= 1 && !reduce ? Math.sin(now / 900 + o.k) * 0.5 : 0);
        o.core.visible = p > 0; o.core.rotation.y = (1 - e) * 2.2;
        const a = o.stem.geometry.attributes.position; a.setY(1, Math.max(0, o.core.position.y - o.L)); a.needsUpdate = true;
        o.core.scale.setScalar(hover === o.it ? 1.15 : 1);
        o.core.children.forEach(ch => { if (ch.userData.pulse) { const s = 1 + 0.12 * Math.sin(now / 420 + o.k); ch.scale.set(s, 1, s); } });
      });
      if (shown !== lastShown) { lastShown = shown; elD.textContent = shown < 0 ? fmt(order[0] && order[0].data) : fmt(order[shown].data); }
      elN.textContent = (shown + 1) + ' / ' + order.length + ' penetrări · ' + ml.toFixed(1).replace('.', ',') + ' m';
      if (!drag && !reduce && now - lastUser > 2500) az += dt * 0.055;
      const sc = Math.max(0, Math.min(1, -host.getBoundingClientRect().top / Math.max(1, Hh)));
      el += ((elBase + sc * 0.45) - el) * 0.08;
      const ce = Math.cos(el);
      camera.position.set(target.x + Rad * ce * Math.sin(az), target.y + Rad * Math.sin(el), target.z + Rad * ce * Math.cos(az));
      camera.lookAt(target); renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  };
})();
