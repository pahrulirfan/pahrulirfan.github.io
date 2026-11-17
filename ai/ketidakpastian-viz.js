/*!
 * ketidakpastian-viz.js — Visualisasi interaktif penalaran dalam ketidakpastian
 * untuk materi Kecerdasan Buatan (MKL1303131), Pertemuan 11 (Sub-CPMK6).
 *
 * Memakai tampilan dasar (.viz, .viz-btn, .viz-block) dari style.css. Mesin hitung di sini ditulis
 * ulang untuk materi ini (JavaScript murni, tanpa pustaka). Angka contoh flu, contoh tiga hipotesis
 * dan tiga bukti, serta jaringan Bayes mengikuti slide "06. Materi Uncertainty" (2022), dengan
 * koreksi yang dicatat di halaman: MB memakai max, MD memakai min, hasil gabungan 0,4286 (bukan 0,42),
 * posterior dibulatkan (bukan dipotong), dan baris terakhir CPT rumput basah T = 0,0.
 *
 * Pemakaian: <div data-viz="..."> di halaman, lalu muat file ini.
 *   data-viz="cf-vs-fuzzy"  satu pasien, dua jenis tidak pasti: CF (info belum lengkap) vs derajat fuzzy (kategori kabur)
 *   data-viz="cf-hitung"    MB, MD, dan CF dari peluang awal dan peluang setelah bukti
 *   data-viz="cf-gabung"    menggabungkan dua CF untuk hipotesis yang sama (tiga kasus tanda)
 *   data-viz="cf-premis"    premis banyak: AND = minimum, OR = maksimum, dikali CF rule
 *   data-viz="cf-rantai"    aturan berantai A -> B -> C: keyakinan menyusut tiap langkah
 *   data-viz="cf-flu"       pohon inferensi contoh flu, langkah demi langkah (CF rule pada aturan)
 *   data-viz="bayes-lab"    kotak peluang (mosaik) dua kejadian
 *                           data-fokus="peluang" (gabungan, bersyarat, independen) atau "bayes" (posterior)
 *   data-viz="bayes-update" tiga hipotesis dan tiga bukti; bukti diamati satu per satu
 *   data-viz="bayes-net"    jaringan Bayes Berawan-Sprinkler-Hujan-Rumput basah (enumerasi)
 *   data-viz="dup-lab"      bukti yang sama dihitung berulang: Bayes naif dan CF menjadi terlalu yakin
 */
(function (root) {
    'use strict';

    /* =====================================================================
     * 1. MESIN HITUNG (murni, tanpa DOM)
     * ===================================================================== */

    // ---------- certainty factor ----------
    /** Ukuran kepercayaan MB(H,E): bentuk baku, memakai max agar tidak pernah negatif. */
    const mb = (ph, phe) => (ph >= 1 ? 1 : (Math.max(phe, ph) - ph) / (1 - ph));
    /** Ukuran ketidakpercayaan MD(H,E): bentuk baku, memakai min agar tidak pernah negatif. */
    const md = (ph, phe) => (ph <= 0 ? 1 : (ph - Math.min(phe, ph)) / ph);
    const cfDari = (ph, phe) => {
        const m = mb(ph, phe), d = md(ph, phe);
        return (m - d) / (1 - Math.min(m, d));
    };
    /** Dua CF untuk hipotesis yang sama. Mengembalikan {nilai, kasus}; kasus: 'positif'|'negatif'|'beda'|'nol'|'tak-terdefinisi'. */
    function gabungDetail(a, b) {
        if (a === 0) return { nilai: b, kasus: 'nol' };
        if (b === 0) return { nilai: a, kasus: 'nol' };
        if (a > 0 && b > 0) return { nilai: a + b * (1 - a), kasus: 'positif' };
        if (a < 0 && b < 0) return { nilai: a + b * (1 + a), kasus: 'negatif' };
        const den = 1 - Math.min(Math.abs(a), Math.abs(b));
        if (den === 0) return { nilai: 0, kasus: 'tak-terdefinisi' };
        return { nilai: (a + b) / den, kasus: 'beda' };
    }
    const gabung = (a, b) => gabungDetail(a, b).nilai;
    const gabungBanyak = list => list.reduce((acc, x) => gabung(acc, x), 0);
    /** Premis AND: minimum, hanya bila semua premis > 0; selain itu aturan tidak berlaku (0). */
    const premisDan = list => (Math.min.apply(null, list) > 0 ? Math.min.apply(null, list) : 0);
    /** Premis OR: maksimum, hanya bila ada premis > 0. */
    const premisAtau = list => (Math.max.apply(null, list) > 0 ? Math.max.apply(null, list) : 0);
    /** Evidence tidak pasti: CF(H) = CF(E) x CF(H|E) bila CF(E) > 0, selain itu 0. */
    const buktiTakPasti = (cfE, cfAturan) => (cfE > 0 ? cfE * cfAturan : 0);

    /** Istilah untuk nilai CF, dibaca dari skala istilah slide (sisi kanan). */
    const ISTILAH = [
        [1.0, 'pasti'], [0.8, 'hampir pasti'], [0.6, 'kemungkinan besar'], [0.4, 'mungkin'],
        [0.0, 'belum dapat dikatakan'],
        [-0.4, 'mungkin tidak'], [-0.6, 'kemungkinan besar tidak'], [-0.8, 'hampir pasti tidak'], [-1.0, 'pasti tidak']
    ];
    function istilahCF(x) {
        if (Math.abs(x) <= 0.2 + 1e-9) return 'belum dapat dikatakan';
        let best = null;
        ISTILAH.forEach(t => {
            if (t[0] === 0) return;
            if (!best || Math.abs(t[0] - x) < Math.abs(best[0] - x)) best = t;
        });
        return best[1];
    }

    // ---------- contoh flu ----------
    const FLU_ATURAN = { 1: 0.5, 2: 0.9, 3: 0.5, 4: 1.0, 5: -0.2, 6: 0.5, 7: 0.7 };
    /**
     * @param {{suhu:number, batuk:'kurang24'|'24-48'|'lebih48', bersin:number, kepala:number, hidung:number}} f
     */
    function fluHitung(f) {
        const demamRendah = f.suhu < 37.5 ? 1 : -1;
        const demamTinggi = f.suhu > 37.5 ? 1 : -1;
        const batuk24 = f.batuk === 'kurang24' ? -1 : 1;
        const batuk48 = f.batuk === 'lebih48' ? 1 : -1;
        const r = {};
        r[1] = buktiTakPasti(demamRendah, FLU_ATURAN[1]);
        r[2] = buktiTakPasti(demamTinggi, FLU_ATURAN[2]);
        r[3] = buktiTakPasti(batuk24, FLU_ATURAN[3]);
        r[4] = buktiTakPasti(batuk48, FLU_ATURAN[4]);
        const gejala = gabung(r[1], r[2]);
        const tenggorokan = gabung(r[3], r[4]);
        const premis5 = premisDan([gejala, f.bersin]);
        r[5] = premis5 * FLU_ATURAN[5];
        r[6] = buktiTakPasti(tenggorokan, FLU_ATURAN[6]);
        const premis7 = premisDan([f.kepala, f.hidung]);
        r[7] = premis7 * FLU_ATURAN[7];
        const akhir = gabung(gabung(r[5], r[6]), r[7]);
        return {
            leaf: { demamRendah, demamTinggi, batuk24, batuk48 }, r, gejala, tenggorokan, premis5, premis7, akhir
        };
    }

    // ---------- peluang dan Bayes ----------
    /** Kotak peluang dua kejadian dari P(A), P(B|A), P(B|tidak A). */
    function kotak(pA, pBA, pBnA) {
        const AB = pA * pBA, AnB = pA * (1 - pBA), nAB = (1 - pA) * pBnA, nAnB = (1 - pA) * (1 - pBnA);
        const pB = AB + nAB;
        return {
            AB, AnB, nAB, nAnB, pA, pB, pBA, pBnA,
            gabungan: pA + pB - AB,
            AgB: pB > 0 ? AB / pB : NaN,
            independen: Math.abs(pBA - pBnA) < 1e-9,
            terpisah: AB < 1e-9 && pA > 0 && pB > 0
        };
    }

    const PRIOR = { A1: 0.5, A2: 0.3, A3: 0.2 };
    const LIK = {
        B1: { A1: 0.6, A2: 0.7, A3: 0.1 },
        B2: { A1: 0.3, A2: 0.3, A3: 0.9 },
        B3: { A1: 0.0, A2: 0.5, A3: 0.4 }
    };
    /** Posterior tiga hipotesis bila bukti `bukti` (daftar nama) sudah diamati. lik boleh diganti. */
    function posterior(bukti, lik) {
        lik = lik || LIK;
        const kunci = Object.keys(PRIOR);
        const pembilang = {};
        kunci.forEach(a => { pembilang[a] = bukti.reduce((p, b) => p * lik[b][a], PRIOR[a]); });
        const z = kunci.reduce((s, a) => s + pembilang[a], 0);
        const post = {};
        kunci.forEach(a => { post[a] = z > 0 ? pembilang[a] / z : NaN; });
        return { pembilang, z, post };
    }

    // ---------- jaringan Bayes ----------
    // Baris terakhir CPT rumput basah pada slide tertulis T = 1,0 dan F = 0,0; yang benar T = 0,0 dan F = 1,0.
    const NET = {
        C: { nama: 'Berawan', p: () => 0.5 },
        S: { nama: 'Sprinkler menyala', p: s => (s.C ? 0.1 : 0.5) },
        R: { nama: 'Hujan', p: s => (s.C ? 0.8 : 0.2) },
        W: { nama: 'Rumput basah', p: s => (s.S ? (s.R ? 0.99 : 0.9) : (s.R ? 0.9 : 0.0)) }
    };
    const NET_ORDE = ['C', 'S', 'R', 'W'];
    /** evidence: {C:true|false, ...} untuk simpul yang diamati. Mengembalikan {marginal:{C,S,R,W}, peluangBukti}. */
    function netHitung(evidence) {
        const total = { C: 0, S: 0, R: 0, W: 0 };
        let z = 0;
        for (let m = 0; m < 16; m++) {
            const s = { C: !!(m & 1), S: !!(m & 2), R: !!(m & 4), W: !!(m & 8) };
            if (NET_ORDE.some(k => evidence[k] !== undefined && evidence[k] !== s[k])) continue;
            let p = 1;
            NET_ORDE.forEach(k => { const t = NET[k].p(s); p *= s[k] ? t : 1 - t; });
            z += p;
            NET_ORDE.forEach(k => { if (s[k]) total[k] += p; });
        }
        const marginal = {};
        NET_ORDE.forEach(k => { marginal[k] = z > 0 ? total[k] / z : NaN; });
        return { marginal, peluangBukti: z };
    }

    // ---------- bukti yang sama dihitung berulang ----------
    const DUP = { prior: 0.5, pEH: 0.8, pEnH: 0.4, cf: 0.5 };
    function dupHitung(n) {
        const naif = (DUP.prior * Math.pow(DUP.pEH, n)) / (DUP.prior * Math.pow(DUP.pEH, n) + (1 - DUP.prior) * Math.pow(DUP.pEnH, n));
        const benar = (DUP.prior * DUP.pEH) / (DUP.prior * DUP.pEH + (1 - DUP.prior) * DUP.pEnH);
        let cf = 0;
        for (let i = 0; i < n; i++) cf = gabung(cf, DUP.cf);
        return { naif, benar, cf };
    }

    /* =====================================================================
     * 2. TAMPILAN (hanya jika ada DOM)
     * ===================================================================== */
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const num = (x, d) => {
        let v = Number(x.toFixed(d === undefined ? 2 : d));
        if (Object.is(v, -0)) v = 0;
        return String(v).replace('.', ',').replace('-', '−');
    };
    const pct = (x, d) => (x * 100).toFixed(d === undefined ? 1 : d).replace('.', ',') + '%';

    const CSS = [
        '.kp .kp-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;font-size:.88em}',
        '.kp .kp-row>b{color:#1a2a4a}',
        '.kp .kp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px 22px;margin-bottom:12px}',
        '.kp .kp-sl{display:flex;flex-direction:column;gap:2px;font-size:.88em;color:#1a2a4a}',
        '.kp .kp-sl label{display:flex;justify-content:space-between;gap:8px;font-weight:600}',
        '.kp .kp-sl output{font-family:Consolas,Monaco,monospace;color:#0d47a1;font-weight:700}',
        '.kp .kp-sl input[type=range]{width:100%;accent-color:#1565c0}',
        '.kp .kp-sl select{font:inherit;padding:5px 8px;border:1px solid #b0c4de;border-radius:6px;background:#fff}',
        '.kp .kp-out{background:#fff;border:1px solid #e3e8f0;border-radius:10px;padding:10px 14px;font-size:.92em;line-height:1.6}',
        '.kp .kp-out p{margin:0 0 6px}',
        '.kp .kp-out p:last-child{margin-bottom:0}',
        '.kp .kp-f{display:inline-block;font-family:Consolas,Monaco,monospace;background:#f5f8ff;border:1px solid #d6e2f3;border-radius:6px;padding:1px 8px;font-weight:700;color:#1a2a4a}',
        '.kp .kp-big{font-size:1.25em;font-weight:700;color:#0d47a1}',
        '.kp .kp-note{font-size:.85em;color:#546e7a;margin:8px 0 0;line-height:1.5}',
        '.kp .kp-warn{background:#fff8e1;border-left:4px solid #f9a825;border-radius:0 8px 8px 0;padding:8px 12px;margin-top:8px;font-size:.9em}',
        '.kp .kp-ok{background:#e8f5e9;border-left:4px solid #2e7d32;border-radius:0 8px 8px 0;padding:8px 12px;margin-top:8px;font-size:.9em}',
        '.kp .kp-bad{background:#fce4ec;border-left:4px solid #c62828;border-radius:0 8px 8px 0;padding:8px 12px;margin-top:8px;font-size:.9em}',
        '.kp .kp-tab{width:100%;border-collapse:collapse;font-size:.86em;margin:6px 0 0}',
        '.kp .kp-tab th,.kp .kp-tab td{border:1px solid #d6e2f3;padding:5px 8px;text-align:center}',
        '.kp .kp-tab th{background:#1a2a4a;color:#fff}',
        '.kp .kp-tab td:first-child{text-align:left;font-weight:700}',
        '.kp .kp-tab tr.hit td{background:#ffe0b2;font-weight:700}',
        '.kp .kp-tab tr.gone td{color:#9e9e9e}',
        '.kp .kp-scroll{overflow-x:auto}',
        '.kp .kp-scroll>*{min-width:520px}',
        /* skala CF */
        '.kp .kp-scale{position:relative;height:16px;border-radius:8px;margin:26px 8px 28px;background:linear-gradient(90deg,#ef9a9a,#eceff1 50%,#a5d6a7)}',
        '.kp .kp-scale::before{content:"";position:absolute;left:50%;top:-4px;bottom:-4px;border-left:2px solid #607d8b}',
        '.kp .kp-tick{position:absolute;top:19px;transform:translateX(-50%);font-size:.72em;color:#607d8b;font-weight:600}',
        '.kp .kp-mark{position:absolute;top:-22px;transform:translateX(-50%);font-size:.74em;font-weight:700;white-space:nowrap;text-align:center;line-height:1.1}',
        '.kp .kp-mark::after{content:"";display:block;margin:2px auto 0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid currentColor}',
        '.kp .kp-mark.m1{color:#1565c0}.kp .kp-mark.m2{color:#e65100}.kp .kp-mark.m3{color:#1b5e20;top:-36px}',
        '.kp .kp-bar{position:relative;height:22px;border-radius:11px;background:#e3e8f0;overflow:hidden;min-width:110px}',
        '.kp .kp-bar i{position:absolute;left:0;top:0;bottom:0;background:#90caf9;border-radius:11px;transition:width .3s}',
        '.kp .kp-bar.b2 i{background:#ffcc80}.kp .kp-bar.b3 i{background:#a5d6a7}.kp .kp-bar.b4 i{background:#ce93d8}',
        '.kp .kp-bar b{position:relative;z-index:1;font-size:.8em;padding:0 8px;line-height:22px;color:#0d1b3a}',
        /* chip */
        '.kp .kp-chip{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #b0c4de;background:#fff;border-radius:18px;padding:4px 13px;font:inherit;font-size:.92em;font-weight:600;color:#1a2a4a;cursor:pointer;transition:background .2s,border-color .2s}',
        '.kp .kp-chip small{font-weight:400;color:#546e7a}',
        '.kp .kp-chip:hover{border-color:#1565c0}',
        '.kp .kp-chip.on{background:#e8f5e9;border-color:#2e7d32}',
        '.kp .kp-chip.no{background:#fce4ec;border-color:#c62828}',
        /* svg umum */
        '.kp svg{display:block;width:100%;height:auto}',
        '.kp svg text{font-family:"Segoe UI",Tahoma,sans-serif}',
        '.kp .kp-stage{background:#fff;border:1px solid #e3e8f0;border-radius:10px;padding:6px;margin-bottom:12px}',
        '.kp .kp-n rect,.kp .kp-n ellipse{fill:#fff;stroke:#90a4ae;stroke-width:1.8;transition:fill .3s,stroke .3s}',
        '.kp .kp-n.pos rect,.kp .kp-n.pos ellipse{fill:#e8f5e9;stroke:#2e7d32}',
        '.kp .kp-n.neg rect,.kp .kp-n.neg ellipse{fill:#fce4ec;stroke:#c62828}',
        '.kp .kp-n.nol rect,.kp .kp-n.nol ellipse{fill:#f5f5f5;stroke:#9e9e9e;stroke-dasharray:5 3}',
        '.kp .kp-n.rule rect{fill:#f5f8ff;stroke:#1565c0}',
        '.kp .kp-n.now rect,.kp .kp-n.now ellipse{stroke-width:3.2}',
        '.kp .kp-n text{font-size:11.5px;font-weight:600;fill:#263238;text-anchor:middle;pointer-events:none}',
        '.kp .kp-n text.v{font-size:11px;font-weight:700;fill:#37474f}',
        '.kp .kp-e{fill:none;stroke:#b0bec5;stroke-width:1.8;marker-end:url(#kp-arr)}',
        '.kp .kp-e.on{stroke:#2e7d32;stroke-width:2.6}',
        '.kp .kp-r{font-size:12px;font-weight:700;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:3px}',
        '.kp .kp-r.p{fill:#1b5e20}.kp .kp-r.n{fill:#b71c1c}.kp .kp-r.z{fill:#757575}',
        '.kp .kp-phase{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
        '.kp .kp-phase span{font-size:.78em;font-weight:700;padding:3px 10px;border-radius:12px;background:#eceff1;color:#78909c}',
        '.kp .kp-phase span.on{background:#e65100;color:#fff}',
        '.kp .kp-phase span.done{background:#c8e6c9;color:#1b5e20}',
        '.kp .kp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}',
        '.kp .kp-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.8em;color:#455a64;margin-top:6px}',
        '.kp .kp-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
        '.kp .kp-cpt{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px}',
        '.kp .kp-cpt table{width:100%;border-collapse:collapse;font-size:.8em;background:#fff}',
        '.kp .kp-cpt th,.kp .kp-cpt td{border:1px solid #d6e2f3;padding:3px 6px;text-align:center}',
        '.kp .kp-cpt th{background:#eceff1;color:#263238}',
        '.kp .kp-cpt caption{font-size:.82em;font-weight:700;color:#1a2a4a;text-align:left;padding-bottom:2px}',
        '@media (max-width:760px){.kp .kp-cols{grid-template-columns:1fr}}'
    ].join('\n');

    function installDOM() {
        const doc = root.document;
        const st = doc.createElement('style');
        st.textContent = CSS;
        doc.head.appendChild(st);
        const defs = doc.createElement('div');
        defs.setAttribute('aria-hidden', 'true');
        defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        defs.innerHTML = '<svg width="0" height="0"><defs><marker id="kp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#90a4ae"/></marker></defs></svg>';
        doc.body.appendChild(defs);
    }

    // ---------- bagian kecil yang dipakai berulang ----------
    let UID = 0;
    function slider(role, label, min, max, step, val) {
        const id = 'kp' + (++UID);
        return '<div class="kp-sl"><label for="' + id + '"><span>' + label + '</span><output data-o="' + role + '"></output></label>' +
            '<input type="range" id="' + id + '" data-s="' + role + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
    }
    function presetRow(presets, tekan) {
        return '<div class="kp-row"><b>Coba skenario:</b>' + presets.map((p, i) =>
            '<button type="button" class="viz-btn secondary" data-pre="' + i + '">' + esc(p[0]) + '</button>').join('') + '</div>';
    }
    /** Skala -1..1 dengan penanda. markers: [{v, label, cls}] */
    function skalaCF(markers) {
        const pos = v => ((Math.max(-1, Math.min(1, v)) + 1) / 2 * 100).toFixed(1) + '%';
        return '<div class="kp-scale" aria-hidden="true">' +
            [-1, -0.5, 0, 0.5, 1].map(t => '<span class="kp-tick" style="left:' + pos(t) + '">' + num(t, 1) + '</span>').join('') +
            markers.map(m => '<span class="kp-mark ' + m.cls + '" style="left:' + pos(m.v) + '">' + m.label + '</span>').join('') + '</div>';
    }
    const bar = (frac, label, kls) =>
        '<div class="kp-bar ' + (kls || '') + '"><i style="width:' + Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%"></i><b>' + label + '</b></div>';
    function bindSliders(rootEl, state, render, fmt) {
        rootEl.querySelectorAll('input[data-s]').forEach(inp => {
            const k = inp.dataset.s;
            const sync = () => {
                state[k] = parseFloat(inp.value);
                const o = rootEl.querySelector('output[data-o="' + k + '"]');
                if (o) o.textContent = (fmt && fmt[k]) ? fmt[k](state[k]) : num(state[k], 2);
            };
            inp.addEventListener('input', () => { sync(); render(); });
            sync();
        });
    }
    function setSliders(rootEl, vals) {
        Object.keys(vals).forEach(k => {
            const inp = rootEl.querySelector('input[data-s="' + k + '"]');
            if (inp) { inp.value = vals[k]; inp.dispatchEvent(new root.Event('input')); }
        });
    }
    const $q = (rootEl, r) => rootEl.querySelector('[data-role="' + r + '"]');

    /* ---------- cf-hitung ---------- */
    function initCFHitung(rootEl) {
        const PRE = [
            ['Bukti mendukung (0,2 → 0,6)', { ph: 0.2, phe: 0.6 }],
            ['Bukti melawan (0,5 → 0,2)', { ph: 0.5, phe: 0.2 }],
            ['Bukti tidak berpengaruh', { ph: 0.4, phe: 0.4 }]
        ];
        const st = { ph: 0.2, phe: 0.6 };
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML = presetRow(PRE) +
            '<div class="kp-grid">' + slider('ph', 'P(H): peluang hipotesis sebelum bukti', 0.05, 0.95, 0.05, 0.2) +
            slider('phe', 'P(H|E): peluang hipotesis setelah bukti E', 0.05, 0.95, 0.05, 0.6) + '</div>' +
            '<div class="kp-out" data-role="out"></div>';
        function render() {
            const m = mb(st.ph, st.phe), d = md(st.ph, st.phe), c = cfDari(st.ph, st.phe);
            const arah = st.phe > st.ph ? 'menaikkan' : st.phe < st.ph ? 'menurunkan' : 'tidak mengubah';
            $q(rootEl, 'out').innerHTML =
                '<p>Bukti E <b>' + arah + '</b> peluang H dari ' + num(st.ph) + ' menjadi ' + num(st.phe) + '.</p>' +
                '<p>MB = (maks{' + num(st.phe) + ', ' + num(st.ph) + '} − ' + num(st.ph) + ') ÷ (1 − ' + num(st.ph) + ') = <span class="kp-f">' + num(m, 3) + '</span></p>' +
                '<p>MD = (' + num(st.ph) + ' − min{' + num(st.phe) + ', ' + num(st.ph) + '}) ÷ ' + num(st.ph) + ' = <span class="kp-f">' + num(d, 3) + '</span></p>' +
                '<p>CF = (MB − MD) ÷ (1 − min{MB, MD}) = (' + num(m, 3) + ' − ' + num(d, 3) + ') ÷ (1 − ' + num(Math.min(m, d), 3) + ') = <span class="kp-big">' + num(c, 3) + '</span> <small>(' + istilahCF(c) + ')</small></p>' +
                skalaCF([{ v: c, label: 'CF ' + num(c, 2), cls: 'm3' }]) +
                '<p class="kp-note">Salah satu dari MB dan MD selalu 0: bukti hanya dapat mendukung atau melawan, tidak keduanya. Karena itu penyebut rumus CF selalu 1 pada contoh ini. Nilai P(H) = 0 dan P(H) = 1 (hipotesis sudah mustahil atau sudah pasti) punya aturan khusus dan sengaja tidak disediakan.</p>';
        }
        bindSliders(rootEl, st, render);
        rootEl.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => setSliders(rootEl, PRE[+b.dataset.pre][1])));
        render();
    }

    /* ---------- cf-gabung ---------- */
    function initCFGabung(rootEl) {
        const PRE = [
            ['Dua positif: 0,5 dan 0,6', { a: 0.5, b: 0.6 }],
            ['Tanda berbeda: 0,6 dan −0,3', { a: 0.6, b: -0.3 }],
            ['Dua negatif: −0,4 dan −0,5', { a: -0.4, b: -0.5 }],
            ['Bukti yang sama: 0,5 dan 0,5', { a: 0.5, b: 0.5 }]
        ];
        const st = { a: 0.5, b: 0.6 };
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML = presetRow(PRE) +
            '<div class="kp-grid">' + slider('a', 'CF rule 1 (bukti E1)', -1, 1, 0.05, 0.5) + slider('b', 'CF rule 2 (bukti E2)', -1, 1, 0.05, 0.6) + '</div>' +
            '<div class="kp-out" data-role="out"></div>';
        function render() {
            const { nilai, kasus } = gabungDetail(st.a, st.b);
            const A = num(st.a), B = num(st.b);
            const rumus = {
                positif: 'Keduanya positif: CF = CF₁ + CF₂ × (1 − CF₁) = ' + A + ' + ' + B + ' × (1 − ' + A + ')',
                negatif: 'Keduanya negatif: CF = CF₁ + CF₂ × (1 + CF₁) = ' + A + ' + (' + B + ') × (1 + (' + A + '))',
                beda: 'Tanda berbeda: CF = (CF₁ + CF₂) ÷ (1 − min{|CF₁|, |CF₂|}) = (' + A + ' + (' + B + ')) ÷ (1 − ' + num(Math.min(Math.abs(st.a), Math.abs(st.b))) + ')',
                nol: 'Salah satu CF bernilai 0: aturan itu tidak menambah apa pun, hasilnya sama dengan CF yang lain.',
                'tak-terdefinisi': 'Satu bukti menyatakan pasti benar dan satu lagi pasti salah: rumus membagi dengan 0, hasilnya tidak terdefinisi (kontradiksi pada basis aturan).'
            }[kasus];
            let extra = '';
            if (kasus === 'positif' || kasus === 'negatif') extra = '<p class="kp-note">Hasilnya lebih ' + (kasus === 'positif' ? 'besar' : 'negatif') + ' daripada kedua CF, tetapi tidak pernah melewati ' + (kasus === 'positif' ? '1' : '−1') + '. Dua aturan yang searah saling menguatkan dengan hasil yang makin mengecil.</p>';
            if (kasus === 'beda') extra = '<p class="kp-note">Bukti yang berlawanan saling mengurangi. Pada tanda berbeda, hasil berada di antara kedua CF.</p>';
            $q(rootEl, 'out').innerHTML =
                '<p>' + rumus + (kasus === 'tak-terdefinisi' || kasus === 'nol' ? '' : ' = <span class="kp-big">' + num(nilai, 3) + '</span>') + '</p>' +
                (kasus === 'tak-terdefinisi' ? '' : '<p>CF gabungan ≈ <span class="kp-f">' + num(nilai, 2) + '</span> <small>(' + istilahCF(nilai) + ')</small></p>') +
                skalaCF([{ v: st.a, label: 'E1 ' + A, cls: 'm1' }, { v: st.b, label: 'E2 ' + B, cls: 'm2' }, { v: nilai, label: 'gabungan ' + num(nilai, 2), cls: 'm3' }]) + extra;
        }
        bindSliders(rootEl, st, render);
        rootEl.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => setSliders(rootEl, PRE[+b.dataset.pre][1])));
        render();
    }

    /* ---------- cf-premis ---------- */
    function initCFPremis(rootEl) {
        const st = { e1: 0.8, e2: 0.7, e3: 0.5, e4: 0.3, e5: 0.9, rule: 0.65 };
        let mode = 'and';
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML =
            '<div class="kp-row"><b>Penghubung premis:</b>' +
            '<button type="button" class="viz-btn" data-mode="and">AND (minimum)</button>' +
            '<button type="button" class="viz-btn secondary" data-mode="or">OR (maksimum)</button>' +
            '<button type="button" class="viz-btn secondary" data-role="neg">Jadikan E4 negatif</button></div>' +
            '<div class="kp-grid">' + [1, 2, 3, 4, 5].map(i => slider('e' + i, 'CF premis E' + i, -1, 1, 0.05, st['e' + i])).join('') +
            slider('rule', 'CF rule', -1, 1, 0.05, 0.65) + '</div>' +
            '<div class="kp-out" data-role="out"></div>';
        const list = () => [st.e1, st.e2, st.e3, st.e4, st.e5];
        function render() {
            rootEl.querySelectorAll('[data-mode]').forEach(b => b.className = 'viz-btn' + (b.dataset.mode === mode ? '' : ' secondary'));
            const l = list();
            const ket = l.map(x => num(x)).join(', ');
            const dan = mode === 'and';
            const pick = dan ? Math.min.apply(null, l) : Math.max.apply(null, l);
            const berlaku = dan ? premisDan(l) > 0 : premisAtau(l) > 0;
            const hasil = berlaku ? pick * st.rule : 0;
            $q(rootEl, 'out').innerHTML =
                '<p>CF(H) = ' + (dan ? 'min' : 'maks') + '{' + ket + '} × CF(H|E) = ' + num(pick) + ' × ' + num(st.rule) + ' = <span class="kp-big">' + num(hasil, 3) + '</span></p>' +
                (berlaku ? '' : '<div class="kp-warn">' + (dan ? 'Satu premis AND bernilai ≤ 0 (minimum ' + num(pick) + '), jadi gabungannya ≤ 0 dan <b>aturan tidak berlaku</b>: CF(H) = 0 dan pemeriksaan premis lain dapat dihentikan.' : 'Semua premis OR bernilai ≤ 0, jadi <b>aturan tidak berlaku</b>: CF(H) = 0.') + '</div>') +
                skalaCF([{ v: hasil, label: 'CF(H) ' + num(hasil, 2), cls: 'm3' }]) +
                '<p class="kp-note">AND ibarat rantai: sekuat mata rantai terlemah (minimum). OR ibarat dua jalan: cukup satu yang terkuat (maksimum). Hasilnya selalu dikalikan CF rule, sehingga tidak pernah lebih besar daripada CF rule itu sendiri.</p>';
        }
        bindSliders(rootEl, st, render);
        rootEl.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
        $q(rootEl, 'neg').addEventListener('click', () => setSliders(rootEl, { e4: -0.3 }));
        render();
    }

    /* ---------- cf-rantai ---------- */
    function initCFRantai(rootEl) {
        const st = { a: 0.9, r1: 0.4, r2: 0.3 };
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML =
            '<div class="kp-grid">' + slider('a', 'CF(A): seberapa yakin A benar', -1, 1, 0.05, 0.9) +
            slider('r1', 'CF Rule 1 (A → B)', -1, 1, 0.05, 0.4) + slider('r2', 'CF Rule 2 (B → C)', -1, 1, 0.05, 0.3) + '</div>' +
            '<div class="kp-out" data-role="out"></div>';
        function render() {
            const b = buktiTakPasti(st.a, st.r1), c = buktiTakPasti(b, st.r2);
            const w = v => '<td style="text-align:center"><div class="kp-bar' + (v > 0 ? ' b3' : '') + '"><i style="width:' + (Math.max(0, v) * 100).toFixed(1) + '%"></i><b>' + num(v, 3) + '</b></div></td>';
            $q(rootEl, 'out').innerHTML =
                '<p>CF(B) = CF(A) × CF(Rule 1) = ' + num(st.a) + ' × ' + num(st.r1) + ' = <span class="kp-f">' + num(b, 3) + '</span>' + (st.a <= 0 ? ' <small>(A tidak dipercaya, Rule 1 tidak berlaku)</small>' : '') + '</p>' +
                '<p>CF(C) = CF(B) × CF(Rule 2) = ' + num(b, 3) + ' × ' + num(st.r2) + ' = <span class="kp-f">' + num(c, 3) + '</span>' + (b <= 0 ? ' <small>(B tidak dipercaya, Rule 2 tidak berlaku)</small>' : '') + '</p>' +
                '<table class="kp-tab"><thead><tr><th>Fakta</th><th>Keyakinan (hanya bagian positif digambar)</th></tr></thead><tbody>' +
                '<tr><td>A</td>' + w(st.a) + '</tr><tr><td>B</td>' + w(b) + '</tr><tr><td>C</td>' + w(c) + '</tr></tbody></table>' +
                '<p class="kp-note">Tiap aturan yang dilewati mengalikan dengan angka yang tidak lebih dari 1 (selama CF rule di bawah 1), sehingga keyakinan terus menyusut. Pada rantai panjang, kesimpulan akhir bergantung pada panjang rantai, bukan hanya pada kuatnya bukti.</p>';
        }
        bindSliders(rootEl, st, render);
        render();
    }

    /* ---------- cf-flu ---------- */
    function initCFFlu(rootEl) {
        const st = { suhu: 37.4, batuk: 'kurang24', bersin: 1, kepala: 0.4, hidung: 0.5 };
        let step = 0;
        const FASE = ['1. Fakta', '2. Rule 1–4', '3. Rule 5', '4. Rule 6', '5. Rule 7', '6. Gabungkan'];
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML =
            '<div class="kp-grid">' +
            '<div class="kp-sl"><label for="kpf-s"><span>Suhu badan (°C)</span></label><select id="kpf-s" data-sel="suhu"><option value="36.8">36,8 (normal)</option><option value="37.4" selected>37,4 (di bawah 37,5)</option><option value="38.5">38,5 (demam)</option></select></div>' +
            '<div class="kp-sl"><label for="kpf-b"><span>Lama batuk</span></label><select id="kpf-b" data-sel="batuk"><option value="kurang24" selected>kurang dari 24 jam</option><option value="24-48">24 sampai 48 jam</option><option value="lebih48">lebih dari 48 jam</option></select></div>' +
            slider('bersin', 'CF fakta: bersin-bersin', -1, 1, 0.1, 1) + slider('kepala', 'CF fakta: sakit kepala', -1, 1, 0.1, 0.4) + slider('hidung', 'CF fakta: hidung tersumbat', -1, 1, 0.1, 0.5) + '</div>' +
            '<div class="kp-phase" data-role="phase"></div>' +
            '<div class="kp-stage"><svg viewBox="0 0 760 450" role="img" aria-label="Pohon inferensi contoh flu dengan nilai CF"><g data-role="svg"></g></svg></div>' +
            '<div class="kp-out" data-role="out"></div>' +
            '<div class="viz-controls">' +
            '<button type="button" class="viz-btn secondary" data-role="reset">Ulang</button>' +
            '<button type="button" class="viz-btn secondary" data-role="prev">◀ Langkah sebelumnya</button>' +
            '<button type="button" class="viz-btn" data-role="next">Langkah berikutnya ▶</button></div>';
        const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'nol');
        const rcls = v => (v > 0 ? 'p' : v < 0 ? 'n' : 'z');
        function node(x, y, w, h, t1, t2, c, oval, now) {
            const shape = oval
                ? '<ellipse cx="' + x + '" cy="' + y + '" rx="' + w / 2 + '" ry="' + h / 2 + '"/>'
                : '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="6"/>';
            return '<g class="kp-n ' + c + (now ? ' now' : '') + '">' + shape +
                '<text x="' + x + '" y="' + (t2 ? y - 3 : y + 4) + '">' + esc(t1) + '</text>' +
                (t2 ? '<text class="v" x="' + x + '" y="' + (y + 11) + '">' + esc(t2) + '</text>' : '') + '</g>';
        }
        const edge = (x1, y1, x2, y2, on) => '<path class="kp-e' + (on ? ' on' : '') + '" d="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '"/>';
        const lab = (x, y, v) => '<text class="kp-r ' + rcls(v) + '" x="' + x + '" y="' + y + '">' + num(v, 2) + '</text>';
        function gambar(h) {
            let s = '';
            const R = FLU_ATURAN;
            // tepi
            const E = [
                [70, 381, 70, 326, step >= 1], [190, 381, 190, 326, step >= 1], [330, 381, 330, 326, step >= 1], [450, 381, 450, 326, step >= 1],
                [70, 284, 112, 236, step >= 1], [190, 284, 148, 236, step >= 1], [330, 284, 372, 236, step >= 1], [450, 284, 408, 236, step >= 1],
                [130, 195, 183, 141, step >= 2], [260, 195, 207, 141, step >= 2], [390, 195, 390, 141, step >= 3],
                [545, 195, 603, 141, step >= 4], [690, 195, 633, 141, step >= 4],
                [210, 97, 342, 52, step >= 2], [390, 97, 390, 58, step >= 3], [606, 97, 438, 52, step >= 4]
            ];
            E.forEach(e => { s += edge(e[0], e[1], e[2], e[3], e[4]); });
            // daun
            s += node(70, 400, 108, 34, 'demam < 37,5', 'CF ' + num(h.leaf.demamRendah, 1), cls(h.leaf.demamRendah), true);
            s += node(190, 400, 108, 34, 'demam > 37,5', 'CF ' + num(h.leaf.demamTinggi, 1), cls(h.leaf.demamTinggi), true);
            s += node(330, 400, 108, 34, 'batuk > 24 jam', 'CF ' + num(h.leaf.batuk24, 1), cls(h.leaf.batuk24), true);
            s += node(450, 400, 108, 34, 'batuk > 48 jam', 'CF ' + num(h.leaf.batuk48, 1), cls(h.leaf.batuk48), true);
            // Rule 1-4
            [[70, 1], [190, 2], [330, 3], [450, 4]].forEach(a => { s += node(a[0], 305, 74, 42, 'Rule ' + a[1], 'CF ' + num(R[a[1]], 1), 'rule', false, step === 1); });
            // keluaran Rule 1-4
            if (step >= 1) [[70, 1, -1], [190, 2, 1], [330, 3, -1], [450, 4, 1]].forEach(a => { s += lab(a[0] + a[2] * 24, 266, h.r[a[1]]); });
            // simpul tengah
            s += node(130, 215, 110, 40, 'gejala flu', step >= 1 ? 'CF ' + num(h.gejala, 2) : '?', step >= 1 ? cls(h.gejala) : 'nol', true);
            s += node(390, 215, 134, 40, 'sakit tenggorokan', step >= 1 ? 'CF ' + num(h.tenggorokan, 2) : '?', step >= 1 ? cls(h.tenggorokan) : 'nol', true);
            s += node(260, 215, 90, 40, 'bersin', 'CF ' + num(st.bersin, 1), cls(st.bersin), true);
            s += node(545, 215, 110, 40, 'sakit kepala', 'CF ' + num(st.kepala, 1), cls(st.kepala), true);
            s += node(690, 215, 120, 40, 'hidung tersumbat', 'CF ' + num(st.hidung, 1), cls(st.hidung), true);
            // Rule 5-7
            s += node(195, 118, 74, 42, 'Rule 5', 'CF ' + num(R[5], 1), 'rule', false, step === 2);
            s += node(390, 118, 74, 42, 'Rule 6', 'CF ' + num(R[6], 1), 'rule', false, step === 3);
            s += node(618, 118, 74, 42, 'Rule 7', 'CF ' + num(R[7], 1), 'rule', false, step === 4);
            if (step >= 2) s += lab(250, 74, h.r[5]);
            if (step >= 3) s += lab(410, 82, h.r[6]);
            if (step >= 4) s += lab(534, 74, h.r[7]);
            // puncak
            s += node(390, 34, 150, 44, 'Terkena flu', step >= 5 ? 'CF ' + num(h.akhir, 2) : '?', step >= 5 ? cls(h.akhir) : 'nol', true, step >= 5);
            return s;
        }
        function teks(h) {
            const R = FLU_ATURAN, A = num;
            if (step === 0) {
                return '<p>Fakta pasien diubah menjadi CF. <b>Demam ' + A(st.suhu, 1) + ' °C</b>: CF “demam &lt; 37,5” = ' + A(h.leaf.demamRendah, 1) + ' dan CF “demam &gt; 37,5” = ' + A(h.leaf.demamTinggi, 1) + '. Batuk: “&gt; 24 jam” = ' + A(h.leaf.batuk24, 1) + ', “&gt; 48 jam” = ' + A(h.leaf.batuk48, 1) + '. Gejala lain sudah punya CF dari pasien. Fakta yang <b>ditolak</b> diberi CF −1,0 (bukan 0): kita tahu ia salah.</p>';
            }
            if (step === 1) {
                const baris = (n, premis, cfp) => '<tr class="' + (cfp > 0 ? 'hit' : 'gone') + '"><td>Rule ' + n + '</td><td>' + premis + ' = ' + A(cfp, 1) + '</td><td>' + (cfp > 0 ? A(cfp, 1) + ' × ' + A(R[n], 1) + ' = <b>' + A(h.r[n], 2) + '</b>' : 'premis ≤ 0, tidak berlaku (0)') + '</td></tr>';
                return '<table class="kp-tab"><thead><tr><th>Aturan</th><th>CF premis</th><th>CF kesimpulan = CF premis × CF rule</th></tr></thead><tbody>' +
                    baris(1, 'demam &lt; 37,5', h.leaf.demamRendah) + baris(2, 'demam &gt; 37,5', h.leaf.demamTinggi) + baris(3, 'batuk &gt; 24 jam', h.leaf.batuk24) + baris(4, 'batuk &gt; 48 jam', h.leaf.batuk48) + '</tbody></table>' +
                    '<p style="margin-top:8px">“gejala flu” = gabungan Rule 1 dan 2 = <span class="kp-f">' + A(h.gejala, 2) + '</span>; “sakit tenggorokan” = gabungan Rule 3 dan 4 = <span class="kp-f">' + A(h.tenggorokan, 2) + '</span>. Aturan yang tidak berlaku bernilai 0 dan tidak mengubah apa pun pada gabungan.</p>';
            }
            if (step === 2) {
                const m = Math.min(h.gejala, st.bersin);
                return '<p>Rule 5 punya dua premis (AND): gejala flu = ' + A(h.gejala, 2) + ' dan bersin = ' + A(st.bersin, 1) + '.</p>' +
                    (m > 0 ? '<p>CF₁ = min{' + A(h.gejala, 2) + ', ' + A(st.bersin, 1) + '} × (−0,2) = ' + A(m, 2) + ' × (−0,2) = <span class="kp-f">' + A(h.r[5], 3) + '</span>. CF rule negatif: kombinasi gejala ini justru sedikit melemahkan dugaan flu (pada contoh pakar, gejala dingin yang disertai bersin lebih mirip alergi).</p>'
                        : '<p>Salah satu premis ≤ 0, jadi Rule 5 tidak berlaku: CF₁ = <span class="kp-f">0</span>.</p>');
            }
            if (step === 3) {
                return '<p>Rule 6 satu premis: sakit tenggorokan = ' + A(h.tenggorokan, 2) + '.</p>' +
                    (h.tenggorokan > 0 ? '<p>CF = ' + A(h.tenggorokan, 2) + ' × 0,5 = <span class="kp-f">' + A(h.r[6], 3) + '</span></p>' : '<p>Premis ≤ 0, jadi Rule 6 tidak berlaku (<span class="kp-f">0</span>). Batuk kurang dari 24 jam berarti sakit tenggorokan tidak mendapat dukungan.</p>');
            }
            if (step === 4) {
                const m = Math.min(st.kepala, st.hidung);
                return '<p>Rule 7 dua premis (AND): sakit kepala = ' + A(st.kepala, 1) + ' dan hidung tersumbat = ' + A(st.hidung, 1) + '.</p>' +
                    (m > 0 ? '<p>CF₂ = min{' + A(st.kepala, 1) + ', ' + A(st.hidung, 1) + '} × 0,7 = ' + A(m, 1) + ' × 0,7 = <span class="kp-f">' + A(h.r[7], 3) + '</span></p>' : '<p>Salah satu premis ≤ 0, jadi Rule 7 tidak berlaku (<span class="kp-f">0</span>).</p>');
            }
            const g1 = gabungDetail(h.r[5], h.r[6]), g2 = gabungDetail(g1.nilai, h.r[7]);
            return '<p>Tiga aturan (5, 6, 7) memberi CF untuk hipotesis yang sama. Gabungkan berurutan: Rule 5 dan 6 → ' + A(g1.nilai, 3) + ' (Rule 6 bernilai ' + A(h.r[6], 2) + '), lalu dengan Rule 7 (' + A(h.r[7], 3) + ').</p>' +
                '<p>CF(terkena flu) = <span class="kp-big">' + A(h.akhir, 3) + '</span> <small>(' + istilahCF(h.akhir) + ')</small>' + (g2.kasus === 'beda' ? ' <small>— tanda berbeda: (' + A(g1.nilai, 3) + ' + ' + A(h.r[7], 3) + ') ÷ (1 − ' + A(Math.min(Math.abs(g1.nilai), Math.abs(h.r[7])), 3) + ')</small>' : '') + '</p>' +
                '<p class="kp-note">Pada pasien contoh slide, hasilnya 0,2: sistem nyaris tidak punya pegangan. Mengubah satu CF di atas langsung mengubah angka ini; coba ubah suhu atau lama batuk, lalu lanjutkan langkah.</p>';
        }
        function render() {
            const h = fluHitung(st);
            $q(rootEl, 'phase').innerHTML = FASE.map((f, i) => '<span class="' + (i === step ? 'on' : i < step ? 'done' : '') + '">' + f + '</span>').join('');
            $q(rootEl, 'svg').innerHTML = gambar(h);
            $q(rootEl, 'out').innerHTML = teks(h);
            $q(rootEl, 'prev').disabled = step === 0;
            $q(rootEl, 'next').disabled = step === FASE.length - 1;
        }
        bindSliders(rootEl, st, render);
        rootEl.querySelectorAll('select[data-sel]').forEach(sel => sel.addEventListener('change', () => {
            st[sel.dataset.sel] = sel.dataset.sel === 'suhu' ? parseFloat(sel.value) : sel.value;
            render();
        }));
        $q(rootEl, 'reset').addEventListener('click', () => { step = 0; render(); });
        $q(rootEl, 'prev').addEventListener('click', () => { if (step > 0) { step--; render(); } });
        $q(rootEl, 'next').addEventListener('click', () => { if (step < FASE.length - 1) { step++; render(); } });
        render();
    }

    /* ---------- bayes-lab (mosaik peluang) ---------- */
    const LAB = {
        peluang: {
            presets: [
                ['Dua dadu: A = dadu 1 genap, B = dadu 2 genap', { pA: 0.5, pBA: 0.5, pBnA: 0.5 }, 'A dan B tidak saling memengaruhi: satu dadu tidak peduli hasil dadu lain.'],
                ['Satu dadu: A = muncul 5, B = muncul 3', { pA: 1 / 6, pBA: 0, pBnA: 0.2 }, 'A dan B tidak bisa terjadi bersamaan, tetapi justru <b>bergantung</b>: bila A terjadi, B pasti tidak terjadi.'],
                ['Satu dadu: A = muncul 6, B = angka genap', { pA: 1 / 6, pBA: 1, pBnA: 0.4 }, 'A membuat B pasti terjadi (6 itu genap), jadi A dan B bergantung, tetapi tidak saling lepas.']
            ],
            nA: 'A', nB: 'B'
        },
        bayes: {
            presets: [
                ['Email spam dan kata “GRATIS”', { pA: 0.3, pBA: 0.6, pBnA: 0.05 }, 'Tiga dari sepuluh email adalah spam; 60% spam memuat kata itu, hanya 5% email biasa yang memuatnya.', 'email spam', 'email memuat “GRATIS”'],
                ['Kejadian langka: penipuan transaksi', { pA: 0.01, pBA: 0.9, pBnA: 0.05 }, 'Hanya 1% transaksi adalah penipuan; alat deteksi menandai 90% penipuan, tetapi juga 5% transaksi biasa.', 'transaksi penipuan', 'transaksi ditandai alat'],
                ['Bukti tidak informatif', { pA: 0.3, pBA: 0.4, pBnA: 0.4 }, 'Bukti muncul sama seringnya pada A dan bukan A, sehingga tidak mengubah apa pun.', 'hipotesis A', 'bukti B']
            ]
        }
    };
    function initBayesLab(rootEl) {
        const fokus = rootEl.dataset.fokus === 'bayes' ? 'bayes' : 'peluang';
        const cfg = LAB[fokus];
        let nA = fokus === 'bayes' ? cfg.presets[0][3] : 'A', nB = fokus === 'bayes' ? cfg.presets[0][4] : 'B';
        let ket = cfg.presets[0][2];
        const st = Object.assign({}, cfg.presets[0][1]);
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML = presetRow(cfg.presets) +
            '<p class="kp-note" data-role="ket" style="margin:0 0 10px"></p>' +
            '<div class="kp-grid">' + slider('pA', fokus === 'bayes' ? 'P(A): peluang awal (prior)' : 'P(A)', 0.01, 0.99, 0.01, st.pA) +
            slider('pBA', fokus === 'bayes' ? 'P(B|A): bukti muncul bila A benar' : 'P(B|A)', 0, 1, 0.01, st.pBA) +
            slider('pBnA', fokus === 'bayes' ? 'P(B|¬A): bukti muncul bila A salah' : 'P(B|¬A)', 0, 1, 0.01, st.pBnA) + '</div>' +
            '<div class="kp-cols"><div class="kp-stage" style="margin:0"><svg viewBox="0 0 380 300" role="img" aria-label="Kotak peluang"><g data-role="svg"></g></svg></div>' +
            '<div class="kp-out" data-role="out"></div></div>';
        const fm = { pA: v => num(v, 3), pBA: v => num(v, 3), pBnA: v => num(v, 3) };
        function mosaik(k) {
            const X0 = 40, Y0 = 34, W = 320, H = 214;
            const wA = k.pA * W, wN = W - wA;
            const hAB = k.pBA * H, hNB = k.pBnA * H;
            const cell = (x, y, w, h, fill, t1, t2) => '<g><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + fill + '" stroke="#fff" stroke-width="2"/>' +
                (w > 46 && h > 30 ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 - 2).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#0d1b3a">' + t1 + '</text><text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + 12).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#263238">' + t2 + '</text>' : '') + '</g>';
            return cell(X0, Y0, wA, hAB, '#64b5f6', 'A ∩ B', num(k.AB, 3)) +
                cell(X0, Y0 + hAB, wA, H - hAB, '#bbdefb', 'A ∩ ¬B', num(k.AnB, 3)) +
                cell(X0 + wA, Y0, wN, hNB, '#ffb74d', '¬A ∩ B', num(k.nAB, 3)) +
                cell(X0 + wA, Y0 + hNB, wN, H - hNB, '#ffe0b2', '¬A ∩ ¬B', num(k.nAnB, 3)) +
                '<text x="' + (X0 + wA / 2).toFixed(1) + '" y="26" text-anchor="middle" font-size="13" font-weight="700" fill="#0d47a1">A (' + num(k.pA, 2) + ')</text>' +
                '<text x="' + (X0 + wA + wN / 2).toFixed(1) + '" y="26" text-anchor="middle" font-size="13" font-weight="700" fill="#bf360c">¬A (' + num(1 - k.pA, 2) + ')</text>' +
                '<text x="' + (X0 - 6) + '" y="' + (Y0 + 14) + '" text-anchor="end" font-size="11" fill="#546e7a">B</text>' +
                '<text x="' + (X0 - 6) + '" y="' + (Y0 + H - 4) + '" text-anchor="end" font-size="11" fill="#546e7a">¬B</text>' +
                '<rect x="' + X0 + '" y="' + Y0 + '" width="' + W + '" height="' + H + '" fill="none" stroke="#78909c" stroke-width="1.5"/>' +
                '<text x="' + (X0 + W / 2) + '" y="' + (Y0 + H + 22) + '" text-anchor="middle" font-size="11.5" fill="#546e7a">Luas seluruh kotak = 1 (semesta); luas tiap bagian = peluang gabungannya</text>' +
                '<text x="' + (X0 + W / 2) + '" y="' + (Y0 + H + 38) + '" text-anchor="middle" font-size="11.5" fill="#546e7a">Lebar = P(A); tinggi biru = P(B|A), tinggi oranye = P(B|¬A)</text>';
        }
        function render() {
            const k = kotak(st.pA, st.pBA, st.pBnA);
            $q(rootEl, 'ket').innerHTML = ket;
            $q(rootEl, 'svg').innerHTML = mosaik(k);
            let out;
            if (fokus === 'peluang') {
                out = '<p>P(A ∩ B) = P(A) × P(B|A) = ' + num(st.pA, 3) + ' × ' + num(st.pBA, 3) + ' = <span class="kp-f">' + num(k.AB, 3) + '</span></p>' +
                    '<p>P(B) = P(A∩B) + P(¬A∩B) = ' + num(k.AB, 3) + ' + ' + num(k.nAB, 3) + ' = <span class="kp-f">' + num(k.pB, 3) + '</span></p>' +
                    '<p>P(A ∪ B) = P(A) + P(B) − P(A∩B) = <span class="kp-f">' + num(k.gabungan, 3) + '</span></p>' +
                    '<p>P(A|B) = P(A∩B) ÷ P(B) = <span class="kp-f">' + (isNaN(k.AgB) ? '–' : num(k.AgB, 3)) + '</span></p>' +
                    '<p>Independen? P(B|A) = P(B|¬A): <b>' + (k.independen ? 'ya' : 'tidak') + '</b> &nbsp;·&nbsp; Saling lepas? P(A∩B) = 0: <b>' + (k.terpisah ? 'ya' : 'tidak') + '</b></p>' +
                    (k.independen ? '<div class="kp-ok">Kedua kolom terbelah pada tinggi yang sama: mengetahui A tidak mengubah peluang B. Karena itu P(A∩B) = P(A) × P(B).</div>' : '') +
                    (k.terpisah ? '<div class="kp-warn">Saling lepas bukan independen. Justru A dan B sangat bergantung: bila A terjadi, peluang B turun menjadi 0.</div>' : '') +
                    '<p class="kp-note">Contoh: ' + ket + '</p>';
            } else {
                const N = 10000, c = x => Math.round(x * N).toLocaleString('id-ID');
                const ok = !isNaN(k.AgB);
                out = '<p>Bayangkan ' + c(1) + ' kasus. <b>' + c(k.pA) + '</b> ' + esc(nA) + ', <b>' + c(1 - k.pA) + '</b> bukan.</p>' +
                    '<p>Di antara ' + esc(nA) + ', ' + c(k.AB) + ' ' + esc(nB) + '. Di antara yang bukan, ' + c(k.nAB) + ' ' + esc(nB) + '. Jadi ' + esc(nB) + ' seluruhnya <b>' + c(k.pB) + '</b>.</p>' +
                    (ok ? '<p><b>Posterior</b> P(A|B) = ' + c(k.AB) + ' ÷ ' + c(k.pB) + ' = <span class="kp-big">' + pct(k.AgB) + '</span></p>' + bar(k.AgB, pct(k.AgB) + ' dari ' + esc(nB) + ' memang ' + esc(nA), 'b3') : '<p>Bukti B tidak pernah muncul pada pengaturan ini.</p>') +
                    (ok ? '<p class="kp-note">Bandingkan: P(B|A) = ' + pct(st.pBA, 0) + ' (seberapa sering bukti muncul bila A benar), tetapi P(A|B) = ' + pct(k.AgB) + ' (seberapa mungkin A benar bila bukti muncul). Keduanya <b>bukan</b> angka yang sama; Bayes adalah jembatan di antara keduanya.</p>' : '') +
                    (ok && k.AgB < st.pBA - 0.2 ? '<div class="kp-warn">Peluang awal P(A) yang kecil menarik posterior turun: sebagian besar ' + esc(nB) + ' berasal dari kelompok yang bukan ' + esc(nA) + ', walau bukti itu jarang muncul di sana.</div>' : '') +
                    (ok && Math.abs(k.AgB - st.pA) < 0.005 ? '<div class="kp-ok">Posterior sama dengan prior: bukti tidak informatif.</div>' : '');
            }
            $q(rootEl, 'out').innerHTML = out;
        }
        bindSliders(rootEl, st, render, fm);
        rootEl.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
            const p = cfg.presets[+b.dataset.pre];
            ket = p[2];
            if (fokus === 'bayes') { nA = p[3]; nB = p[4]; }
            setSliders(rootEl, p[1]);
        }));
        render();
    }

    /* ---------- bayes-update ---------- */
    function initBayesUpdate(rootEl) {
        const HIP = { A1: 'A1', A2: 'A2', A3: 'A3' };
        let urut = [];                 // bukti yang sudah diamati, menurut urutan
        let ubah = false;              // P(B3|A1) = 0,1 bukan 0,0
        const likSekarang = () => {
            if (!ubah) return LIK;
            return { B1: LIK.B1, B2: LIK.B2, B3: Object.assign({}, LIK.B3, { A1: 0.1 }) };
        };
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML =
            '<div class="kp-row"><b>Peluang dari pakar:</b></div><div class="kp-scroll" data-role="tabel"></div>' +
            '<div class="kp-row" style="margin-top:12px"><b>Amati bukti (klik, urutan klik = urutan pengamatan):</b><span data-role="chips"></span>' +
            '<button type="button" class="viz-btn secondary" data-role="reset">Ulang</button></div>' +
            '<label class="kp-row" style="gap:6px;cursor:pointer"><input type="checkbox" data-role="ubah"> Ubah P(B3|A1) dari 0,0 menjadi 0,1</label>' +
            '<div class="kp-out" data-role="out"></div>';
        function render() {
            const lik = likSekarang();
            $q(rootEl, 'tabel').innerHTML = '<table class="kp-tab"><thead><tr><th></th>' + Object.keys(HIP).map(a => '<th>' + a + '</th>').join('') + '</tr></thead><tbody>' +
                '<tr><td>P(Ai) prior</td>' + Object.keys(HIP).map(a => '<td>' + num(PRIOR[a], 1) + '</td>').join('') + '</tr>' +
                ['B1', 'B2', 'B3'].map(b => '<tr><td>P(' + b + '|Ai)</td>' + Object.keys(HIP).map(a => '<td' + (ubah && b === 'B3' && a === 'A1' ? ' style="background:#ffe0b2;font-weight:700"' : '') + '>' + num(lik[b][a], 1) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
            $q(rootEl, 'chips').innerHTML = ['B1', 'B2', 'B3'].map(b =>
                '<button type="button" class="kp-chip' + (urut.includes(b) ? ' on' : '') + '" data-b="' + b + '" aria-pressed="' + urut.includes(b) + '">' + b + (urut.includes(b) ? ' <small>diamati ke-' + (urut.indexOf(b) + 1) + '</small>' : '') + '</button>').join(' ');
            const t = posterior(urut, lik);
            const kunci = Object.keys(HIP);
            let html = '';
            // riwayat
            html += '<p><b>Posterior setelah tiap bukti</b></p><table class="kp-tab"><thead><tr><th>Bukti yang sudah diketahui</th>' + kunci.map(a => '<th>P(' + a + '| …)</th>').join('') + '</tr></thead><tbody>' +
                [[]].concat(urut.map((_, i) => urut.slice(0, i + 1))).map((bk, i, arr) => {
                    const p = posterior(bk, lik).post;
                    return '<tr class="' + (i === arr.length - 1 ? 'hit' : '') + '"><td>' + (bk.length ? bk.join(', ') : 'belum ada (prior)') + '</td>' + kunci.map(a => '<td>' + pct(p[a]) + '</td>').join('') + '</tr>';
                }).join('') + '</tbody></table>';
            html += '<div style="display:grid;gap:6px;margin-top:10px">' + kunci.map((a, i) => '<div style="display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:center"><b>' + a + '</b>' + bar(t.post[a], pct(t.post[a]), i === 0 ? '' : i === 1 ? 'b2' : 'b3') + '</div>').join('') + '</div>';
            if (urut.length) {
                html += '<p style="margin-top:12px"><b>Hitungan terakhir</b> (peluang bukti dikalikan karena bukti dianggap bebas bila hipotesis diketahui):</p>' +
                    '<table class="kp-tab"><thead><tr><th>Hipotesis</th><th>P(Ai) × ' + urut.map(b => 'P(' + b + '|Ai)').join(' × ') + '</th><th>Pembilang</th><th>÷ ' + num(t.z, 4) + '</th></tr></thead><tbody>' +
                    kunci.map(a => '<tr class="' + (t.pembilang[a] === 0 ? 'gone' : '') + '"><td>' + a + '</td><td>' + [num(PRIOR[a], 1)].concat(urut.map(b => num(lik[b][a], 1))).join(' × ') + '</td><td>' + num(t.pembilang[a], 4) + '</td><td><b>' + pct(t.post[a]) + '</b></td></tr>').join('') + '</tbody></table>' +
                    '<p class="kp-note">Penyebut ' + num(t.z, 4) + ' = jumlah ketiga pembilang, sehingga ketiga posterior berjumlah 100%. Urutan klik tidak mengubah hasil akhir; coba klik ulang dengan urutan lain.</p>';
                const gugur = kunci.filter(a => t.pembilang[a] === 0);
                if (gugur.length) html += '<div class="kp-warn"><b>' + gugur.join(', ') + ' gugur.</b> Satu bukti berpeluang 0 pada hipotesis itu, sehingga seluruh hasil kali menjadi 0, dan tidak ada bukti berikutnya yang dapat menghidupkannya lagi. Karena itu pakar jarang diminta memberi peluang tepat 0 atau 1.</div>';
            } else {
                html += '<p class="kp-note">Belum ada bukti: yang berlaku peluang awal. Klik B1, B2, atau B3.</p>';
            }
            $q(rootEl, 'out').innerHTML = html;
        }
        rootEl.addEventListener('click', e => {
            const b = e.target.closest('[data-b]');
            if (b) { const k = b.dataset.b; urut = urut.includes(k) ? urut.filter(x => x !== k) : urut.concat(k); render(); return; }
            if (e.target.closest('[data-role="reset"]')) { urut = []; render(); }
        });
        $q(rootEl, 'ubah').addEventListener('change', e => { ubah = e.target.checked; render(); });
        render();
    }

    /* ---------- bayes-net ---------- */
    function initBayesNet(rootEl) {
        const ST = { C: '?', S: '?', R: '?', W: '?' };       // '?' | 'y' | 'n'
        const PRE = [
            ['Belum ada bukti', { C: '?', S: '?', R: '?', W: '?' }],
            ['Rumput basah', { C: '?', S: '?', R: '?', W: 'y' }],
            ['Basah dan sprinkler menyala', { C: '?', S: 'y', R: '?', W: 'y' }],
            ['Basah dan sprinkler mati', { C: '?', S: 'n', R: '?', W: 'y' }],
            ['Berawan', { C: 'y', S: '?', R: '?', W: '?' }]
        ];
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML = presetRow(PRE) +
            '<div class="kp-row"><b>Bukti (klik untuk mengganti: tidak diketahui → ya → tidak):</b><span data-role="chips"></span></div>' +
            '<div class="kp-stage"><svg viewBox="0 0 520 320" role="img" aria-label="Jaringan Bayes: Berawan menuju Sprinkler dan Hujan; keduanya menuju Rumput basah"><g data-role="svg"></g></svg></div>' +
            '<div class="kp-out" data-role="out"></div>' +
            '<div class="kp-cpt">' +
            '<table><caption>Berawan</caption><tr><th>P(Berawan)</th></tr><tr><td>0,5</td></tr></table>' +
            '<table><caption>Sprinkler menyala</caption><tr><th>Berawan?</th><th>P(ya)</th></tr><tr><td>ya</td><td>0,1</td></tr><tr><td>tidak</td><td>0,5</td></tr></table>' +
            '<table><caption>Hujan</caption><tr><th>Berawan?</th><th>P(ya)</th></tr><tr><td>ya</td><td>0,8</td></tr><tr><td>tidak</td><td>0,2</td></tr></table>' +
            '<table><caption>Rumput basah</caption><tr><th>Sprinkler</th><th>Hujan</th><th>P(ya)</th></tr><tr><td>ya</td><td>ya</td><td>0,99</td></tr><tr><td>ya</td><td>tidak</td><td>0,9</td></tr><tr><td>tidak</td><td>ya</td><td>0,9</td></tr><tr><td>tidak</td><td>tidak</td><td><b>0,0</b></td></tr></table></div>' +
            '<p class="kp-note">Baris terakhir tabel rumput basah pada slide 2022 tertulis T = 1,0 dan F = 0,0, yang berarti rumput pasti basah tanpa hujan dan tanpa sprinkler. Yang benar T = 0,0 dan F = 1,0 (jumlah tiap baris harus 1).</p>';
        const POS = { C: [260, 40], S: [110, 150], R: [410, 150], W: [260, 270] };
        const ARC = [['C', 'S'], ['C', 'R'], ['S', 'W'], ['R', 'W']];
        function render() {
            const ev = {};
            NET_ORDE.forEach(k => { if (ST[k] !== '?') ev[k] = ST[k] === 'y'; });
            const h = netHitung(ev);
            $q(rootEl, 'chips').innerHTML = NET_ORDE.map(k =>
                '<button type="button" class="kp-chip' + (ST[k] === 'y' ? ' on' : ST[k] === 'n' ? ' no' : '') + '" data-n="' + k + '">' + NET[k].nama + ': <small>' + (ST[k] === 'y' ? 'ya' : ST[k] === 'n' ? 'tidak' : 'tidak diketahui') + '</small></button>').join(' ');
            let s = '';
            const RX = 82, RY = 30;
            const tepi = u => 1 / Math.sqrt(Math.pow(u[0] / RX, 2) + Math.pow(u[1] / RY, 2));
            ARC.forEach(a => {
                const p = POS[a[0]], q = POS[a[1]];
                const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy);
                const u = [dx / L, dy / L], t = tepi(u);
                s += '<path class="kp-e" d="M' + (p[0] + u[0] * t).toFixed(1) + ',' + (p[1] + u[1] * t).toFixed(1) + ' L' + (q[0] - u[0] * (t + 3)).toFixed(1) + ',' + (q[1] - u[1] * (t + 3)).toFixed(1) + '"/>';
            });
            NET_ORDE.forEach(k => {
                const c = ST[k] === 'y' ? 'pos' : ST[k] === 'n' ? 'neg' : 'nol';
                const bawah = ST[k] === '?' ? 'P(ya) = ' + pct(h.marginal[k]) : 'bukti: ' + (ST[k] === 'y' ? 'ya' : 'tidak');
                s += '<g class="kp-n ' + c + '"><ellipse cx="' + POS[k][0] + '" cy="' + POS[k][1] + '" rx="' + RX + '" ry="' + RY + '"/><text x="' + POS[k][0] + '" y="' + (POS[k][1] - 3) + '">' + NET[k].nama + '</text><text class="v" x="' + POS[k][0] + '" y="' + (POS[k][1] + 13) + '">' + bawah + '</text></g>';
            });
            $q(rootEl, 'svg').innerHTML = s;
            const bukti = NET_ORDE.filter(k => ST[k] !== '?');
            const tanya = NET_ORDE.filter(k => ST[k] === '?');
            $q(rootEl, 'out').innerHTML = (bukti.length
                ? '<p>Peluang bukti itu sendiri: P(' + bukti.map(k => NET[k].nama.toLowerCase() + ' = ' + (ST[k] === 'y' ? 'ya' : 'tidak')).join(', ') + ') = <span class="kp-f">' + pct(h.peluangBukti) + '</span></p>'
                : '<p>Tanpa bukti, tiap simpul berpeluang menurut tabel dan simpul induknya (peluang marginal).</p>') +
                (tanya.length ? '<table class="kp-tab"><thead><tr><th>Simpul</th><th>P(ya | bukti)</th><th></th></tr></thead><tbody>' + tanya.map(k => '<tr><td>' + NET[k].nama + '</td><td>' + pct(h.marginal[k]) + '</td><td style="min-width:140px">' + bar(h.marginal[k], pct(h.marginal[k], 0), k === 'R' ? '' : k === 'S' ? 'b2' : 'b3') + '</td></tr>').join('') + '</tbody></table>' : '') +
                '<p class="kp-note">Dihitung dengan enumerasi atas ' + 16 + ' kombinasi ya/tidak. Jaringan ini hanya menyimpan 1 + 2 + 2 + 4 = <b>9</b> angka, sedangkan tabel peluang gabungan penuh butuh 2⁴ − 1 = 15 angka; selisihnya makin besar pada jaringan yang lebih banyak simpul.</p>';
        }
        rootEl.addEventListener('click', e => {
            const c = e.target.closest('[data-n]');
            if (c) { const k = c.dataset.n; ST[k] = ST[k] === '?' ? 'y' : ST[k] === 'y' ? 'n' : '?'; render(); return; }
            const p = e.target.closest('[data-pre]');
            if (p) { Object.assign(ST, PRE[+p.dataset.pre][1]); render(); }
        });
        render();
    }

    /* ---------- dup-lab ---------- */
    function initDup(rootEl) {
        const st = { n: 3 };
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML =
            '<p class="kp-note" style="margin:0 0 10px">Satu bukti E dengan P(E|H) = 0,8 dan P(E|¬H) = 0,4, peluang awal P(H) = 0,5. Pada CF, tiap aturan yang memakai E punya CF 0,5. Geser untuk menghitung <b>bukti yang sama</b> berkali-kali (misalnya lima gejala yang sebenarnya satu penyebab).</p>' +
            '<div class="kp-grid">' + slider('n', 'Berapa kali bukti yang sama dihitung', 1, 8, 1, 3) + '</div>' +
            '<div class="kp-out" data-role="out"></div>';
        function render() {
            const n = st.n, h = dupHitung(n);
            let rows = '';
            for (let i = 1; i <= 8; i++) { const r = dupHitung(i); rows += '<tr class="' + (i === n ? 'hit' : '') + '"><td>' + i + '</td><td>' + pct(r.naif) + '</td><td>' + pct(r.benar) + '</td><td>' + num(r.cf, 3) + '</td></tr>'; }
            $q(rootEl, 'out').innerHTML =
                '<div style="display:grid;gap:8px;margin-bottom:10px">' +
                '<div><b>Bayes dengan asumsi bebas (naif)</b>' + bar(h.naif, pct(h.naif)) + '</div>' +
                '<div><b>Bayes benar (bukti itu satu saja)</b>' + bar(h.benar, pct(h.benar), 'b3') + '</div>' +
                '<div><b>CF digabung ' + n + ' kali (0,5 tiap aturan)</b>' + bar(h.cf, num(h.cf, 3), 'b2') + '</div></div>' +
                '<div class="kp-scroll"><table class="kp-tab"><thead><tr><th>Jumlah salinan bukti</th><th>Posterior naif</th><th>Posterior benar</th><th>CF gabungan</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
                '<div class="kp-warn">Bukti yang sama tidak membawa informasi baru, tetapi rumus yang menganggap setiap aturan atau gejala <b>bebas</b> memperlakukannya sebagai bukti baru. Hasilnya makin yakin padahal pengetahuan kita tidak bertambah. Itulah akibat melanggar asumsi kebebasan bersyarat.</div>';
        }
        bindSliders(rootEl, st, render, { n: v => String(v) });
        render();
    }

    /* ---------- cf-vs-fuzzy ---------- */
    /**
     * Satu pasien, dua cara "tidak pasti". Pertanyaan CF: "apakah suhu >= 38,0 °C?" (ya/tidak tegas, hanya belum diketahui).
     * Himpunan fuzzy "demam": derajat 0 pada <= 37,0 °C, naik lurus, derajat 1 pada >= 39,0 °C.
     */
    const BEDA = { batas: 38.0, awal: 37.0, penuh: 39.0 };
    function bedaHitung(t) {
        const mu = Math.max(0, Math.min(1, (t - BEDA.awal) / (BEDA.penuh - BEDA.awal)));
        return { mu: mu, cf: t >= BEDA.batas ? 1 : -1 };
    }
    function bedaKurva(t) {
        const X = v => 20 + (v - 36) / 4 * 260, Y = m => 92 - m * 70;
        return '<svg viewBox="0 0 300 130" role="img" aria-label="Kurva derajat keanggotaan demam terhadap suhu" style="width:100%;max-width:340px;display:block;margin:6px 0">' +
            '<line x1="20" y1="92" x2="285" y2="92" stroke="#90a4ae"/><line x1="20" y1="18" x2="20" y2="92" stroke="#90a4ae"/>' +
            '<polyline points="' + X(36) + ',' + Y(0) + ' ' + X(37) + ',' + Y(0) + ' ' + X(39) + ',' + Y(1) + ' ' + X(40) + ',' + Y(1) + '" fill="none" stroke="#e65100" stroke-width="2.5"/>' +
            '<line x1="' + X(BEDA.batas) + '" y1="18" x2="' + X(BEDA.batas) + '" y2="92" stroke="#1565c0" stroke-dasharray="4 3"/>' +
            '<text x="' + (X(BEDA.batas) - 3) + '" y="14" text-anchor="end" font-size="9" fill="#1565c0">batas tegas CF: 38,0</text>' +
            '<circle cx="' + X(t) + '" cy="' + Y(bedaHitung(t).mu) + '" r="5" fill="#e65100" stroke="#fff" stroke-width="1.5"/>' +
            [36, 37, 38, 39, 40].map(v => '<text x="' + X(v) + '" y="106" text-anchor="middle" font-size="9" fill="#546e7a">' + v + '</text>').join('') +
            '<text x="152" y="123" text-anchor="middle" font-size="9" fill="#546e7a">suhu (°C)</text>' +
            '<text x="16" y="96" text-anchor="end" font-size="9" fill="#546e7a">0</text><text x="16" y="26" text-anchor="end" font-size="9" fill="#546e7a">1</text>' +
            '</svg>';
    }
    function initBeda(rootEl) {
        const st = { cf: 0.6, t: 38.2 };
        let ukur = false;
        rootEl.classList.add('viz', 'kp');
        rootEl.innerHTML =
            '<div class="kp-row"><b>Langkah:</b>' +
            '<button type="button" class="viz-btn" data-mode="belum">1. Termometer belum dipakai</button>' +
            '<button type="button" class="viz-btn secondary" data-mode="ukur">2. Pasien diukur termometer</button></div>' +
            '<div class="kp-grid"><div data-role="sl-cf">' + slider('cf', 'Keyakinan Anda: suhu pasien ≥ 38,0 °C (CF)', -1, 1, 0.1, 0.6) + '</div>' +
            '<div data-role="sl-t">' + slider('t', 'Suhu yang terbaca di termometer (°C)', 36, 40, 0.1, 38.2) + '</div></div>' +
            '<div class="kp-out" data-role="out"></div>';
        const panel = (warna, judul, isi) =>
            '<div style="border-top:4px solid ' + warna + ';background:#fafcff;border-radius:8px;padding:8px 12px"><b>' + judul + '</b>' + isi + '</div>';
        function render() {
            rootEl.querySelector('[data-role="sl-cf"]').style.display = ukur ? 'none' : '';
            rootEl.querySelector('[data-role="sl-t"]').style.display = ukur ? '' : 'none';
            rootEl.querySelectorAll('[data-mode]').forEach(b => b.className = 'viz-btn' + ((b.dataset.mode === 'ukur') === ukur ? '' : ' secondary'));
            let kiri, kanan, penutup;
            if (!ukur) {
                kiri = panel('#1565c0', 'CF: seberapa yakin pernyataan ini benar?',
                    '<p style="margin:6px 0">Pernyataan: “suhu pasien ≥ 38,0 °C”. Jawabannya <u>ya atau tidak</u>; kita hanya belum tahu.</p>' +
                    skalaCF([{ v: st.cf, label: 'CF ' + num(st.cf, 1), cls: 'm3' }]) +
                    '<p style="margin:0">CF = <span class="kp-f">' + num(st.cf, 1) + '</span> <small>(' + istilahCF(st.cf) + ')</small></p>');
                kanan = panel('#e65100', 'Fuzzy: seberapa “demam” suhu ini?',
                    '<p style="margin:6px 0"><span class="kp-f">belum bisa dihitung</span></p>' +
                    '<p style="margin:0;font-size:.9em;color:#546e7a">Fuzzy menilai <em>sebuah nilai yang sudah diketahui</em>. Tanpa angka suhu, tidak ada yang bisa dinilai.</p>');
                penutup = '<div class="kp-note">Pasien hanya mengeluh “badan terasa panas”. Geser keyakinan Anda, lalu pilih langkah 2: ambil termometer.</div>';
            } else {
                const h = bedaHitung(st.t);
                kiri = panel('#1565c0', 'CF: seberapa yakin pernyataan ini benar?',
                    '<p style="margin:6px 0">Pernyataan: “suhu pasien ≥ 38,0 °C”. Termometer menunjukkan <b>' + num(st.t, 1) + ' °C</b>.</p>' +
                    skalaCF([{ v: h.cf, label: 'CF ' + num(h.cf, 1), cls: h.cf > 0 ? 'm3' : 'm2' }]) +
                    '<p style="margin:0">CF = <span class="kp-f">' + num(h.cf, 1) + '</span> <small>(' + istilahCF(h.cf) + ')</small></p>' +
                    '<p style="margin:6px 0 0;font-size:.9em;color:#546e7a">Ketidaktahuan <b>hilang</b> setelah ada info tambahan.</p>');
                kanan = panel('#e65100', 'Fuzzy: seberapa “demam” suhu ini?',
                    bar(h.mu, 'μ(demam) = ' + num(h.mu, 2), 'b2') + bedaKurva(st.t) +
                    '<p style="margin:0;font-size:.9em;color:#546e7a">Suhu sudah diketahui tepat, tetapi “demam” tetap <b>sebagian</b>. Info tambahan tidak mengubah angka ini; hanya suhunya yang mengubah.</p>');
                penutup = (h.mu > 0 && h.mu < 1)
                    ? '<div class="kp-ok">CF sudah <b>pasti</b> (' + num(h.cf, 1) + '), sementara derajat fuzzy masih <b>' + num(h.mu, 2) + '</b>. Dua jenis “tidak pasti” yang berbeda: yang satu bisa ditutup dengan informasi, yang satu tidak. Coba geser suhu ke sekitar 38,0 °C: CF melompat dari −1 ke 1, derajat fuzzy berubah mulus.</div>'
                    : '<div class="kp-note">Di luar rentang 37,0–39,0 °C keduanya sama-sama tegas (fuzzy 0 atau 1). Geser suhu ke tengah untuk melihat perbedaannya.</div>';
            }
            $q(rootEl, 'out').innerHTML =
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px">' + kiri + kanan + '</div>' + penutup;
        }
        bindSliders(rootEl, st, render, { cf: v => num(v, 1), t: v => num(v, 1) + ' °C' });
        rootEl.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { ukur = b.dataset.mode === 'ukur'; render(); }));
        render();
    }

    /* =====================================================================
     * 3. INISIALISASI / EKSPOR
     * ===================================================================== */
    const INIT = {
        'cf-vs-fuzzy': initBeda,
        'cf-hitung': initCFHitung,
        'cf-gabung': initCFGabung,
        'cf-premis': initCFPremis,
        'cf-rantai': initCFRantai,
        'cf-flu': initCFFlu,
        'bayes-lab': initBayesLab,
        'bayes-update': initBayesUpdate,
        'bayes-net': initBayesNet,
        'dup-lab': initDup
    };
    function boot() {
        const doc = root.document;
        const targets = Array.from(doc.querySelectorAll('[data-viz]')).filter(el => INIT[el.dataset.viz]);
        if (!targets.length) return;
        installDOM();
        targets.forEach(el => {
            try { INIT[el.dataset.viz](el); }
            catch (err) { if (root.console) root.console.error('ketidakpastian-viz:', el.dataset.viz, err); }
        });
    }

    root.KetidakpastianViz = {
        mb, md, cfDari, gabung, gabungDetail, gabungBanyak, premisDan, premisAtau, buktiTakPasti, istilahCF,
        FLU_ATURAN, fluHitung, kotak, PRIOR, LIK, posterior, NET, netHitung, DUP, dupHitung, BEDA, bedaHitung, INIT
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.KetidakpastianViz;
    if (root.document) {
        if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})(typeof window !== 'undefined' ? window : globalThis);
