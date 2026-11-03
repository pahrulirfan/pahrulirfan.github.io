/*!
 * pakar-viz.js — Visualisasi interaktif sistem pakar untuk materi Kecerdasan Buatan (MKL1303131)
 *
 * Memakai tampilan (kelas .viz-*) dari style.css dan dimuat bersama aima-viz.js.
 * Seluruh mesin inferensi di sini ditulis ulang untuk materi ini (JavaScript murni, tanpa pustaka);
 * contoh aturan obligasi, jaringan fakta–keputusan, tabel inferensi lamaran kerja, dan dialog buah
 * mengikuti slide "05. AI_B_2022_Sistem_Pakar" (2022). Basis aturan sepeda motor dan aturan diskon
 * dibuat sendiri untuk keperluan kuliah.
 *
 * Pemakaian: <div data-viz="..."> di halaman, lalu muat file ini.
 *   data-viz="rule-lab"      lab aturan AND / OR / gabungan (cuaca): switch fakta, lampu hasil, tabel kebenaran
 *   data-viz="es-arch"       arsitektur sistem pakar: enam komponen, klik untuk membaca peran dan analogi
 *   data-viz="rule-chain"    forward / backward chaining langkah demi langkah di atas graf aturan
 *                            (data-kb="obligasi" | "jaringan" | "motor", data-mode="forward" | "backward" untuk mengunci arah,
 *                            data-start="backward" untuk arah awal bila boleh diganti, data-goal)
 *   data-viz="es-consult"    konsultasi: mahasiswa menjawab, sistem bertanya (backward chaining) + Mengapa / Bagaimana
 *                            (data-kb="buah" | "motor")
 *   data-viz="infer-table"   penjelajah tabel inferensi (data-kb="lamaran" | "obligasi")
 *   data-viz="conflict-lab"  himpunan konflik dan strategi pemilihan aturan (diskon toko)
 *   data-viz="skor-lab"      sistem berbasis skor: spam filter (cara kerja mirip SpamAssassin)
 *   data-viz="app-tropis"    aplikasi web 1 (TropisCheck): Certainty Factor + DS, data dan rumus dari aplikasinya
 *   data-viz="app-balita"    aplikasi web 2 (BabyCheck): forward chaining + Dempster-Shafer
 *   data-viz="app-cbr"       aplikasi web 3 (SehatBalita): Case-Based Reasoning + fuzzy
 */
(function (root) {
    'use strict';

    /* =====================================================================
     * 1. BASIS PENGETAHUAN (data)
     *    atoms[a] = { s: label pendek, q: kalimat pertanyaan }
     *    rules[]  = { id, if: [atom...], mode: 'and' | 'or', then: atom }
     *    pos[a]   = [cx, cy] pada graf; nw = lebar simpul
     *    preset   = keadaan awal fakta dasar: 'known' | 'yes' | 'no'
     * ===================================================================== */
    const KB = {};

    KB.obligasi = {
        title: 'Suku bunga, dolar, dan harga obligasi',
        atoms: {
            dolar_naik:  { s: 'Dolar naik',  q: 'Apakah nilai dolar naik?' },
            dolar_turun: { s: 'Dolar turun', q: 'Apakah nilai dolar turun?' },
            bunga_turun: { s: 'Suku bunga turun' },
            bunga_naik:  { s: 'Suku bunga naik' },
            bunga_tetap: { s: 'Suku bunga tidak berubah', q: 'Apakah suku bunga tidak berubah?' },
            obl_naik:    { s: 'Harga obligasi naik' },
            obl_turun:   { s: 'Harga obligasi turun' },
            obl_tetap:   { s: 'Harga obligasi tidak berubah' },
            beli:        { s: 'Beli obligasi' }
        },
        rules: [
            { id: 'R1', if: ['bunga_turun'], then: 'obl_naik' },
            { id: 'R2', if: ['bunga_naik'], then: 'obl_turun' },
            { id: 'R3', if: ['bunga_tetap'], then: 'obl_tetap' },
            { id: 'R4', if: ['dolar_naik'], then: 'bunga_turun' },
            { id: 'R5', if: ['dolar_turun'], then: 'bunga_naik' },
            { id: 'R6', if: ['obl_turun'], then: 'beli' }
        ],
        goal: 'beli',
        nw: 118, size: [790, 330],
        pos: {
            dolar_naik: [70, 60], dolar_turun: [70, 160],
            bunga_turun: [290, 60], bunga_naik: [290, 160], bunga_tetap: [290, 260],
            obl_naik: [510, 60], obl_turun: [510, 160], obl_tetap: [510, 260],
            beli: [720, 160]
        },
        preset: { dolar_naik: 'no', dolar_turun: 'known', bunga_tetap: 'no' }
    };

    KB.jaringan = {
        title: 'Jaringan fakta dan keputusan (AND / OR)',
        atoms: {
            F1: { s: 'Fakta 1', q: 'Apakah Fakta 1 benar?' },
            F2: { s: 'Fakta 2', q: 'Apakah Fakta 2 benar?' },
            F3: { s: 'Fakta 3', q: 'Apakah Fakta 3 benar?' },
            F4: { s: 'Fakta 4', q: 'Apakah Fakta 4 benar?' },
            D1: { s: 'Keputusan 1' },
            D2: { s: 'Keputusan 2' },
            D4: { s: 'Keputusan 4' }
        },
        rules: [
            { id: 'R1', if: ['F1', 'F2'], mode: 'and', then: 'D1' },
            { id: 'R2', if: ['F3', 'F4'], mode: 'or', then: 'D2' },
            { id: 'R3', if: ['D1', 'D2'], mode: 'and', then: 'D4' }
        ],
        goal: 'D4',
        nw: 118, size: [690, 340],
        pos: { F1: [70, 50], F2: [70, 130], F3: [70, 210], F4: [70, 290], D1: [340, 90], D2: [340, 250], D4: [600, 170] },
        preset: { F1: 'known', F2: 'known', F3: 'no', F4: 'known' }
    };

    KB.motor = {
        title: 'Sepeda motor tidak mau hidup (contoh kelas, bukan panduan servis)',
        atoms: {
            lampu_redup:     { s: 'Lampu redup atau mati',      q: 'Apakah lampu dan klakson redup atau mati ketika starter ditekan?' },
            starter_klik:    { s: 'Starter hanya berbunyi klik', q: 'Apakah tombol starter hanya berbunyi “klik” tanpa memutar mesin?' },
            aki_tua:         { s: 'Aki lebih dari 2 tahun',     q: 'Apakah aki sudah dipakai lebih dari 2 tahun?' },
            terminal_kotor:  { s: 'Terminal aki kotor',         q: 'Apakah terminal aki tampak kotor atau berkarat?' },
            mesin_ngerek:    { s: 'Mesin berputar, tidak menyala', q: 'Apakah mesin berputar ketika distarter tetapi tidak mau menyala?' },
            bensin_kosong:   { s: 'Tangki kosong',              q: 'Apakah tangki bensin kosong?' },
            busi_basah:      { s: 'Busi basah, bau bensin',     q: 'Apakah busi basah dan berbau bensin menyengat?' },
            busi_tak_percik: { s: 'Busi tidak memercik',        q: 'Apakah busi tidak memercikkan api ketika diuji?' },
            bensin_ada:      { s: 'Bensin ada',                 q: 'Apakah bensin di tangki masih ada?' },
            busi_percik:     { s: 'Busi memercik',              q: 'Apakah busi memercikkan api biru ketika diuji?' },
            daya_lemah:      { s: 'Daya aki lemah' },
            ganti_aki:       { s: 'Aki perlu diganti' },
            bersih_terminal: { s: 'Bersihkan terminal aki' },
            isi_bensin:      { s: 'Isi bensin' },
            banjir:          { s: 'Mesin kebanjiran bensin' },
            pengapian:       { s: 'Pengapian bermasalah' },
            bbm:             { s: 'Pasokan bahan bakar bermasalah' }
        },
        rules: [
            { id: 'R1', if: ['lampu_redup', 'starter_klik'], mode: 'or', then: 'daya_lemah' },
            { id: 'R2', if: ['daya_lemah', 'aki_tua'], then: 'ganti_aki' },
            { id: 'R3', if: ['daya_lemah', 'terminal_kotor'], then: 'bersih_terminal' },
            { id: 'R4', if: ['mesin_ngerek', 'bensin_kosong'], then: 'isi_bensin' },
            { id: 'R5', if: ['mesin_ngerek', 'busi_basah'], then: 'banjir' },
            { id: 'R6', if: ['mesin_ngerek', 'busi_tak_percik'], then: 'pengapian' },
            { id: 'R7', if: ['mesin_ngerek', 'bensin_ada', 'busi_percik'], then: 'bbm' }
        ],
        goals: ['ganti_aki', 'bersih_terminal', 'isi_bensin', 'banjir', 'pengapian', 'bbm'],
        goal: 'bbm',
        nw: 134, size: [690, 500],
        pos: {
            lampu_redup: [72, 40], starter_klik: [72, 86], aki_tua: [72, 132], terminal_kotor: [72, 178],
            mesin_ngerek: [72, 240], bensin_kosong: [72, 286], busi_basah: [72, 332],
            busi_tak_percik: [72, 378], bensin_ada: [72, 424], busi_percik: [72, 470],
            daya_lemah: [300, 63],
            ganti_aki: [610, 110], bersih_terminal: [610, 170],
            isi_bensin: [610, 275], banjir: [610, 325], pengapian: [610, 375], bbm: [610, 450]
        },
        preset: {
            lampu_redup: 'no', starter_klik: 'no', aki_tua: 'no', terminal_kotor: 'no',
            mesin_ngerek: 'known', bensin_kosong: 'no', busi_basah: 'no',
            busi_tak_percik: 'no', bensin_ada: 'yes', busi_percik: 'yes'
        }
    };

    // Dialog buah (slide 77): jawaban Ya, Tidak, Ya, Ya  →  apel
    KB.buah = {
        title: 'Sistem pakar buah-buahan',
        atoms: {
            bulat:       { s: 'Bulat',                  q: 'Apakah buah berbentuk bulat?' },
            lonjong:     { s: 'Memanjang',              q: 'Apakah buah berbentuk memanjang?' },
            hijau_kuning:{ s: 'Hijau muda, kuning tua', q: 'Apakah buah berwarna hijau ketika muda dan kuning ketika sudah tua?' },
            hijau_merah: { s: 'Hijau muda, merah tua',  q: 'Apakah buah berwarna hijau ketika muda dan merah ketika sudah tua?' },
            berbatang:   { s: 'Berbatang',              q: 'Apakah buah berbatang?' },
            mahkota:     { s: 'Ada mahkota di ujung',   q: 'Apakah ada kelopak seperti mahkota di ujung buah?' },
            jeruk:       { s: 'Jeruk' },
            apel:        { s: 'Apel' },
            delima:      { s: 'Delima' },
            pisang:      { s: 'Pisang' }
        },
        rules: [
            { id: 'R1', if: ['bulat', 'hijau_kuning'], then: 'jeruk' },
            { id: 'R2', if: ['bulat', 'hijau_merah', 'berbatang'], then: 'apel' },
            { id: 'R3', if: ['bulat', 'hijau_merah', 'mahkota'], then: 'delima' },
            { id: 'R4', if: ['lonjong', 'hijau_kuning'], then: 'pisang' }
        ],
        goals: ['jeruk', 'apel', 'delima', 'pisang'],
        goal: 'apel'
    };

    /* =====================================================================
     * 2. MESIN INFERENSI (murni, tanpa DOM)
     * ===================================================================== */
    function kbInit(kb) {
        if (kb._ready) return kb;
        const concl = new Set(kb.rules.map(r => r.then));
        const prem = new Set();
        kb.rules.forEach(r => { r.mode = r.mode || 'and'; r.if.forEach(p => prem.add(p)); });
        kb.base = Object.keys(kb.atoms).filter(a => !concl.has(a));
        kb.derived = Object.keys(kb.atoms).filter(a => concl.has(a));
        kb.finals = kb.derived.filter(a => !prem.has(a));
        kb._ready = true;
        return kb;
    }
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const L = (kb, a) => kb.atoms[a].s;
    const Q = (kb, a) => kb.atoms[a].q || (kb.atoms[a].s + '?');
    const rulesFor = (kb, a) => kb.rules.filter(r => r.then === a);
    const ruleById = (kb, id) => kb.rules.find(r => r.id === id);
    const nm = (kb, a) => '<b>' + esc(L(kb, a)) + '</b>';
    const nmList = (kb, arr) => arr.map(a => nm(kb, a)).join(', ');
    const joiner = r => (r.mode === 'or' ? ' OR ' : ' AND ');
    const ruleText = (kb, r) => 'IF ' + r.if.map(p => L(kb, p)).join(joiner(r)) + ' THEN ' + L(kb, r.then);
    const ruleHTML = (kb, r) => '<b class="kw">IF</b> ' + r.if.map(p => esc(L(kb, p))).join(' <b class="kw">' + joiner(r).trim() + '</b> ') +
        ' <b class="kw">THEN</b> ' + esc(L(kb, r.then));

    const satisfied = (r, has) => (r.mode === 'or' ? r.if.some(has) : r.if.every(has));
    const usedPremises = (r, has) => (r.mode === 'or' ? r.if.filter(has) : r.if.slice());

    /* ---------- Forward chaining ---------- */
    function forwardRun(kb, known) {
        kbInit(kb);
        const wm = [];
        const has = a => wm.includes(a);
        known.forEach(a => { if (!has(a)) wm.push(a); });
        const initial = wm.slice();
        const how = {};
        initial.forEach(a => { how[a] = { fact: true }; });
        const fired = [];
        const steps = [];
        const snap = (kind, extra) => steps.push(Object.assign({
            kind, wm: wm.slice(), fired: fired.map(f => f.rule), conflict: [], pick: null, added: null, cycle: 0
        }, extra));

        snap('start', {
            msg: initial.length
                ? 'Memori kerja diisi fakta awal: ' + nmList(kb, initial) + '. Belum ada aturan yang dijalankan.'
                : 'Memori kerja masih kosong, sehingga tidak ada aturan yang dapat terpenuhi.'
        });

        for (let cycle = 1; cycle <= 200; cycle++) {
            const sat = kb.rules.filter(r => satisfied(r, has));
            const conflict = sat.filter(r => !has(r.then));
            const again = sat.filter(r => has(r.then) && fired.some(f => f.rule === r.id));
            const againNote = again.length
                ? ' Aturan ' + again.map(r => '<b>' + r.id + '</b>').join(', ') + ' masih cocok, tetapi akibatnya sudah ada di memori kerja, jadi tidak dijalankan lagi.'
                : '';
            if (!conflict.length) {
                const derived = wm.filter(a => !initial.includes(a));
                snap('stop', {
                    cycle,
                    msg: '<b>Siklus ' + cycle + ' — Cocokkan:</b> tidak ada aturan baru yang terpenuhi (himpunan konflik kosong).' + againNote +
                        ' Mesin inferensi <b>berhenti</b>. ' +
                        (derived.length ? 'Fakta baru yang berhasil diturunkan: ' + nmList(kb, derived) + '.' : 'Tidak ada fakta baru yang dapat diturunkan.')
                });
                break;
            }
            const pick = conflict[0];
            snap('match', {
                cycle, conflict: conflict.map(r => r.id), pick: pick.id,
                msg: '<b>Siklus ' + cycle + ' — Cocokkan:</b> bagian IF setiap aturan diuji terhadap memori kerja. Aturan yang terpenuhi: ' +
                    conflict.map(r => '<b>' + r.id + '</b>').join(', ') + ', jadi himpunan konflik = {' + conflict.map(r => r.id).join(', ') + '}.' +
                    (conflict.length > 1
                        ? ' Hanya satu aturan yang boleh dieksekusi per siklus. <b>' + pick.id + '</b> dipilih karena urutannya paling awal (<em>conflict resolution</em>).'
                        : ' Hanya ada satu, jadi <b>' + pick.id + '</b> yang dipilih.') + againNote
            });
            const used = usedPremises(pick, has);
            wm.push(pick.then);
            how[pick.then] = { rule: pick.id, used };
            fired.push({ rule: pick.id, added: pick.then, used });
            snap('fire', {
                cycle, conflict: conflict.map(r => r.id), pick: pick.id, added: pick.then,
                msg: '<b>Siklus ' + cycle + ' — Eksekusi dan perbarui:</b> ' + pick.id + ' dijalankan: <code>' + esc(ruleText(kb, pick)) + '</code>. ' +
                    'Fakta baru ' + nm(kb, pick.then) + ' masuk memori kerja, lalu siklus diulang dari pencocokan.'
            });
        }
        return { steps, wm: wm.slice(), fired, how, initial, finals: kb.finals.filter(has) };
    }

    /* ---------- Backward chaining (jawaban user disimulasikan dari "state") ---------- */
    function whyLines(kb, chain) {
        // chain: [{atom, via}] dari tujuan awal sampai fakta yang sedang ditanyakan
        const out = [];
        chain.forEach((c, i) => {
            if (i === 0) out.push('Tujuan awal sistem: membuktikan ' + nm(kb, c.atom) + '.');
            else out.push('Aturan <b>' + c.via + '</b> memerlukan ' + nm(kb, c.atom) + ' agar dapat menyimpulkan ' + nm(kb, chain[i - 1].atom) + '.');
        });
        if (chain.length) out.push('Karena itu sistem perlu tahu: ' + nm(kb, chain[chain.length - 1].atom) + '.');
        return out;
    }

    function backwardRun(kb, goal, state) {
        kbInit(kb);
        const known = new Set(kb.base.filter(a => state[a] === 'known'));
        const proved = new Set(), failed = new Set(), okRules = new Set(), badRules = new Set();
        const how = {};
        known.forEach(a => { how[a] = { fact: true }; });
        const chain = [];        // [{atom, via}]
        const ruleStack = [];
        const asked = [];
        const steps = [];
        const snap = (kind, extra) => steps.push(Object.assign({
            kind,
            stack: chain.map(c => c.atom), ruleStack: ruleStack.slice(),
            known: [...known], proved: [...proved], failed: [...failed],
            okRules: [...okRules], badRules: [...badRules],
            asked: asked.map(x => ({ fact: x.fact, ans: x.ans })),
            cur: chain.length ? chain[chain.length - 1].atom : null
        }, extra));

        function prove(g, via) {
            chain.push({ atom: g, via });
            snap('goal', {
                msg: chain.length === 1
                    ? '<b>Tujuan:</b> buktikan ' + nm(kb, g) + '.'
                    : '<b>Sub-goal:</b> buktikan ' + nm(kb, g) + ' (syarat aturan ' + via + ').'
            });
            let res;
            if (known.has(g) || proved.has(g)) {
                snap('known', { msg: nm(kb, g) + ' sudah ada di memori kerja, jadi <b>terbukti tanpa perlu bertanya</b>.' });
                res = true;
            } else if (failed.has(g)) {
                snap('cached', { msg: nm(kb, g) + ' sudah pernah diuji dan gagal, jadi tidak diuji ulang.' });
                res = false;
            } else {
                const rs = rulesFor(kb, g);
                if (!rs.length) {
                    const n = asked.length + 1;
                    snap('ask', {
                        fact: g, n,
                        msg: nm(kb, g) + ' tidak ada di memori kerja dan <b>tidak ada aturan yang menyimpulkannya</b>. ' +
                            'Satu-satunya cara: bertanya kepada user. <b>Pertanyaan ke-' + n + ':</b> “' + esc(Q(kb, g)) + '”',
                        why: whyLines(kb, chain)
                    });
                    const yes = state[g] === 'yes';
                    asked.push({ fact: g, ans: yes });
                    if (yes) {
                        known.add(g);
                        how[g] = { fact: true, asked: true };
                        snap('answer', { fact: g, ans: true, msg: 'Jawaban user: <b>ya</b>. ' + nm(kb, g) + ' menjadi fakta di memori kerja → terbukti.' });
                    } else {
                        failed.add(g);
                        snap('answer', { fact: g, ans: false, msg: 'Jawaban user: <b>tidak</b>. ' + nm(kb, g) + ' tidak terbukti, sehingga cabang ini gagal.' });
                    }
                    res = yes;
                } else {
                    res = false;
                    for (let k = 0; k < rs.length && !res; k++) {
                        const r = rs[k];
                        ruleStack.push(r.id);
                        snap('try', {
                            rule: r.id,
                            msg: 'Cari aturan yang menyimpulkan ' + nm(kb, g) + (rs.length > 1 ? ' (aturan ke-' + (k + 1) + ' dari ' + rs.length + ')' : '') +
                                ': <b>' + r.id + '</b>, <code>' + esc(ruleText(kb, r)) + '</code>. ' +
                                (r.if.length === 1
                                    ? 'Agar ' + r.id + ' berlaku, ' + nm(kb, r.if[0]) + ' harus terbukti.'
                                    : r.mode === 'or'
                                        ? 'Cukup <b>salah satu</b> syarat yang terbukti; dicoba berurutan dari kiri.'
                                        : '<b>Semua</b> syarat harus terbukti; dicoba satu per satu dari kiri.')
                        });
                        let ok, used = [];
                        if (r.mode === 'or') {
                            ok = false;
                            for (let i = 0; i < r.if.length && !ok; i++) {
                                if (prove(r.if[i], r.id)) { ok = true; used = [r.if[i]]; }
                                else if (i < r.if.length - 1) {
                                    snap('next-or', { rule: r.id, msg: nm(kb, r.if[i]) + ' gagal. Karena ' + r.id + ' memakai OR, coba syarat berikutnya: ' + nm(kb, r.if[i + 1]) + '.' });
                                }
                            }
                        } else {
                            ok = true;
                            for (let i = 0; i < r.if.length && ok; i++) {
                                if (prove(r.if[i], r.id)) used.push(r.if[i]); else ok = false;
                            }
                        }
                        if (ok) {
                            okRules.add(r.id);
                            proved.add(g);
                            how[g] = { rule: r.id, used };
                            snap('proved', { rule: r.id, msg: 'Syarat <b>' + r.id + '</b> terpenuhi → ' + nm(kb, g) + ' <b>terbukti</b>.' });
                            res = true;
                        } else {
                            badRules.add(r.id);
                            snap('rule-failed', { rule: r.id, msg: 'Aturan <b>' + r.id + '</b> gagal karena syaratnya tidak terbukti.' });
                        }
                        ruleStack.pop();
                    }
                    if (!res) {
                        failed.add(g);
                        snap('failed', { msg: nm(kb, g) + ' <b>tidak terbukti</b>: tidak ada aturan lain yang dapat dipakai.' });
                    }
                }
            }
            chain.pop();
            return res;
        }

        const ok = prove(goal, null);
        snap(ok ? 'done-ok' : 'done-fail', {
            ok,
            msg: ok
                ? '<b>Selesai:</b> ' + nm(kb, goal) + ' terbukti. Pertanyaan yang diajukan kepada user: <b>' + asked.length + '</b>.'
                : '<b>Selesai:</b> ' + nm(kb, goal) + ' tidak dapat dibuktikan dari fakta yang ada. Pertanyaan yang diajukan kepada user: <b>' + asked.length + '</b>.'
        });
        return { steps, ok, how, asked, known: [...known], proved: [...proved], failed: [...failed] };
    }

    /* Urutan penjelasan "Bagaimana?" dari kesimpulan sampai fakta */
    function howLines(kb, atom, how) {
        const out = [], seen = new Set();
        (function walk(a, d) {
            if (seen.has(a)) return;
            seen.add(a);
            const h = how[a];
            if (!h || h.fact) { out.push({ a, d, fact: true, asked: !!(h && h.asked) }); return; }
            out.push({ a, d, rule: h.rule, used: h.used });
            h.used.forEach(p => walk(p, d + 1));
        })(atom, 0);
        return out;
    }
    function howHTML(kb, lines) {
        return '<ol class="pk-how">' + lines.map(l =>
            '<li style="margin-left:' + (l.d * 14) + 'px">' + (l.fact
                ? nm(kb, l.a) + ' — ' + (l.asked ? 'jawaban user (ya).' : 'fakta yang diketahui.') + ' <em>Penjelasan berhenti di sini.</em>'
                : nm(kb, l.a) + ', karena <b>' + l.rule + '</b>: ' + l.used.map(u => esc(L(kb, u))).join(ruleById(kb, l.rule).mode === 'or' ? ' atau ' : ' dan ') + '.') + '</li>').join('') + '</ol>';
    }

    /* ---------- Konsultasi interaktif (generator: berhenti di setiap pertanyaan) ---------- */
    function makeConsult(kb) {
        kbInit(kb);
        const ctx = {
            known: new Set(), failed: new Set(), how: {}, asked: [], chain: [],
            ruleStack: [], okRules: new Set(), badRules: new Set(), found: [], current: null, done: false
        };
        function* prove(g, via) {
            ctx.chain.push({ atom: g, via });
            let res;
            if (ctx.known.has(g)) res = true;
            else if (ctx.failed.has(g)) res = false;
            else {
                const rs = rulesFor(kb, g);
                if (!rs.length) {
                    const ans = yield { type: 'ask', fact: g, chain: ctx.chain.map(c => ({ atom: c.atom, via: c.via })) };
                    ctx.asked.push({ fact: g, ans });
                    if (ans === 'ya') { ctx.known.add(g); ctx.how[g] = { fact: true, asked: true }; res = true; }
                    else { ctx.failed.add(g); res = false; }
                } else {
                    res = false;
                    for (let k = 0; k < rs.length && !res; k++) {
                        const r = rs[k];
                        ctx.ruleStack.push(r.id);
                        let ok, used = [];
                        if (r.mode === 'or') {
                            ok = false;
                            for (let i = 0; i < r.if.length && !ok; i++) {
                                if (yield* prove(r.if[i], r.id)) { ok = true; used = [r.if[i]]; }
                            }
                        } else {
                            ok = true;
                            for (let i = 0; i < r.if.length && ok; i++) {
                                if (yield* prove(r.if[i], r.id)) used.push(r.if[i]); else ok = false;
                            }
                        }
                        ctx.ruleStack.pop();
                        if (ok) { ctx.okRules.add(r.id); ctx.known.add(g); ctx.how[g] = { rule: r.id, used }; res = true; }
                        else ctx.badRules.add(r.id);
                    }
                    if (!res) ctx.failed.add(g);
                }
            }
            ctx.chain.pop();
            return res;
        }
        function* main() {
            for (const g of kb.goals) {
                ctx.current = g;
                const ok = yield* prove(g, null);
                if (ok) { ctx.found.push(g); yield { type: 'found', goal: g }; }
            }
            ctx.done = true;
            ctx.current = null;
            return { type: 'done' };
        }
        const gen = main();
        return {
            ctx,
            next(ans) {
                const r = gen.next(ans);
                return r.done ? { type: 'done' } : r.value;
            }
        };
    }

    /* ---------- Tabel inferensi ---------- */
    const TABEL_LAMARAN = [
        { id: 'Start', text: 'Apa jenis kelamin Anda?', p1: 'R1', t1: 'pria', p2: 'R2', t2: 'wanita', end: false },
        { id: 'R1', text: 'Apakah usia Anda kurang dari 35?', p1: 'C1', t1: 'ya', p2: 'C2', t2: 'tidak', end: false },
        { id: 'R2', text: 'Apakah usia Anda kurang dari 30?', p1: 'C1', t1: 'ya', p2: 'C2', t2: 'tidak', end: false },
        { id: 'C1', text: 'Lamaran diterima', end: true },
        { id: 'C2', text: 'Lamaran ditolak', end: true }
    ];
    const PSEUDO_LAMARAN = [
        'Aturan_dipakai ← Start',
        'WHILE (Aturan_dipakai.Kesimpulan = salah) DO',
        '    Tanyakan Aturan_dipakai.Pernyataan kepada user',
        '    Aturan_dipakai ← Pilihan_yang_dipilih_user',
        'ENDWHILE',
        '// Aturan_dipakai adalah kesimpulan',
        'Tampilkan Aturan_dipakai.Pernyataan kepada user'
    ];
    function lamaranSteps(gender, age) {
        const row = id => TABEL_LAMARAN.find(r => r.id === id);
        const steps = [];
        let cur = 'Start';
        const asked = [];
        steps.push({ line: 0, cur, path: ['Start'], msg: 'Mulai dari baris <b>Start</b>. Variabel <code>Aturan_dipakai</code> diisi <b>Start</b>.' });
        for (let guard = 0; guard < 10; guard++) {
            const r = row(cur);
            if (r.end) {
                steps.push({ line: 1, cur, path: asked.concat([cur]), msg: 'Cek <code>' + cur + '.Kesimpulan</code>: <b>benar</b>, jadi loop <b>berhenti</b>.' });
                steps.push({ line: 6, cur, path: asked.concat([cur]), final: true, msg: 'Tampilkan pernyataan baris <b>' + cur + '</b> kepada user: <b>“' + r.text + '”</b>.' });
                break;
            }
            steps.push({ line: 1, cur, path: asked.concat([cur]), msg: 'Cek <code>' + cur + '.Kesimpulan</code>: <b>salah</b> (baris ini masih pertanyaan), jadi masuk ke dalam loop.' });
            let pilih;
            if (cur === 'Start') pilih = gender === 'pria' ? 1 : 2;
            else {
                const batas = cur === 'R1' ? 35 : 30;
                pilih = age < batas ? 1 : 2;
            }
            const jawab = cur === 'Start' ? (gender === 'pria' ? 'pria' : 'wanita')
                : (pilih === 1 ? 'ya' : 'tidak') + ' (' + age + (pilih === 1 ? ' < ' : ' ≥ ') + (cur === 'R1' ? 35 : 30) + ')';
            steps.push({ line: 2, cur, path: asked.concat([cur]), msg: 'Tanyakan kepada user: <b>“' + r.text + '”</b>. Jawaban: <b>' + jawab + '</b> → Pilihan ' + pilih + '.' });
            const nxt = pilih === 1 ? r.p1 : r.p2;
            asked.push(cur);
            steps.push({ line: 3, cur: nxt, path: asked.concat([nxt]), via: [cur, nxt], msg: '<code>Aturan_dipakai ← Pilihan ' + pilih + '</code>, yaitu <b>' + nxt + '</b>. Kembali ke pengecekan.' });
            cur = nxt;
        }
        return steps;
    }
    function lamaranFinal(gender, age) {
        const s = lamaranSteps(gender, age);
        return s[s.length - 1].cur;
    }

    const TABEL_OBLIGASI = [
        { id: 'C1', cond: '', eff: 'jangan beli obligasi', next: 'Berhenti' },
        { id: 'C2', cond: '', eff: 'beli obligasi', next: 'Berhenti' },
        { id: 'R1', cond: 'suku bunga turun', eff: 'harga obligasi naik', next: 'C1' },
        { id: 'R2', cond: 'suku bunga naik', eff: 'harga obligasi turun', next: 'R6' },
        { id: 'R3', cond: 'suku bunga tidak berubah', eff: 'harga obligasi tidak berubah', next: 'C1' },
        { id: 'R4', cond: 'dolar naik', eff: 'suku bunga turun', next: 'R1' },
        { id: 'R5', cond: 'dolar turun', eff: 'suku bunga naik', next: 'R2' },
        { id: 'R6', cond: 'harga obligasi turun', eff: 'beli obligasi', next: 'C2' }
    ];
    function obligasiSteps(fact) {
        const find = id => TABEL_OBLIGASI.find(r => r.id === id);
        const start = TABEL_OBLIGASI.find(r => r.cond === fact);
        const steps = [];
        steps.push({ cur: null, path: [], msg: 'Fakta awal dari user: <b>' + fact + '</b>. Cari baris yang kolom <em>Kondisi</em>-nya sama dengan fakta ini.' });
        let r = start;
        const path = [];
        for (let g = 0; r && g < 10; g++) {
            path.push(r.id);
            if (r.cond === '') {
                steps.push({ cur: r.id, path: path.slice(), final: true, msg: 'Baris <b>' + r.id + '</b> berisi kesimpulan: <b>“' + r.eff + '”</b>. Kolom aturan berikutnya <b>Berhenti</b>, jadi proses selesai.' });
                break;
            }
            steps.push({ cur: r.id, path: path.slice(), msg: 'Baris <b>' + r.id + '</b> cocok: kondisi “' + r.cond + '” benar, maka akibatnya <b>“' + r.eff + '”</b>. Kolom <em>Aturan berikutnya</em> menunjuk <b>' + r.next + '</b>.' });
            r = find(r.next);
        }
        return steps;
    }

    /* ---------- Konflik: aturan diskon ---------- */
    const DISKON = [
        { id: 'R1', if: ['member'], prio: 1, diskon: 5 },
        { id: 'R2', if: ['member', 'besar'], prio: 3, diskon: 10 },
        { id: 'R3', if: ['gajian'], prio: 4, diskon: 7 },
        { id: 'R4', if: ['member', 'besar', 'gajian'], prio: 2, diskon: 15 }
    ];
    const DISKON_LBL = { member: 'pembeli adalah member', besar: 'belanja di atas Rp500.000', gajian: 'hari ini tanggal gajian' };
    function pilihKonflik(strategi, matched) {
        if (!matched.length) return null;
        const by = {
            urutan: (a, b) => DISKON.indexOf(a) - DISKON.indexOf(b),
            spesifik: (a, b) => b.if.length - a.if.length || DISKON.indexOf(a) - DISKON.indexOf(b),
            prioritas: (a, b) => b.prio - a.prio || DISKON.indexOf(a) - DISKON.indexOf(b),
            terbesar: (a, b) => b.diskon - a.diskon || DISKON.indexOf(a) - DISKON.indexOf(b)
        };
        return matched.slice().sort(by[strategi])[0];
    }

    /* ---------- Sistem berbasis skor: spam filter ---------- */
    const SPAM = [
        { id: 'T1', text: 'Subjek memuat “MENANG HADIAH” atau “GRATIS”', pts: 2.5 },
        { id: 'T2', text: 'Tautan memakai alamat IP, bukan nama domain', pts: 2.0 },
        { id: 'T3', text: 'Pengirim gagal verifikasi SPF', pts: 1.5 },
        { id: 'T4', text: 'Pesan HTML tanpa isi teks', pts: 1.2 },
        { id: 'T5', text: 'Tiga tanda seru atau lebih pada subjek', pts: 0.8 },
        { id: 'T6', text: 'Pengirim ada di buku alamat penerima', pts: -3.0 }
    ];
    const SPAM_BATAS = 5.0;

    /* =====================================================================
     * Tiga aplikasi web nyata (Bagian 5: "Tiga Sistem Pakar Web yang Dapat Dicoba")
     * Data dan rumus disalin dari basis data dan kode ketiga aplikasi (dibaca 2026-10-27):
     *   APP.tropis  TropisCheck  : Certainty Factor + Dempster-Shafer (disederhanakan)
     *   APP.balita  BabyCheck    : forward chaining + Dempster-Shafer (aturan kombinasi Dempster)
     *   APP.cbr     SehatBalita  : Case-Based Reasoning + fuzzy
     * ===================================================================== */
    const APP = {};
    APP.tropis = {
        sym: {1: "Demam tinggi mendadak", 2: "Demam naik bertahap setiap hari", 3: "Demam periodik disertai menggigil", 4: "Sakit kepala hebat", 5: "Nyeri di belakang bola mata", 6: "Nyeri otot", 7: "Nyeri sendi hebat", 8: "Mual dan muntah", 9: "Ruam kemerahan pada kulit", 10: "Bintik merah (petekie) di kulit", 11: "Mimisan atau gusi berdarah", 12: "Nyeri perut", 13: "Diare", 14: "Sembelit", 15: "Lemas dan lelah berlebihan", 16: "Berkeringat deras setelah demam", 17: "Mata merah", 18: "Mata dan kulit menguning", 19: "Urine berwarna gelap seperti teh", 20: "Pembengkakan kaki atau tungkai", 21: "Pembengkakan kelenjar getah bening", 22: "Nyeri betis", 23: "Hilang nafsu makan", 24: "Kulit tampak pucat", 25: "Lidah kotor dan berselaput", 26: "Kaku sendi terutama di pagi hari", 27: "Riwayat kontak dengan air banjir atau tikus", 28: "Tinja berwarna pucat"},
        dis: [
            { id: 1, name: "Demam Berdarah Dengue (DBD)", rel: { 1: 0.8, 4: 0.5, 5: 0.6, 6: 0.5, 8: 0.4, 9: 0.5, 10: 0.8, 11: 0.7, 12: 0.4, 15: 0.4, 23: 0.3 } },
            { id: 2, name: "Malaria", rel: { 1: 0.5, 3: 0.9, 4: 0.5, 6: 0.3, 8: 0.4, 15: 0.5, 16: 0.7, 18: 0.3, 24: 0.6 } },
            { id: 3, name: "Demam Tifoid (Tifus)", rel: { 2: 0.9, 4: 0.5, 8: 0.3, 12: 0.6, 13: 0.4, 14: 0.4, 15: 0.5, 23: 0.5, 25: 0.8 } },
            { id: 4, name: "Chikungunya", rel: { 1: 0.7, 4: 0.4, 6: 0.5, 7: 0.9, 8: 0.3, 9: 0.5, 17: 0.3, 26: 0.7 } },
            { id: 5, name: "Leptospirosis", rel: { 1: 0.6, 4: 0.4, 6: 0.5, 8: 0.3, 17: 0.7, 18: 0.5, 19: 0.4, 22: 0.8, 27: 0.8 } },
            { id: 6, name: "Filariasis (Kaki Gajah)", rel: { 1: 0.4, 6: 0.2, 15: 0.3, 20: 0.9, 21: 0.8 } },
            { id: 7, name: "Hepatitis A", rel: { 1: 0.3, 8: 0.5, 12: 0.4, 15: 0.6, 18: 0.9, 19: 0.8, 23: 0.6, 28: 0.7 } }
        ]
    };
    APP.balita = {
        sym: {1: "Demam", 2: "Batuk", 3: "Pilek", 4: "Ruam", 5: "Diare", 6: "Muntah", 7: "Sesak Napas", 8: "Lemas", 9: "Sakit Kepala", 10: "Nyeri Perut", 11: "Mata Merah", 12: "Bengkak", 13: "Menggigil", 14: "Nyeri Telinga", 15: "Kelelahan", 16: "Sakit Tenggorokan", 17: "Mual", 18: "Bersin", 19: "Kehilangan Nafsu Makan", 20: "Nyeri Otot", 21: "Mata Berair", 22: "Keringat Dingin", 23: "Dehidrasi", 24: "Nyeri Sendi", 25: "Kesulitan Tidur", 26: "Kemerahan pada Kulit", 27: "Lidah Putih", 28: "Gatal-gatal", 29: "Hidung Tersumbat", 30: "Sariawan", 31: "Sulit Menelan", 32: "Mimisan"},
        dis: [
            { id: 1, name: "Pilek", rel: { 1: 0.7, 2: 0.8, 3: 0.9 } },
            { id: 2, name: "Influenza (Flu)", rel: { 1: 0.9, 2: 0.8, 4: 0.7, 8: 0.7 } },
            { id: 3, name: "Cacar Air", rel: { 1: 0.8, 4: 0.9, 6: 0.6 } },
            { id: 4, name: "Campak", rel: { 1: 0.9, 2: 0.7, 4: 0.9, 9: 0.8 } },
            { id: 5, name: "Rubella", rel: { 1: 0.7, 4: 0.8, 10: 0.6 } },
            { id: 6, name: "Diare", rel: { 5: 0.9, 6: 0.7, 24: 0.6 } },
            { id: 7, name: "Bronkitis", rel: { 2: 0.8, 9: 0.6, 11: 0.7 } },
            { id: 8, name: "Pneumonia", rel: { 1: 0.8, 2: 0.7, 11: 0.8 } },
            { id: 9, name: "Demam Berdarah", rel: { 1: 0.9, 4: 0.7, 12: 0.8 } },
            { id: 10, name: "Tifus", rel: { 1: 0.9, 5: 0.8, 6: 0.7 } },
            { id: 11, name: "Asma", rel: { 2: 0.7, 11: 0.9 } },
            { id: 12, name: "Infeksi Telinga", rel: { 1: 0.6, 13: 0.8 } },
            { id: 13, name: "Meningitis", rel: { 1: 0.9, 9: 0.8, 14: 0.7 } },
            { id: 14, name: "Croup", rel: { 2: 0.8, 15: 0.7 } },
            { id: 15, name: "Pertusis (Batuk Rejan)", rel: { 2: 0.9, 16: 0.7, 17: 0.8 } }
        ]
    };
    APP.cbr = {
        gejala: [
            { id: 1, nama: 'Demam tinggi (≥38°C)', bobot: 0.9 }, { id: 2, nama: 'Batuk kering', bobot: 0.7 },
            { id: 3, nama: 'Batuk berdahak', bobot: 0.8 }, { id: 4, nama: 'Pilek/hidung tersumbat', bobot: 0.6 },
            { id: 5, nama: 'Diare', bobot: 0.8 }, { id: 6, nama: 'Muntah', bobot: 0.7 },
            { id: 7, nama: 'Nafsu makan menurun', bobot: 0.6 }, { id: 8, nama: 'Lemas dan lesu', bobot: 0.7 },
            { id: 9, nama: 'Ruam kulit', bobot: 0.6 }, { id: 10, nama: 'Sesak napas', bobot: 0.9 },
            { id: 11, nama: 'Badan panas tangan dingin', bobot: 0.6 }, { id: 12, nama: 'Sariawan di mulut', bobot: 0.5 },
            { id: 13, nama: 'Perut kembung', bobot: 0.5 }, { id: 14, nama: 'Mata merah', bobot: 0.4 },
            { id: 15, nama: 'Kulit pucat', bobot: 0.6 }
        ],
        kasus: [
            { id: 1, penyakit: 'Demam Berdarah', g: { 1: 0.9, 8: 0.7, 9: 0.8 } },
            { id: 2, penyakit: 'Demam Berdarah', g: { 1: 0.8, 11: 0.7, 14: 0.6 } },
            { id: 3, penyakit: 'Malaria', g: { 1: 0.85, 7: 0.7, 8: 0.75 } },
            { id: 4, penyakit: 'Batuk Pilek', g: { 2: 0.7, 3: 0.8, 4: 0.65 } },
            { id: 5, penyakit: 'Tifus', g: { 1: 0.9, 5: 0.8, 7: 0.75 } },
            { id: 6, penyakit: 'Sakit Kepala', g: { 8: 0.8, 11: 0.7, 15: 0.6 } },
            { id: 7, penyakit: 'Diabetes Melitus', g: { 7: 0.8, 8: 0.75, 15: 0.7 } },
            { id: 8, penyakit: 'Hipertensi', g: { 8: 0.7, 11: 0.6, 15: 0.5 } },
            { id: 9, penyakit: 'Asma', g: { 3: 0.7, 8: 0.6, 10: 0.9 } },
            { id: 10, penyakit: 'Rematik', g: { 8: 0.8, 11: 0.7, 15: 0.6 } },
            { id: 11, penyakit: 'Demam Berdarah', g: { 1: 0.9, 11: 0.8, 14: 0.7 } }
        ],
        tingkat: [['Ringan', 0.3], ['Sedang', 0.5], ['Berat', 0.7], ['Parah', 0.9]],
        batas: 0.3
    };

    const kunciAngka = o => Object.keys(o).map(Number);

    // TropisCheck. sel = daftar id gejala. CF per penyakit digabung bertahap: baru = lama + cf × (1 − lama).
    // "DS" pada aplikasi ini = jumlah cf gejala cocok tiap penyakit dibagi total semua penyakit.
    function tropisHitung(sel) {
        const rows = [];
        APP.tropis.dis.forEach(d => {
            let cf = 0;
            const steps = [];
            kunciAngka(d.rel).filter(s => sel.includes(s)).forEach(s => {
                const c = d.rel[s], lama = cf;
                cf = lama + c * (1 - lama);
                steps.push({ s, c, lama, baru: cf });
            });
            if (steps.length) rows.push({ id: d.id, name: d.name, cf, steps, sum: steps.reduce((a, t) => a + t.c, 0) });
        });
        const total = rows.reduce((a, r) => a + r.sum, 0);
        rows.forEach(r => { r.ds = r.sum / total; });
        rows.sort((a, b) => b.cf - a.cf);
        return { rows, total };
    }

    // BabyCheck. Kerangka {Penyakit, Bukan penyakit}; massa awal 0,5 / 0,5, tiap gejala menambah massa (c, 1 − c).
    function dsKombinasi(cs) {
        let m = 0.5, n = 0.5;
        const steps = [];
        cs.forEach(c => {
            const k = m * (1 - c) + n * c;                // konflik
            const m2 = (m * c) / (1 - k), n2 = (n * (1 - c)) / (1 - k);
            steps.push({ c, k, dari: m, m: m2, n: n2 });
            m = m2; n = n2;
        });
        return { m, n, steps };
    }
    function balitaHitung(sel) {
        const rows = [];
        APP.balita.dis.forEach(d => {
            const ss = kunciAngka(d.rel).filter(s => sel.includes(s));
            if (!ss.length) return;
            const cs = ss.map(s => d.rel[s]);
            const r = dsKombinasi(cs);
            rows.push({ id: d.id, name: d.name, ss, cs, m: r.m, steps: r.steps });
        });
        rows.sort((a, b) => b.m - a.m);
        return rows;
    }

    // SehatBalita. input = { idGejala: intensitas }. Skor fuzzy = (1 − |intensitas − bobot|) × bobot.
    function cbrHitung(input) {
        const gid = kunciAngka(input);
        const skor = {};
        gid.forEach(g => {
            const b = APP.cbr.gejala.find(x => x.id === g).bobot;
            skor[g] = Math.max(0, 1 - Math.abs(input[g] - b)) * b;
        });
        const rows = APP.cbr.kasus.map(k => {
            let sum = 0, w = 0, cocok = 0;
            const det = [];
            gid.forEach(g => {
                if (k.g[g] === undefined) { det.push({ g, ada: false }); return; }
                const sim = 1 - Math.abs(input[g] - k.g[g]);
                sum += sim * skor[g]; w += skor[g]; cocok++;
                det.push({ g, ada: true, sim, kasus: k.g[g], skor: skor[g], kontribusi: sim * skor[g] });
            });
            const kem = w > 0 ? sum / w : 0;
            const nilai = cocok > 0 ? kem * (cocok / gid.length) : 0;
            return { id: k.id, penyakit: k.penyakit, cocok, dipilih: gid.length, kem, nilai, det, sum, w, lolos: nilai > APP.cbr.batas };
        });
        const urut = rows.filter(r => r.lolos).sort((a, b) => b.nilai - a.nilai);
        return { skor, rows, terbaik: urut[0] || null };
    }
    const cbrKategori = v => v >= 0.8 ? 'Sangat Tinggi' : v >= 0.6 ? 'Tinggi' : v >= 0.4 ? 'Sedang' : 'Rendah';


    /* =====================================================================
     * 3. TAMPILAN (hanya jika ada DOM)
     * ===================================================================== */
    const CSS = [
        '.pk-ico{width:1em;height:1em;vertical-align:-.14em;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}',
        '.pk-ico .f{fill:currentColor;stroke:none}',
        '.viz-result>.pk-ico{margin-top:3px}',
        '.pk .pk-scroll{overflow-x:auto}',
        '.pk .pk-scroll>div{min-width:560px}',
        '.pk-facts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;font-size:.88em}',
        '.pk-facts-title{font-weight:700;color:#1a2a4a}',
        '.pk-fact{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #b0c4de;background:#fff;border-radius:18px;padding:4px 12px;font:inherit;font-size:.92em;font-weight:600;color:#1a2a4a;cursor:pointer;transition:background .2s,border-color .2s}',
        '.pk-fact small{font-weight:400;color:#546e7a}',
        '.pk-fact:hover{border-color:#1565c0}',
        '.pk-fact.known{background:#e8f5e9;border-color:#2e7d32}',
        '.pk-fact.yes{background:#fff8e1;border-color:#f9a825}',
        '.pk-fact.no{background:#fafafa;border-style:dashed;border-color:#90a4ae}',
        '.pk-fact.dim{opacity:.55}',
        '.pk-phase{display:flex;flex-wrap:wrap;gap:6px}',
        '.pk-phase span{font-size:.78em;font-weight:700;padding:3px 10px;border-radius:12px;background:#eceff1;color:#78909c;transition:background .25s,color .25s}',
        '.pk-phase span.on{background:#e65100;color:#fff}',
        '.pk-phase span.stop{background:#2e7d32;color:#fff}',
        '.pk-edge{fill:none;stroke:#b0bec5;stroke-width:2;marker-end:url(#pk-arr-gray);transition:stroke .3s}',
        '.pk-edge.cand{stroke:#f9a825;stroke-dasharray:7 5;marker-end:url(#pk-arr-amber);animation:pk-march .9s linear infinite}',
        '.pk-edge.pick{stroke:#e65100;stroke-width:3;stroke-dasharray:7 5;marker-end:url(#pk-arr-orange);animation:pk-march .9s linear infinite}',
        '.pk-edge.fire{stroke:#2e7d32;stroke-width:3.5;stroke-dasharray:8 5;marker-end:url(#pk-arr-green);animation:pk-march .8s linear infinite}',
        '.pk-edge.done{stroke:#66bb6a;stroke-width:2.5;marker-end:url(#pk-arr-green)}',
        '.pk-edge.bad{stroke:#c62828;stroke-dasharray:3 5;marker-end:url(#pk-arr-red)}',
        '.pk-edge.rev{animation-direction:reverse}',
        '@keyframes pk-march{to{stroke-dashoffset:-26}}',
        '@keyframes pk-pop{0%{transform:scale(.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}',
        '@keyframes pk-pulse{50%{stroke-opacity:.35}}',
        '.pk-node{transform-box:fill-box;transform-origin:center}',
        '.pk-node rect{fill:#fff;stroke:#90a4ae;stroke-width:1.8;transition:fill .35s,stroke .35s}',
        '.pk-node .pk-ring{fill:none;stroke:#6a1b9a;stroke-width:2;stroke-dasharray:4 3;opacity:0}',
        '.pk-node.tgt .pk-ring{opacity:1}',
        '.pk-node text{font:600 11.5px "Segoe UI",Tahoma,sans-serif;fill:#263238;text-anchor:middle;pointer-events:none}',
        '.pk-node.st-have rect{fill:#e8f5e9;stroke:#2e7d32}',
        '.pk-node.st-new{animation:pk-pop .5s ease-out}',
        '.pk-node.st-new rect{fill:#c8e6c9;stroke:#1b5e20;stroke-width:3}',
        '.pk-node.st-path rect{fill:#fff8f0;stroke:#ef9a50;stroke-width:2.5}',
        '.pk-node.st-cur rect{fill:#fff3e0;stroke:#e65100;stroke-width:3;animation:pk-pulse 1.2s ease-in-out infinite}',
        '.pk-node.st-ask rect{fill:#fff8e1;stroke:#f9a825;stroke-width:3.5;animation:pk-pulse .9s ease-in-out infinite}',
        '.pk-node.st-ok rect{fill:#c8e6c9;stroke:#2e7d32;stroke-width:2.5}',
        '.pk-node.st-bad rect{fill:#fce4ec;stroke:#c62828;stroke-dasharray:5 3;stroke-width:2.5}',
        '.pk-gate circle{fill:#eceff1;stroke:#90a4ae;stroke-width:1.8;transition:fill .3s,stroke .3s}',
        '.pk-gate text{font:700 10.5px "Segoe UI",sans-serif;fill:#37474f;text-anchor:middle;pointer-events:none}',
        '.pk-gate .pk-op{font-size:9px;fill:#6a1b9a}',
        '.pk-gate.cand circle{fill:#fff8e1;stroke:#f9a825;stroke-width:2.5}',
        '.pk-gate.pick circle{fill:#ffe0b2;stroke:#e65100;stroke-width:3}',
        '.pk-gate.fire circle{fill:#2e7d32;stroke:#1b5e20}',
        '.pk-gate.fire text{fill:#fff}',
        '.pk-gate.done circle{fill:#c8e6c9;stroke:#66bb6a}',
        '.pk-gate.bad circle{fill:#fce4ec;stroke:#c62828}',
        '.pk-why{background:#f3e5f5;border-left:4px solid #6a1b9a;border-radius:0 8px 8px 0;padding:8px 12px;font-size:.92em;line-height:1.5}',
        '.pk-why h6{margin:0 0 4px;color:#6a1b9a;font-size:.78em;text-transform:uppercase;letter-spacing:.5px}',
        '.pk-why ul,.pk-how{margin:0;padding-left:18px}',
        '.pk-how{list-style:decimal;font-size:.92em;line-height:1.55}',
        '.pk-stack{display:flex;flex-direction:column;gap:4px}',
        '.pk-stack div{border-radius:8px;padding:4px 10px;background:#fff3e0;border-left:4px solid #ef9a50;font-size:.88em;font-weight:600}',
        '.pk-stack div.top{background:#ffe0b2;border-left-color:#e65100}',
        '.pk-qa{display:flex;flex-direction:column;gap:3px;font-size:.86em}',
        '.pk-qa span.y{color:#1b5e20;font-weight:700}',
        '.pk-qa span.n{color:#8e1b1b;font-weight:700}',
        /* lab aturan */
        '.pk-switches{display:flex;flex-wrap:wrap;gap:10px 18px;margin-bottom:12px}',
        '.pk-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:#1a2a4a;font-size:.92em}',
        '.pk-switch input{position:absolute;opacity:0;width:0;height:0}',
        '.pk-slider{position:relative;width:42px;height:22px;border-radius:12px;background:#b0bec5;transition:background .25s;flex-shrink:0}',
        '.pk-slider::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .25s}',
        '.pk-switch input:checked+.pk-slider{background:#2e7d32}',
        '.pk-switch input:checked+.pk-slider::after{transform:translateX(20px)}',
        '.pk-switch input:focus-visible+.pk-slider{outline:3px solid #90caf9}',
        '.pk-rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:12px}',
        '.pk-rule{background:#fff;border:1.5px solid #d6e2f3;border-radius:10px;padding:10px 12px;transition:border-color .3s,background .3s}',
        '.pk-rule.on{border-color:#2e7d32;background:#f1f8f1}',
        '.pk-rule h5{margin:0 0 6px;font-size:.88em;color:#1a2a4a}',
        '.pk-rule .f{font-family:Consolas,Monaco,monospace;font-size:.84em;line-height:1.7;color:#37474f}',
        '.pk-rule .f .t{color:#1b5e20;font-weight:700}',
        '.pk-rule .f .x{color:#9e9e9e}',
        '.pk-lamp{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:.88em;font-weight:700;color:#78909c}',
        '.pk-lamp i{width:14px;height:14px;border-radius:50%;background:#cfd8dc;box-shadow:inset 0 0 0 2px #b0bec5;transition:background .3s,box-shadow .3s}',
        '.pk-rule.on .pk-lamp{color:#1b5e20}',
        '.pk-rule.on .pk-lamp i{background:#66bb6a;box-shadow:0 0 0 4px rgba(102,187,106,.35)}',
        '.pk-truth{font-size:.82em;margin:0;width:100%}',
        '.pk-truth th,.pk-truth td{text-align:center;padding:5px 6px}',
        '.pk-truth tr.cur td{background:#fff3e0;font-weight:700}',
        '.pk-truth td.t{color:#1b5e20}',
        '.pk-truth td.f{color:#9e9e9e}',
        /* arsitektur */
        '.pk-arch .box{fill:#fff;stroke:#90a4ae;stroke-width:2;cursor:pointer;transition:fill .3s,stroke .3s}',
        '.pk-arch .comp:hover .box{stroke:#1565c0}',
        '.pk-arch .comp.on .box{fill:#fff3e0;stroke:#e65100;stroke-width:3.5}',
        '.pk-arch .comp.side .box{fill:#f5f8ff}',
        '.pk-arch text{font-family:"Segoe UI",Tahoma,sans-serif;fill:#1a2a4a;text-anchor:middle;pointer-events:none}',
        '.pk-arch .num{font-size:11px;font-weight:700;fill:#1565c0}',
        '.pk-arch .lbl{font-size:12px;font-weight:700}',
        '.pk-arch .sub{font-size:10.5px;fill:#607d8b}',
        '.pk-arch .zone{fill:#f5f8ff;stroke:#1565c0;stroke-width:2;stroke-dasharray:7 5}',
        '.pk-arch .zone-t{font-size:12px;font-weight:700;fill:#1565c0}',
        '.pk-arch .flow{fill:none;stroke:#90a4ae;stroke-width:2.2;marker-end:url(#pk-arr-gray);stroke-dasharray:7 5;animation:pk-march 1.2s linear infinite}',
        '.pk-arch .flow.hot{stroke:#e65100;stroke-width:3;marker-end:url(#pk-arr-orange)}',
        /* konsultasi */
        '.pk-consult-body{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:14px;align-items:start}',
        '.pk-chat{background:#fff;border:1px solid #e3e8f0;border-radius:10px;padding:10px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:7px}',
        '.pk-b{max-width:88%;padding:7px 12px;border-radius:12px;font-size:.9em;line-height:1.45}',
        '.pk-b.sp{align-self:flex-start;background:#e3f2fd;border-bottom-left-radius:3px}',
        '.pk-b.us{align-self:flex-end;background:#e8f5e9;border-bottom-right-radius:3px;font-weight:700}',
        '.pk-b.sys{align-self:stretch;max-width:100%;background:#f3e5f5;border-left:4px solid #6a1b9a;border-radius:0 8px 8px 0;font-size:.86em}',
        '.pk-b.win{align-self:stretch;max-width:100%;background:#c8e6c9;border-left:4px solid #2e7d32;border-radius:0 8px 8px 0;font-weight:700}',
        '.pk-b.lose{align-self:stretch;max-width:100%;background:#fce4ec;border-left:4px solid #c62828;border-radius:0 8px 8px 0}',
        '.pk-ans{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
        '.pk-side h6{margin:12px 0 6px;font-size:.76em;text-transform:uppercase;letter-spacing:.5px;color:#5a7a9a}',
        '.pk-side h6:first-child{margin-top:0}',
        '.pk-goal{display:flex;align-items:center;gap:8px;padding:4px 10px;border-radius:8px;background:#fff;border:1px solid #e3e8f0;font-size:.88em;margin-bottom:4px}',
        '.pk-goal b{flex:1}',
        '.pk-goal small{font-weight:700;color:#78909c}',
        '.pk-goal.now{border-color:#e65100;background:#fff3e0}',
        '.pk-goal.now small{color:#e65100}',
        '.pk-goal.ok{border-color:#2e7d32;background:#e8f5e9}',
        '.pk-goal.ok small{color:#1b5e20}',
        '.pk-goal.bad{opacity:.65}',
        '.pk-goal.bad small{color:#c62828}',
        '.pk-rl{font-size:.82em;line-height:1.5;padding:3px 8px;border-radius:6px;border-left:3px solid transparent;margin-bottom:2px}',
        '.pk-rl.try{background:#fff3e0;border-left-color:#e65100}',
        '.pk-rl.ok{background:#e8f5e9;border-left-color:#2e7d32}',
        '.pk-rl.bad{color:#9e9e9e;text-decoration:line-through}',
        '.pk-rl b.kw{color:#1565c0}',
        '.pk-count{display:flex;gap:10px;flex-wrap:wrap}',
        '.pk-count div{background:#fff;border:1px solid #e3e8f0;border-radius:8px;padding:6px 12px;font-size:.82em;color:#555}',
        '.pk-count b{display:block;font-size:1.4em;color:#1a2a4a}',
        /* tabel inferensi */
        '.pk-code{background:#10203d;color:#cfd8dc;border-radius:8px;padding:10px 0;font:.85em/1.7 Consolas,Monaco,monospace;margin-bottom:10px;overflow-x:auto}',
        '.pk-code div{padding:0 14px;white-space:pre;border-left:4px solid transparent}',
        '.pk-code div.on{background:rgba(255,167,38,.2);border-left-color:#ffa726;color:#fff}',
        '.pk-code .ln{display:inline-block;width:2em;color:#607d8b}',
        '.pk-itab{width:100%;border-collapse:collapse;font-size:.84em;margin:0}',
        '.pk-itab th,.pk-itab td{border:1px solid #d6e2f3;padding:5px 8px;text-align:left}',
        '.pk-itab th{background:#1a2a4a;color:#fff}',
        '.pk-itab tr.cur td{background:#ffe0b2;font-weight:700}',
        '.pk-itab tr.past td{background:#e8f5e9}',
        '.pk-itab tr.end td:first-child{color:#2e7d32}',
        '.pk-tree .tn rect{fill:#fff;stroke:#90a4ae;stroke-width:1.8;transition:fill .3s,stroke .3s}',
        '.pk-tree .tn.past rect{fill:#e8f5e9;stroke:#66bb6a}',
        '.pk-tree .tn.cur rect{fill:#ffe0b2;stroke:#e65100;stroke-width:3}',
        '.pk-tree .tn.end rect{stroke:#1565c0}',
        '.pk-tree .tn text{font:600 11px "Segoe UI",sans-serif;fill:#263238;text-anchor:middle;pointer-events:none}',
        '.pk-tree .te{fill:none;stroke:#b0bec5;stroke-width:2;transition:stroke .3s}',
        '.pk-tree .te.on{stroke:#e65100;stroke-width:3.5}',
        '.pk-tree .tl{font:600 10.5px "Segoe UI",sans-serif;fill:#546e7a;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:3px}',
        '.pk-var{display:inline-block;font-family:Consolas,monospace;background:#fff;border:1px solid #d6e2f3;border-radius:6px;padding:2px 8px;font-weight:700}',
        /* konflik dan skor */
        '.pk-rtab{width:100%;border-collapse:collapse;font-size:.86em;margin:0}',
        '.pk-rtab th,.pk-rtab td{border:1px solid #d6e2f3;padding:6px 8px;text-align:left;vertical-align:middle}',
        '.pk-rtab th{background:#1a2a4a;color:#fff}',
        '.pk-rtab tr.match td{background:#fffde7}',
        '.pk-rtab tr.pick td{background:#c8e6c9;font-weight:700}',
        '.pk-rtab tr.nomatch td{color:#9e9e9e}',
        '.pk-meter{height:22px;border-radius:11px;background:#e3e8f0;position:relative;overflow:hidden;margin:6px 0 4px}',
        '.pk-meter i{position:absolute;left:0;top:0;bottom:0;background:#1565c0;border-radius:11px;transition:width .35s,background .35s}',
        '.pk-meter i.hot{background:#c62828}',
        '.pk-meter u{position:absolute;top:0;bottom:0;width:0;border-left:3px dashed #1a2a4a}',
        '.pk-verdict{font-weight:700;font-size:1.05em;padding:8px 12px;border-radius:8px;margin-top:8px}',
        '.pk-verdict.ok{background:#e8f5e9;color:#1b5e20}',
        '.pk-verdict.bad{background:#fce4ec;color:#8e1b1b}',
        /* aplikasi web nyata */
        '.pk-bar{position:relative;height:20px;border-radius:10px;background:#e3e8f0;overflow:hidden;min-width:120px}',
        '.pk-bar i{position:absolute;left:0;top:0;bottom:0;background:#90caf9;border-radius:10px;transition:width .35s}',
        '.pk-bar.alt i{background:#ce93d8}',
        '.pk-bar b{position:relative;z-index:1;font-size:.82em;padding:0 8px;line-height:20px;color:#0d1b3a}',
        '.pk-link{background:none;border:0;padding:0;font:inherit;font-weight:700;color:#1a2a4a;text-align:left;cursor:pointer;text-decoration:underline dotted}',
        '.pk-rtab tr[data-id]{cursor:pointer}',
        '.pk-rtab tr[data-id]:hover td{background:#f5f8ff}',
        '.pk-rtab tr.sel td{background:#e3f2fd}',
        '.pk-rtab tr.pick.sel td{background:#c8e6c9}',
        '.pk-note{font-size:.85em;color:#546e7a;margin:8px 0 0;line-height:1.5}',
        '@media (max-width:800px){.pk-consult-body{grid-template-columns:1fr}}',
        '@media (prefers-reduced-motion:reduce){.pk-edge,.pk-arch .flow,.pk-node{animation:none!important}}'
    ].join('\n');

    function installDOM() {
        const doc = root.document;
        const st = doc.createElement('style');
        st.textContent = CSS;
        doc.head.appendChild(st);
        const defs = doc.createElement('div');
        defs.setAttribute('aria-hidden', 'true');
        defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        const marker = (id, color) => '<marker id="pk-arr-' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="' + color + '"/></marker>';
        defs.innerHTML = '<svg width="0" height="0"><defs>' + marker('gray', '#90a4ae') + marker('amber', '#f9a825') +
            marker('orange', '#e65100') + marker('green', '#2e7d32') + marker('red', '#c62828') + '</defs></svg>';
        doc.body.appendChild(defs);
    }

    let UID = 0;
    // Ikon digambar sebagai SVG sebaris (bukan font), agar selalu tampil walau webfont Font Awesome gagal dimuat.
    const SVGI = {
        'check': '<path d="M3 8.6l3.2 3.2L13 4.6"/>',
        'xmark': '<path d="M4 4l8 8M12 4l-8 8"/>',
        'circle-question': '<circle cx="8" cy="8" r="6.4"/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.4"/><circle class="f" cx="8" cy="11.4" r=".9"/>',
        'circle-check': '<circle cx="8" cy="8" r="6.4"/><path d="M5 8.2l2 2L11 6"/>',
        'circle-xmark': '<circle cx="8" cy="8" r="6.4"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/>',
        'triangle-exclamation': '<path d="M8 2.2l6.2 11H1.8z"/><path d="M8 6.6v3.2"/><circle class="f" cx="8" cy="11.6" r=".9"/>',
        'circle-info': '<circle cx="8" cy="8" r="6.4"/><path d="M8 7.2v4"/><circle class="f" cx="8" cy="4.9" r=".9"/>',
        'rotate-left': '<path d="M3.2 8a4.8 4.8 0 1 0 1.6-3.6"/><path d="M3 2.4v3.2h3.2"/>',
        'arrow-rotate-left': '<path d="M3.2 8a4.8 4.8 0 1 0 1.6-3.6"/><path d="M3 2.4v3.2h3.2"/>',
        'backward-step': '<path d="M3.5 3v10"/><path class="f" d="M13 3.4v9.2L6 8z"/>',
        'forward-step': '<path d="M12.5 3v10"/><path class="f" d="M3 3.4v9.2L10 8z"/>',
        'magnifying-glass': '<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14"/>',
        'tag': '<path d="M2 2.5h5.6l6.4 6.4-5.1 5.1L2.5 7.6z"/><circle class="f" cx="5" cy="5" r="1"/>',
        'ban': '<circle cx="8" cy="8" r="6.2"/><path d="M3.8 3.8l8.4 8.4"/>',
        'inbox': '<path d="M2 9l2-5.5h8L14 9v4H2z"/><path d="M2 9h3.5l1 1.5h3L10.5 9H14"/>'
    };
    const ICON = n => '<svg class="pk-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + (SVGI[n] || '') + '</svg>';
    const STEP_CONTROLS =
        '<div class="viz-controls">' +
        '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Ulang</button>' +
        '<button type="button" class="viz-btn secondary" data-role="prev">' + ICON('backward-step') + ' Langkah sebelumnya</button>' +
        '<button type="button" class="viz-btn" data-role="next">Langkah berikutnya ' + ICON('forward-step') + '</button>' +
        '</div>';
    const optionList = (items, sel) => items.map(([v, t]) =>
        '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const chipList = (arr, fn, cls) => arr.length
        ? arr.map(x => '<span class="vz-chip' + (cls ? ' ' + cls : '') + '">' + fn(x) + '</span>').join('')
        : '<span class="vz-chip empty">(kosong)</span>';

    function bindSteps($, get, set, count) {
        $('reset').addEventListener('click', () => set(0));
        $('prev').addEventListener('click', () => { if (get() > 0) set(get() - 1); });
        $('next').addEventListener('click', () => { if (get() < count() - 1) set(get() + 1); });
    }

    /* ---------- Graf aturan (SVG statis; kelas diperbarui tiap langkah agar transisi CSS jalan) ---------- */
    function wrapLabel(text, max) {
        const words = text.split(' ');
        const lines = [];
        let cur = '';
        words.forEach(w => {
            if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
        });
        if (cur) lines.push(cur);
        return lines;
    }
    function graphHTML(kb, uid) {
        const W = kb.nw, H = 42, GR = 15;
        const gate = r => [kb.pos[r.then][0] - W / 2 - 44, kb.pos[r.then][1]];
        let s = '';
        kb.rules.forEach(r => {
            const [gx, gy] = gate(r);
            r.if.forEach((p, i) => {
                const [px, py] = kb.pos[p];
                const x1 = px + W / 2, x2 = gx - GR, dx = (x2 - x1) / 2;
                s += '<path id="' + uid + '-e-' + r.id + '-' + i + '" class="pk-edge" d="M' + x1 + ',' + py + ' C' + (x1 + dx) + ',' + py + ' ' + (x2 - dx) + ',' + gy + ' ' + x2 + ',' + gy + '"/>';
            });
            const c = kb.pos[r.then];
            s += '<path id="' + uid + '-e-' + r.id + '-o" class="pk-edge" d="M' + (gx + GR) + ',' + gy + ' L' + (c[0] - W / 2) + ',' + c[1] + '"/>';
        });
        kb.rules.forEach(r => {
            const [gx, gy] = gate(r);
            s += '<g id="' + uid + '-g-' + r.id + '" class="pk-gate"><circle cx="' + gx + '" cy="' + gy + '" r="' + GR + '"/>' +
                '<text x="' + gx + '" y="' + (gy + 4) + '">' + r.id + '</text>' +
                (r.if.length > 1 ? '<text class="pk-op" x="' + gx + '" y="' + (gy + GR + 12) + '">' + (r.mode === 'or' ? 'OR' : 'AND') + '</text>' : '') + '</g>';
        });
        Object.keys(kb.atoms).forEach(a => {
            const [cx, cy] = kb.pos[a];
            const lines = wrapLabel(kb.atoms[a].s, 17);
            const rx = kb.derived.includes(a) ? 20 : 7;
            s += '<g id="' + uid + '-n-' + a + '" class="pk-node ' + (kb.derived.includes(a) ? 'der' : 'base') + '">' +
                '<rect class="pk-ring" x="' + (cx - W / 2 - 4) + '" y="' + (cy - H / 2 - 4) + '" width="' + (W + 8) + '" height="' + (H + 8) + '" rx="' + (rx + 3) + '"/>' +
                '<rect x="' + (cx - W / 2) + '" y="' + (cy - H / 2) + '" width="' + W + '" height="' + H + '" rx="' + rx + '"/>' +
                lines.map((ln, i) => '<text x="' + cx + '" y="' + (cy + 4 - (lines.length - 1) * 7 + i * 14) + '">' + esc(ln) + '</text>').join('') + '</g>';
        });
        return '<svg viewBox="0 0 ' + kb.size[0] + ' ' + kb.size[1] + '" role="img" aria-label="Graf aturan: ' + esc(kb.title) + '">' + s + '</svg>';
    }

    function paintGraph(rootEl, kb, uid, vis, backward) {
        const q = id => rootEl.querySelector('#' + uid + '-' + id);
        Object.keys(kb.atoms).forEach(a => {
            const e = q('n-' + a);
            if (e) e.setAttribute('class', 'pk-node ' + (kb.derived.includes(a) ? 'der' : 'base') + (vis.nodes[a] ? ' st-' + vis.nodes[a] : '') + (vis.target === a ? ' tgt' : ''));
        });
        kb.rules.forEach(r => {
            const g = q('g-' + r.id);
            const gc = vis.gates[r.id] || '';
            if (g) g.setAttribute('class', 'pk-gate' + (gc ? ' ' + gc : ''));
            const ec = vis.edges[r.id] || gc;
            const ids = r.if.map((_, i) => 'e-' + r.id + '-' + i).concat(['e-' + r.id + '-o']);
            ids.forEach(id => {
                const e = q(id);
                if (e) e.setAttribute('class', 'pk-edge' + (ec ? ' ' + ec : '') + (backward && ec ? ' rev' : ''));
            });
        });
    }

    /* ---------- rule-chain ---------- */
    function initRuleChain(rootEl) {
        const kb = kbInit(KB[rootEl.dataset.kb || 'obligasi']);
        const fixed = (rootEl.dataset.mode === 'forward' || rootEl.dataset.mode === 'backward') ? rootEl.dataset.mode : null;
        let mode = fixed || (rootEl.dataset.start === 'backward' ? 'backward' : 'forward');
        let goal = rootEl.dataset.goal || kb.goal;
        const facts = Object.assign({}, kb.preset);
        const preset0 = Object.assign({}, kb.preset);
        let run = null, steps = [], idx = 0;
        const uid = 'pk' + (++UID);
        const goalOpts = kb.derived.filter(a => kb.atoms[a]).map(a => [a, L(kb, a)]);

        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="viz-toolbar">' +
            (fixed ? '<label>Arah: <b>' + (fixed === 'forward' ? 'forward chaining (maju)' : 'backward chaining (mundur)') + '</b></label>'
                : '<label>Arah penalaran <select data-role="mode">' + optionList([['forward', 'Forward chaining (maju): dari fakta'], ['backward', 'Backward chaining (mundur): dari tujuan']], mode) + '</select></label>') +
            '<label data-role="goal-wrap">Tujuan yang dibuktikan <select data-role="goal">' + optionList(goalOpts, goal) + '</select></label>' +
            '<button type="button" class="viz-btn secondary" data-role="preset">' + ICON('arrow-rotate-left') + ' Fakta awal contoh</button>' +
            '</div>' +
            '<div class="pk-facts"><span class="pk-facts-title">Fakta dasar (klik untuk mengganti):</span><span data-role="facts"></span></div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage pk-scroll"><div data-role="graph"></div><div class="viz-legend" data-role="legend"></div></div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="step"></span><span class="vz-tag" data-role="tag"></span></div>' +
            '<div class="pk-phase" data-role="phase"></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="pk-why" data-role="why" hidden></div>' +
            '<div class="viz-block"><h6 data-role="t1"></h6><div data-role="c1"></div></div>' +
            '<div class="viz-block"><h6 data-role="t2"></h6><div data-role="c2"></div></div>' +
            '<div class="viz-block"><h6 data-role="t3"></h6><div data-role="c3"></div></div>' +
            '<div class="viz-result ok" data-role="result" hidden></div>' +
            '</div></div>' + STEP_CONTROLS;
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        $('graph').innerHTML = graphHTML(kb, uid);

        const STATE_TXT = { known: 'ada di memori kerja', yes: 'ditanya → jawab ya', no: 'ditanya → jawab tidak' };
        const STATE_ICO = { known: 'circle-check', yes: 'circle-question', no: 'circle-question' };
        function renderFacts() {
            $('facts').innerHTML = kb.base.map(a => {
                const s = facts[a];
                const dim = mode === 'forward' && s !== 'known';
                return '<button type="button" class="pk-fact ' + s + (dim ? ' dim' : '') + '" data-a="' + a + '" title="' +
                    (dim ? 'Forward chaining tidak bertanya, jadi fakta ini dianggap tidak diketahui.' : 'Klik untuk mengganti keadaan fakta') + '">' +
                    ICON(STATE_ICO[s]) + ' ' + esc(L(kb, a)) + ' <small>' + STATE_TXT[s] + '</small></button>';
            }).join(' ');
            $('facts').querySelectorAll('.pk-fact').forEach(b => b.addEventListener('click', () => {
                const a = b.dataset.a, order = ['known', 'yes', 'no'];
                facts[a] = order[(order.indexOf(facts[a]) + 1) % 3];
                compute();
            }));
        }
        function legend() {
            $('legend').innerHTML = mode === 'forward'
                ? '<span><i class="vz-dot" style="background:#2e7d32"></i>Ada di memori kerja</span>' +
                  '<span><i class="vz-dot" style="background:#c8e6c9;box-shadow:inset 0 0 0 2px #1b5e20"></i>Baru ditambahkan</span>' +
                  '<span><i class="vz-dot" style="background:#f9a825"></i>Aturan terpenuhi (himpunan konflik)</span>' +
                  '<span><i class="vz-dot" style="background:#e65100"></i>Aturan terpilih</span>'
                : '<span><i class="vz-dot" style="background:#e65100"></i>Sedang dibuktikan</span>' +
                  '<span><i class="vz-dot" style="background:#f9a825"></i>Ditanyakan ke user</span>' +
                  '<span><i class="vz-dot" style="background:#2e7d32"></i>Terbukti</span>' +
                  '<span><i class="vz-dot" style="background:#c62828"></i>Gagal</span>' +
                  '<span><i class="vz-ring" style="border:2px dashed #6a1b9a"></i>Tujuan</span>';
        }
        function compute() {
            const known = kb.base.filter(a => facts[a] === 'known');
            if (mode === 'forward') run = forwardRun(kb, known);
            else run = backwardRun(kb, goal, facts);
            steps = run.steps;
            idx = 0;
            $('goal-wrap').hidden = mode !== 'backward';
            renderFacts();
            legend();
            render();
        }

        function visualForward(s) {
            const vis = { nodes: {}, gates: {}, edges: {}, target: null };
            s.wm.forEach(a => { vis.nodes[a] = 'have'; });
            if (s.kind === 'fire') vis.nodes[s.added] = 'new';
            s.fired.forEach(id => { vis.gates[id] = 'done'; });
            if (s.kind === 'match') {
                s.conflict.forEach(id => { vis.gates[id] = 'cand'; });
                vis.gates[s.pick] = 'pick';
            } else if (s.kind === 'fire') {
                vis.gates[s.pick] = 'fire';
            }
            return vis;
        }
        function visualBackward(s) {
            const vis = { nodes: {}, gates: {}, edges: {}, target: goal };
            s.known.forEach(a => { vis.nodes[a] = 'have'; });
            s.proved.forEach(a => { vis.nodes[a] = 'ok'; });
            s.failed.forEach(a => { vis.nodes[a] = 'bad'; });
            s.stack.forEach(a => { vis.nodes[a] = 'path'; });
            if (s.cur) {
                vis.nodes[s.cur] = (s.kind === 'ask') ? 'ask'
                    : (s.kind === 'answer' || s.kind === 'known' || s.kind === 'proved') ? (s.proved.includes(s.cur) || s.known.includes(s.cur) ? 'ok' : 'bad')
                        : (s.kind === 'failed' || s.kind === 'cached') ? 'bad' : 'cur';
            }
            s.ruleStack.forEach(id => { vis.gates[id] = 'pick'; });
            s.badRules.forEach(id => { vis.gates[id] = 'bad'; });
            s.okRules.forEach(id => { vis.gates[id] = 'fire'; });
            return vis;
        }

        function phaseHTML(s) {
            if (mode !== 'forward') return '';
            const on = { start: [], match: [0, 1], fire: [2, 3], stop: [0] }[s.kind] || [];
            const names = ['1 Cocokkan', '2 Himpunan konflik', '3 Eksekusi', '4 Perbarui'];
            return names.map((n, i) => '<span class="' + (on.includes(i) ? (s.kind === 'stop' ? 'stop' : 'on') : '') + '">' + n + '</span>').join('') +
                (s.kind === 'stop' ? '<span class="stop">Berhenti</span>' : '');
        }

        function render() {
            const s = steps[idx], last = idx === steps.length - 1;
            const vis = mode === 'forward' ? visualForward(s) : visualBackward(s);
            paintGraph(rootEl, kb, uid, vis, mode === 'backward');
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            $('tag').textContent = mode === 'forward' ? 'Forward chaining · siklus ' + (s.cycle || 0) : 'Backward chaining';
            $('phase').innerHTML = phaseHTML(s);
            $('phase').hidden = mode !== 'forward';
            const msg = $('msg');
            msg.className = 'viz-msg' + (s.kind === 'stop' || s.kind === 'done-ok' ? ' goal' : s.kind === 'done-fail' ? ' fail' : '');
            msg.innerHTML = s.msg;
            const why = $('why');
            why.hidden = s.kind !== 'ask';
            if (s.kind === 'ask') why.innerHTML = '<h6>' + ICON('circle-question') + ' Mengapa sistem bertanya ini?</h6><ul>' + s.why.map(x => '<li>' + x + '</li>').join('') + '</ul>';

            if (mode === 'forward') {
                const initial = run.initial;
                $('t1').textContent = 'Memori kerja';
                $('c1').innerHTML = '<div class="viz-chips">' + chipList(s.wm, a => esc(L(kb, a)), '') + '</div>';
                $('c1').querySelectorAll('.vz-chip').forEach((c, i) => {
                    const a = s.wm[i];
                    if (a === s.added) c.style.background = '#2e7d32';
                    else if (initial.includes(a)) c.style.background = '#546e7a';
                });
                $('t2').textContent = 'Himpunan konflik (aturan yang terpenuhi)';
                $('c2').innerHTML = '<div class="viz-chips">' + chipList(s.conflict, id => id + (id === s.pick ? ' ' + ICON('check') : ''), 'frontier') + '</div>';
                $('t3').textContent = 'Aturan yang sudah dijalankan (berurutan)';
                $('c3').innerHTML = '<div class="viz-chips">' + chipList(s.fired, id => id, '') + '</div>';
            } else {
                $('t1').textContent = 'Goal stack (paling bawah = sedang diuji)';
                $('c1').innerHTML = s.stack.length
                    ? '<div class="pk-stack">' + s.stack.map((a, i) => '<div class="' + (i === s.stack.length - 1 ? 'top' : '') + '">' + (i ? '↳ ' : '') + esc(L(kb, a)) + '</div>').join('') + '</div>'
                    : '<span class="vz-chip empty">(kosong)</span>';
                $('t2').textContent = 'Sudah terbukti';
                $('c2').innerHTML = '<div class="viz-chips">' + chipList(s.proved.concat(s.known.filter(a => !s.proved.includes(a))), a => esc(L(kb, a)), '') + '</div>';
                $('c2').querySelectorAll('.vz-chip').forEach(c => { c.style.background = '#2e7d32'; });
                $('t3').textContent = 'Pertanyaan kepada user (' + s.asked.length + ')';
                $('c3').innerHTML = s.asked.length
                    ? '<div class="pk-qa">' + s.asked.map((x, i) => '<div>' + (i + 1) + '. ' + esc(L(kb, x.fact)) + '? <span class="' + (x.ans ? 'y' : 'n') + '">' + (x.ans ? 'ya' : 'tidak') + '</span></div>').join('') + '</div>'
                    : '<span class="vz-chip empty">(belum ada)</span>';
            }

            const res = $('result');
            res.hidden = !last;
            if (last) {
                if (mode === 'forward') {
                    const derived = run.wm.filter(a => !run.initial.includes(a));
                    const finals = run.finals.filter(a => derived.includes(a));
                    res.className = 'viz-result ' + (finals.length ? 'ok' : 'warn');
                    res.innerHTML = ICON(finals.length ? 'circle-check' : 'triangle-exclamation') + '<span>' +
                        (finals.length
                            ? '<b>Kesimpulan:</b> ' + finals.map(a => esc(L(kb, a))).join('; ') + '.<br><b>Bagaimana?</b>' + finals.map(a => howHTML(kb, howLines(kb, a, run.how))).join('')
                            : 'Tidak ada kesimpulan akhir yang dapat diturunkan dari fakta yang ada.') +
                        '<br><small>Sistem tidak bertanya apa pun; fakta harus lengkap sejak awal.</small></span>';
                } else {
                    res.className = 'viz-result ' + (run.ok ? 'ok' : 'bad');
                    res.innerHTML = ICON(run.ok ? 'circle-check' : 'circle-xmark') + '<span>' +
                        (run.ok ? '<b>Bagaimana ' + esc(L(kb, goal)) + ' terbukti?</b>' + howHTML(kb, howLines(kb, goal, run.how))
                            : '<b>' + esc(L(kb, goal)) + ' tidak terbukti.</b> Sistem berhenti tanpa menguji aturan yang tidak berhubungan dengan tujuan.') +
                        '<small>Jumlah pertanyaan ke user: <b>' + run.asked.length + '</b> dari ' + kb.base.length + ' fakta dasar.</small></span>';
                }
            }
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
        }

        if (!fixed) $('mode').addEventListener('change', e => { mode = e.target.value; compute(); });
        $('goal').addEventListener('change', e => { goal = e.target.value; compute(); });
        $('preset').addEventListener('click', () => { Object.assign(facts, preset0); compute(); });
        bindSteps($, () => idx, i => { idx = i; render(); }, () => steps.length);
        compute();
    }

    /* ---------- rule-lab (cuaca) ---------- */
    function initRuleLab(rootEl) {
        const V = [['m', 'Musim dingin'], ['s', 'Suhu di bawah 0 °C'], ['b', 'Berangin']];
        const RULES = [
            { id: 'A', title: 'Hanya AND', f: (m, s, b) => m && s && b, html: ['m', ' AND ', 's', ' AND ', 'b'] },
            { id: 'B', title: 'Hanya OR', f: (m, s, b) => m || s || b, html: ['m', ' OR ', 's', ' OR ', 'b'] },
            { id: 'C', title: 'Gabungan, tanpa tanda kurung (AND dahulu)', f: (m, s, b) => (m && s) || b, html: ['(', 'm', ' AND ', 's', ')', ' OR ', 'b'], shown: ['m', ' AND ', 's', ' OR ', 'b'] },
            { id: 'D', title: 'Gabungan, dengan tanda kurung lain', f: (m, s, b) => m && (s || b), html: ['m', ' AND ', '(', 's', ' OR ', 'b', ')'] }
        ];
        const val = { m: true, s: true, b: false };
        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="pk-switches">' + V.map(([k, t]) =>
                '<label class="pk-switch"><input type="checkbox" data-k="' + k + '"' + (val[k] ? ' checked' : '') + '><span class="pk-slider"></span>' + t + '</label>').join('') + '</div>' +
            '<div class="pk-rules" data-role="rules"></div>' +
            '<div class="viz-block"><h6>Tabel kebenaran: semua kombinasi (baris yang sedang dipilih berwarna)</h6>' +
            '<div class="vz-table-wrap"><table class="pk-truth" data-role="truth"></table></div></div>';
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        const name = { m: 'musim dingin', s: 'suhu < 0', b: 'berangin' };
        function render() {
            const { m, s, b } = val;
            $('rules').innerHTML = RULES.map(r => {
                const on = r.f(m, s, b);
                const parts = r.html.map(p => (p.length === 1 && 'msb'.includes(p))
                    ? '<span class="' + (val[p] ? 't' : 'x') + '">' + name[p] + (val[p] ? ' ' + ICON('check') : ' ' + ICON('xmark')) + '</span>' : p).join('');
                return '<div class="pk-rule' + (on ? ' on' : '') + '"><h5>' + r.id + '. ' + r.title + '</h5><div class="f">IF ' + parts + '<br>THEN cuaca dingin</div>' +
                    '<div class="pk-lamp"><i></i>' + (on ? 'Terpenuhi → cuaca dingin' : 'Tidak terpenuhi') + '</div></div>';
            }).join('');
            const T = x => '<td class="' + (x ? 't' : 'f') + '">' + (x ? 'benar' : 'salah') + '</td>';
            let rows = '';
            [true, false].forEach(mm => [true, false].forEach(ss => [true, false].forEach(bb => {
                const cur = mm === m && ss === s && bb === b;
                rows += '<tr' + (cur ? ' class="cur"' : '') + '>' + T(mm) + T(ss) + T(bb) + RULES.map(r => T(r.f(mm, ss, bb))).join('') + '</tr>';
            })));
            $('truth').innerHTML = '<thead><tr><th>Musim dingin</th><th>Suhu &lt; 0</th><th>Berangin</th><th>A (AND)</th><th>B (OR)</th><th>C</th><th>D</th></tr></thead><tbody>' + rows + '</tbody>';
        }
        rootEl.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => { val[inp.dataset.k] = inp.checked; render(); }));
        render();
    }

    /* ---------- es-arch ---------- */
    const ARCH = [
        { key: 'kb', n: 1, t: 'Basis pengetahuan (knowledge base)', x: 215, y: 52, w: 170, h: 58,
          peran: 'Menyimpan pengetahuan bidangnya dalam bentuk aturan IF-THEN. Isinya berasal dari pakar, bukan dari programmer.',
          analogi: 'Buku pedoman dokter puskesmas.', contoh: 'Tujuh aturan R1–R7 tentang kelistrikan, bensin, dan busi pada sepeda motor.' },
        { key: 'db', n: 2, t: 'Database (memori kerja)', x: 425, y: 52, w: 170, h: 58,
          peran: 'Menyimpan fakta tentang kasus yang sedang ditangani, yaitu yang dicocokkan dengan bagian IF aturan. Berubah di setiap konsultasi.',
          analogi: 'Rekam medis pasien yang sedang diperiksa.', contoh: 'Jawaban pemilik motor: “mesin berputar = ya”, “busi memercik = ya”, dan fakta turunan yang ditambahkan sistem.' },
        { key: 'me', n: 3, t: 'Mesin inferensi (inference engine)', x: 310, y: 168, w: 200, h: 62,
          peran: 'Memproses: mencocokkan fakta dengan aturan, memilih aturan, menambah fakta baru, dan bertanya bila perlu. Tidak tahu apa pun tentang bidangnya.',
          analogi: 'Cara dokter menalar: dari gejala ke dugaan penyakit.', contoh: 'Program sekitar 40 baris yang sama dapat dipakai untuk motor, obligasi, atau padi; hanya basis aturannya yang diganti.' },
        { key: 'ak', n: 4, t: 'Akuisisi pengetahuan', x: 15, y: 150, w: 150, h: 58, side: true,
          peran: 'Jalur memasukkan dan memperbarui aturan. Dikerjakan knowledge engineer bersama pakar.',
          analogi: 'Pelatihan dan pendidikan lanjutan dokter.', contoh: 'Wawancara montir senior, menulis R1–R7, lalu pakar memeriksa dan mengoreksinya.' },
        { key: 'pj', n: 5, t: 'Fasilitas penjelasan', x: 215, y: 300, w: 170, h: 58,
          peran: 'Menjawab “Mengapa pertanyaan ini diajukan?” dan “Bagaimana kesimpulan ini diperoleh?” dengan membacakan catatan aturan yang dipakai.',
          analogi: 'Dokter yang menerangkan alasan diagnosisnya.', contoh: 'Tombol Mengapa? dan Bagaimana? pada konsultasi motor di bagian ini.' },
        { key: 'ui', n: 6, t: 'Antarmuka pengguna', x: 425, y: 300, w: 170, h: 58,
          peran: 'Tempat user bertanya, menjawab, dan membaca hasil: command line, formulir web, atau menu.',
          analogi: 'Loket dan ruang periksa.', contoh: 'Pertanyaan ya / tidak / tidak tahu pada halaman web atau terminal.' }
    ];
    function initArch(rootEl) {
        let idx = 0;   // 0 = gambaran, 1..6 = komponen
        const uid = 'pk' + (++UID);
        rootEl.classList.add('viz', 'pk');
        const comp = c => '<g class="comp' + (c.side ? ' side' : '') + '" data-k="' + c.key + '" tabindex="0" role="button" aria-label="' + esc(c.t) + '">' +
            '<rect class="box" x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" rx="10"/>' +
            '<text class="num" x="' + (c.x + c.w / 2) + '" y="' + (c.y + 19) + '">KOMPONEN ' + c.n + '</text>' +
            wrapLabel(c.t, 25).map((ln, i) => '<text class="lbl" x="' + (c.x + c.w / 2) + '" y="' + (c.y + 36 + i * 14) + '">' + esc(ln) + '</text>').join('') + '</g>';
        const actor = (x, y, w, t) => '<g><rect class="box" style="cursor:default;fill:#eceff1" x="' + x + '" y="' + y + '" width="' + w + '" height="52" rx="26"/>' +
            '<text class="lbl" x="' + (x + w / 2) + '" y="' + (y + 31) + '">' + t + '</text></g>';
        const flow = (d, keys) => '<path class="flow" data-f="' + keys + '" d="' + d + '"/>';
        const svg = '<svg viewBox="0 0 770 400" role="img" aria-label="Arsitektur sistem pakar">' +
            '<rect class="zone" x="190" y="18" width="430" height="360" rx="16"/><text class="zone-t" x="405" y="14">SISTEM PAKAR</text>' +
            actor(20, 40, 140, 'Pakar') + actor(650, 300, 100, 'User') +
            flow('M90,92 L90,148', 'ak') +
            flow('M165,180 C188,180 192,100 215,84', 'ak,kb') +
            flow('M300,110 L380,166', 'kb,me') +
            flow('M510,110 L440,166', 'db,me') +
            flow('M410,230 L330,298', 'me,pj') +
            flow('M440,230 L500,298', 'me,ui') +
            flow('M385,330 L423,330', 'pj,ui') +
            flow('M595,330 L648,330', 'ui') +
            ARCH.map(comp).join('') + '</svg>';
        rootEl.innerHTML = '<div class="viz-body"><div class="viz-stage pk-scroll pk-arch"><div>' + svg + '</div></div>' +
            '<div class="viz-panel"><div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-msg" data-role="msg" style="min-height:11em" aria-live="polite"></div></div></div>' + STEP_CONTROLS;
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        function render() {
            const c = idx ? ARCH[idx - 1] : null;
            rootEl.querySelectorAll('.comp').forEach(g => g.classList.toggle('on', !!c && g.dataset.k === c.key));
            rootEl.querySelectorAll('.flow').forEach(f => f.classList.toggle('hot', !!c && f.dataset.f.split(',').includes(c.key)));
            $('step').textContent = idx ? 'Komponen ' + idx + ' dari 6' : 'Gambaran: satu konsultasi';
            $('msg').innerHTML = c
                ? '<b>' + c.n + '. ' + esc(c.t) + '</b><br>' + c.peran +
                  '<br><br><b>Analogi:</b> ' + c.analogi +
                  '<br><b>Pada sistem motor:</b> ' + c.contoh
                : 'Satu konsultasi berjalan begini: <b>user</b> menjawab lewat <b>antarmuka</b> → jawabannya disimpan sebagai fakta di <b>memori kerja</b> → <b>mesin inferensi</b> mencocokkannya dengan <b>aturan</b> di basis pengetahuan → hasilnya kembali ke user bersama <b>penjelasan</b>. ' +
                  'Di sisi lain, <b>pakar</b> mengisi aturan lewat <b>akuisisi pengetahuan</b>. Klik komponen atau tekan “Langkah berikutnya”.';
            $('prev').disabled = idx === 0;
            $('next').disabled = idx === 6;
        }
        rootEl.querySelectorAll('.comp').forEach(g => {
            const go = () => { idx = ARCH.findIndex(c => c.key === g.dataset.k) + 1; render(); };
            g.addEventListener('click', go);
            g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        });
        bindSteps($, () => idx, i => { idx = i; render(); }, () => 7);
        render();
    }

    /* ---------- es-consult ---------- */
    function initConsult(rootEl) {
        const kb = kbInit(KB[rootEl.dataset.kb || 'buah']);
        const uid = 'pk' + (++UID);
        let session, ev, asked;
        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="pk-consult-body">' +
            '<div><div class="pk-chat" data-role="chat" aria-live="polite"></div>' +
            '<div class="pk-ans" data-role="ans"></div></div>' +
            '<div class="pk-side">' +
            '<h6>Dugaan yang diuji (urut)</h6><div data-role="goals"></div>' +
            '<h6>Basis aturan</h6><div data-role="rules"></div>' +
            '<h6>Hitungan</h6><div class="pk-count" data-role="count"></div>' +
            '</div></div>';
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        const bubble = (cls, html) => {
            const d = rootEl.ownerDocument.createElement('div');
            d.className = 'pk-b ' + cls;
            d.innerHTML = html;
            $('chat').appendChild(d);
            $('chat').scrollTop = $('chat').scrollHeight;
        };
        function buttons(list) {
            $('ans').innerHTML = list.map(([k, label, icon, cls]) =>
                '<button type="button" class="viz-btn' + (cls ? ' ' + cls : '') + '" data-k="' + k + '">' + (icon ? ICON(icon) + ' ' : '') + label + '</button>').join('');
            $('ans').querySelectorAll('button').forEach(b => b.addEventListener('click', () => act(b.dataset.k)));
        }
        function side() {
            const c = session.ctx;
            $('goals').innerHTML = kb.goals.map(g => {
                const ok = c.found.includes(g), bad = c.failed.has(g) && !ok;
                const now = c.current === g && !c.done && !ok && !bad;
                return '<div class="pk-goal ' + (ok ? 'ok' : bad ? 'bad' : now ? 'now' : '') + '"><b>' + esc(L(kb, g)) + '</b><small>' +
                    (ok ? 'terbukti' : bad ? 'gagal' : now ? 'sedang diuji' : 'menunggu') + '</small></div>';
            }).join('');
            $('rules').innerHTML = kb.rules.map(r => {
                const cls = c.ruleStack.includes(r.id) ? 'try' : c.okRules.has(r.id) ? 'ok' : c.badRules.has(r.id) ? 'bad' : '';
                return '<div class="pk-rl ' + cls + '"><b>' + r.id + '</b> ' + ruleHTML(kb, r) + '</div>';
            }).join('');
            $('count').innerHTML = '<div><b>' + c.asked.length + '</b>pertanyaan diajukan</div>' +
                '<div><b>' + kb.base.length + '</b>fakta dasar seluruhnya</div>' +
                '<div><b>' + c.found.length + '</b>dugaan terbukti</div>';
        }
        function step(ans) {
            ev = session.next(ans);
            side();
            if (ev.type === 'ask') {
                bubble('sp', '<b>SP:</b> ' + esc(Q(kb, ev.fact)));
                buttons([['ya', 'Ya', 'check'], ['tidak', 'Tidak', 'xmark', 'secondary'], ['tahu', 'Tidak tahu', 'circle-question', 'secondary'], ['why', 'Mengapa?', 'circle-question', 'secondary']]);
            } else if (ev.type === 'found') {
                const lines = howLines(kb, ev.goal, session.ctx.how);
                bubble('win', ICON('circle-check') + ' Menurut pengetahuan yang saya miliki: <b>' + esc(L(kb, ev.goal)) + '</b>.');
                bubble('sys', '<b>Bagaimana?</b>' + howHTML(kb, lines));
                const more = kb.goals.indexOf(ev.goal) < kb.goals.length - 1;
                buttons((more ? [['more', 'Cari dugaan lain', 'magnifying-glass']] : []).concat([['restart', 'Mulai ulang', 'rotate-left', 'secondary']]));
            } else {
                const n = session.ctx.found.length;
                bubble(n ? 'sys' : 'lose', n
                    ? 'Semua dugaan sudah diuji. Total dugaan terbukti: <b>' + n + '</b>.'
                    : ICON('circle-xmark') + ' Tidak ada dugaan yang dapat dibuktikan dari jawaban Anda. Pengetahuan saya terbatas pada aturan di atas.');
                bubble('sys', 'Selama konsultasi sistem mengajukan <b>' + session.ctx.asked.length + '</b> pertanyaan. Forward chaining akan membutuhkan semua <b>' + kb.base.length + '</b> fakta dasar sejak awal.');
                buttons([['restart', 'Mulai ulang', 'rotate-left']]);
            }
        }
        function act(k) {
            if (k === 'restart') return start();
            if (k === 'more') { bubble('us', 'Cari dugaan lain.'); return step(); }
            if (k === 'why') {
                bubble('sys', '<h6 class="pk-why-h" style="margin:0 0 4px"><b>Mengapa pertanyaan ini diajukan?</b></h6><ul class="pk-how" style="list-style:disc">' +
                    whyLines(kb, ev.chain).map(x => '<li>' + x + '</li>').join('') + '</ul>');
                return;
            }
            const word = { ya: 'Ya', tidak: 'Tidak', tahu: 'Tidak tahu' }[k];
            bubble('us', 'U: ' + word);
            if (k === 'tahu') bubble('sys', 'Jawaban “tidak tahu” membuat fakta ini tidak dapat dibuktikan, sehingga aturan yang membutuhkannya tidak terpenuhi.');
            step(k);
        }
        function start() {
            session = makeConsult(kb);
            $('chat').innerHTML = '';
            bubble('sys', 'Selamat datang. Jawab pertanyaan sistem dengan <b>Ya</b>, <b>Tidak</b>, atau <b>Tidak tahu</b>. Tekan <b>Mengapa?</b> bila ingin tahu alasan sebuah pertanyaan.');
            step();
        }
        start();
    }

    /* ---------- infer-table ---------- */
    function initInferTable(rootEl) {
        const which = rootEl.dataset.kb || 'lamaran';
        let idx = 0, steps = [];
        let gender = 'wanita', age = 27, fact = 'dolar turun';
        rootEl.classList.add('viz', 'pk');
        const uid = 'pk' + (++UID);
        const toolbar = which === 'lamaran'
            ? '<label>Jenis kelamin <select data-role="gender">' + optionList([['pria', 'pria'], ['wanita', 'wanita']], gender) + '</select></label>' +
              '<label>Usia <input type="number" min="15" max="70" value="' + age + '" data-role="age"> tahun</label>'
            : '<label>Fakta awal <select data-role="fact">' + optionList([['dolar turun', 'dolar turun'], ['dolar naik', 'dolar naik'], ['suku bunga tidak berubah', 'suku bunga tidak berubah']], fact) + '</select></label>';
        rootEl.innerHTML = '<div class="viz-toolbar">' + toolbar + '</div>' +
            '<div class="viz-body"><div class="viz-stage pk-scroll"><div data-role="stage"></div></div>' +
            '<div class="viz-panel"><div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div data-role="var"></div>' +
            '<div class="vz-table-wrap" data-role="table"></div>' +
            '<div class="viz-result ok" data-role="result" hidden></div></div></div>' + STEP_CONTROLS;
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        const TN = { Start: [220, 30], R1: [110, 110], R2: [330, 110], C1: [150, 205], C2: [290, 205] };
        function stageHTML() {
            if (which === 'lamaran') {
                const edges = [['Start', 'R1', 'pria'], ['Start', 'R2', 'wanita'], ['R1', 'C1', 'ya'], ['R1', 'C2', 'tidak'], ['R2', 'C1', 'ya'], ['R2', 'C2', 'tidak']];
                const code = '<div class="pk-code">' + PSEUDO_LAMARAN.map((t, i) => '<div data-ln="' + i + '"><span class="ln">' + (i + 1) + '</span>' + esc(t) + '</div>').join('') + '</div>';
                const svg = '<svg class="pk-tree" viewBox="0 0 440 250" role="img" aria-label="Pohon keputusan lamaran pekerjaan">' +
                    edges.map(([a, b, t], i) => {
                        const [x1, y1] = TN[a], [x2, y2] = TN[b];
                        return '<line class="te" data-e="' + a + '-' + b + '" x1="' + x1 + '" y1="' + (y1 + 16) + '" x2="' + x2 + '" y2="' + (y2 - 16) + '"/>' +
                            '<text class="tl" x="' + ((x1 + x2) / 2 + (x2 < x1 ? -12 : 12)) + '" y="' + ((y1 + y2) / 2 + 4) + '">' + t + '</text>';
                    }).join('') +
                    Object.keys(TN).map(k => {
                        const [x, y] = TN[k];
                        const t = TABEL_LAMARAN.find(r => r.id === k);
                        const lbl = k === 'Start' ? 'Start: jenis kelamin?' : k === 'R1' ? 'R1: usia < 35?' : k === 'R2' ? 'R2: usia < 30?' : k === 'C1' ? 'C1 Diterima' : 'C2 Ditolak';
                        return '<g class="tn' + (t.end ? ' end' : '') + '" data-n="' + k + '"><rect x="' + (x - 62) + '" y="' + (y - 16) + '" width="124" height="32" rx="' + (t.end ? 16 : 6) + '"/><text x="' + x + '" y="' + (y + 4) + '">' + lbl + '</text></g>';
                    }).join('') + '</svg>';
                return code + svg;
            }
            return '<div data-role="chain" style="padding:10px"></div>';
        }
        function compute() {
            steps = which === 'lamaran' ? lamaranSteps(gender, age) : obligasiSteps(fact);
            idx = 0;
            render();
        }
        function tableHTML(curId, path) {
            if (which === 'lamaran') {
                return '<table class="pk-itab"><thead><tr><th>Aturan</th><th>Pernyataan</th><th>Pilihan 1</th><th>Pilihan 2</th><th>Kesimpulan?</th></tr></thead><tbody>' +
                    TABEL_LAMARAN.map(r => '<tr class="' + (r.id === curId ? 'cur' : path.includes(r.id) ? 'past' : '') + '"><td>' + r.id + '</td><td>' + r.text + '</td><td>' +
                        (r.end ? '-' : r.p1 + ' <small>(' + r.t1 + ')</small>') + '</td><td>' + (r.end ? '-' : r.p2 + ' <small>(' + r.t2 + ')</small>') + '</td><td>' + (r.end ? 'Ya' : 'Tidak') + '</td></tr>').join('') +
                    '</tbody></table>';
            }
            return '<table class="pk-itab"><thead><tr><th>Aturan</th><th>Kondisi</th><th>Akibat</th><th>Aturan berikutnya</th></tr></thead><tbody>' +
                TABEL_OBLIGASI.map(r => '<tr class="' + (r.id === curId ? 'cur' : path.includes(r.id) ? 'past' : '') + '"><td>' + r.id + '</td><td>' + (r.cond || '-') + '</td><td>' + r.eff + '</td><td>' + r.next + '</td></tr>').join('') +
                '</tbody></table>';
        }
        function render() {
            const s = steps[idx], last = idx === steps.length - 1;
            if (!$('stage').firstChild) $('stage').innerHTML = stageHTML();
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            $('msg').className = 'viz-msg' + (s.final ? ' goal' : '');
            $('msg').innerHTML = s.msg;
            const cur = s.cur;
            $('var').innerHTML = which === 'lamaran'
                ? '<span class="pk-var">Aturan_dipakai = ' + cur + '</span>'
                : '<span class="pk-var">Baris dipakai = ' + (cur || '(belum ada)') + '</span>';
            $('table').innerHTML = tableHTML(cur, s.path.filter(p => p !== cur));
            if (which === 'lamaran') {
                rootEl.querySelectorAll('.pk-code div').forEach(d => d.classList.toggle('on', +d.dataset.ln === s.line));
                rootEl.querySelectorAll('.tn').forEach(g => {
                    g.classList.toggle('cur', g.dataset.n === cur);
                    g.classList.toggle('past', s.path.includes(g.dataset.n) && g.dataset.n !== cur);
                });
                rootEl.querySelectorAll('.te').forEach(e => {
                    const [a, b] = e.dataset.e.split('-');
                    const ia = s.path.indexOf(a);
                    e.classList.toggle('on', ia >= 0 && s.path[ia + 1] === b);
                });
            } else {
                $('chain') && ($('chain').innerHTML = s.path.length
                    ? s.path.map((p, i) => '<span class="vz-chip' + (i === s.path.length - 1 ? '' : ' frontier') + '">' + p + '</span>').join(' → ')
                    : '<span class="vz-chip empty">(belum ada baris)</span>');
            }
            const res = $('result');
            res.hidden = !last;
            if (last) {
                const out = which === 'lamaran'
                    ? TABEL_LAMARAN.find(r => r.id === s.cur).text
                    : TABEL_OBLIGASI.find(r => r.id === s.cur).eff;
                res.innerHTML = ICON('circle-check') + '<span>Hasil: <b>' + out + '</b>. Program penjelajahnya tidak memuat aturan apa pun; semua aturan ada pada tabel.</span>';
            }
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
        }
        const sel = rootEl.querySelector('[data-role="gender"]');
        if (sel) sel.addEventListener('change', e => { gender = e.target.value; compute(); });
        const ageEl = rootEl.querySelector('[data-role="age"]');
        if (ageEl) ageEl.addEventListener('input', e => { const v = parseInt(e.target.value, 10); if (v > 0) { age = v; compute(); } });
        const factEl = rootEl.querySelector('[data-role="fact"]');
        if (factEl) factEl.addEventListener('change', e => { fact = e.target.value; compute(); });
        bindSteps($, () => idx, i => { idx = i; render(); }, () => steps.length);
        compute();
    }

    /* ---------- conflict-lab ---------- */
    function initConflict(rootEl) {
        const val = { member: true, besar: true, gajian: true };
        let strategi = 'urutan';
        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="pk-switches">' + Object.keys(DISKON_LBL).map(k =>
                '<label class="pk-switch"><input type="checkbox" data-k="' + k + '" checked><span class="pk-slider"></span>' + DISKON_LBL[k] + '</label>').join('') + '</div>' +
            '<div class="viz-toolbar"><label>Strategi memilih aturan <select data-role="strat">' + optionList([
                ['urutan', 'Aturan pertama yang cocok (urutan di basis aturan)'],
                ['spesifik', 'Paling spesifik (syarat terbanyak)'],
                ['prioritas', 'Prioritas tertinggi'],
                ['terbesar', 'Diskon terbesar']], strategi) + '</select></label></div>' +
            '<div class="vz-table-wrap" data-role="tab"></div>' +
            '<div class="viz-block" style="margin-top:10px"><h6>Himpunan konflik</h6><div class="viz-chips" data-role="cs"></div></div>' +
            '<div class="pk-verdict" data-role="out"></div>';
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        function render() {
            const matched = DISKON.filter(r => r.if.every(c => val[c]));
            const pick = pilihKonflik(strategi, matched);
            $('tab').innerHTML = '<table class="pk-rtab"><thead><tr><th>Aturan</th><th>IF</th><th>THEN diskon</th><th>Prioritas</th><th>Cocok?</th></tr></thead><tbody>' +
                DISKON.map(r => {
                    const m = matched.includes(r);
                    return '<tr class="' + (r === pick ? 'pick' : m ? 'match' : 'nomatch') + '"><td><b>' + r.id + '</b></td><td>' +
                        r.if.map(c => DISKON_LBL[c]).join(' <b>AND</b> ') + '</td><td>' + r.diskon + '%</td><td>' + r.prio + '</td><td>' +
                        (r === pick ? ICON('check') + ' dieksekusi' : m ? 'ya' : 'tidak') + '</td></tr>';
                }).join('') + '</tbody></table>';
            $('cs').innerHTML = chipList(matched, r => r.id + (r === pick ? ' ' + ICON('check') : ''), 'frontier');
            const out = $('out');
            out.className = 'pk-verdict ' + (pick ? 'ok' : 'bad');
            out.innerHTML = pick
                ? ICON('tag') + ' Diskon yang diberikan: <b>' + pick.diskon + '%</b> (aturan ' + pick.id + '). ' + (matched.length > 1
                    ? 'Ada ' + matched.length + ' aturan yang cocok, tetapi hanya satu yang dieksekusi. Ganti strategi untuk melihat hasil yang berbeda.'
                    : 'Hanya satu aturan yang cocok, jadi tidak perlu <em>conflict resolution</em>.')
                : ICON('circle-info') + ' Tidak ada aturan yang cocok, sehingga tidak ada diskon.';
        }
        rootEl.querySelectorAll('input[data-k]').forEach(i => i.addEventListener('change', () => { val[i.dataset.k] = i.checked; render(); }));
        rootEl.querySelector('[data-role="strat"]').addEventListener('change', e => { strategi = e.target.value; render(); });
        render();
    }

    /* ---------- skor-lab ---------- */
    function initSkor(rootEl) {
        const on = {};
        SPAM.forEach(t => { on[t.id] = false; });
        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="pk-switches" style="flex-direction:column;gap:8px">' + SPAM.map(t =>
                '<label class="pk-switch"><input type="checkbox" data-k="' + t.id + '"><span class="pk-slider"></span>' + t.text +
                ' <small style="color:' + (t.pts < 0 ? '#2e7d32' : '#c62828') + ';font-weight:700">(' + (t.pts > 0 ? '+' : '') + t.pts.toFixed(1) + ')</small></label>').join('') + '</div>' +
            '<div class="viz-block"><h6>Skor total terhadap ambang <span data-role="th"></span></h6><div class="pk-meter" data-role="meter"><i></i><u></u></div><div data-role="num"></div></div>' +
            '<div class="pk-verdict" data-role="out"></div>';
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        $('th').textContent = SPAM_BATAS.toFixed(1);
        const MAXP = 8;      // skala meter: 0 .. 8
        function render() {
            const total = SPAM.reduce((s, t) => s + (on[t.id] ? t.pts : 0), 0);
            const fill = rootEl.querySelector('.pk-meter i'), line = rootEl.querySelector('.pk-meter u');
            fill.style.width = Math.max(0, Math.min(100, total / MAXP * 100)) + '%';
            fill.className = total >= SPAM_BATAS ? 'hot' : '';
            line.style.left = (SPAM_BATAS / MAXP * 100) + '%';
            const fired = SPAM.filter(t => on[t.id]);
            $('num').innerHTML = 'Total: <b>' + total.toFixed(1) + '</b>' + (fired.length ? ' = ' + fired.map(t => (t.pts > 0 ? '+' : '−') + Math.abs(t.pts).toFixed(1)).join(' ').replace(/^\+/, '') : '');
            const out = $('out');
            const spam = total >= SPAM_BATAS;
            out.className = 'pk-verdict ' + (spam ? 'bad' : 'ok');
            out.innerHTML = spam
                ? ICON('ban') + ' Skor ' + total.toFixed(1) + ' ≥ ' + SPAM_BATAS.toFixed(1) + ': pesan ditandai <b>SPAM</b> (masuk folder spam, bukan dihapus).'
                : ICON('inbox') + ' Skor ' + total.toFixed(1) + ' &lt; ' + SPAM_BATAS.toFixed(1) + ': pesan <b>diteruskan ke inbox</b>.';
        }
        rootEl.querySelectorAll('input[data-k]').forEach(i => i.addEventListener('change', () => { on[i.dataset.k] = i.checked; render(); }));
        render();
    }

    /* ---------- tiga aplikasi web nyata ---------- */
    const f2 = x => x.toFixed(2).replace('.', ',');
    const fN = x => String(Math.round(x * 100) / 100).replace('.', ',');
    const p1 = x => (x * 100).toFixed(1).replace('.', ',') + '%';
    const p2 = x => (x * 100).toFixed(2).replace('.', ',') + '%';
    const barHTML = (frac, label, alt) =>
        '<div class="pk-bar' + (alt ? ' alt' : '') + '"><i style="width:' + Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%"></i><b>' + label + '</b></div>';
    const NOTE_DX = '<p class="pk-note">Ilustrasi pembelajaran dari aplikasi penelitian: hasilnya perkiraan awal, bukan diagnosis.</p>';

    // Kerangka bersama TropisCheck dan BabyCheck: tombol skenario, pilihan gejala, tabel hasil, hitungan baris terpilih.
    function appShell(rootEl, presets, nama) {
        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="pk-facts"><span class="pk-facts-title">Coba skenario:</span>' +
            presets.map((p, i) => '<button type="button" class="viz-btn secondary" data-pre="' + i + '">' + esc(p[0]) + '</button>').join('') +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Kosongkan</button></div>' +
            '<div class="viz-block"><h6>1. Pilih gejala <span data-role="n"></span></h6><div class="pk-facts" data-role="chips"></div></div>' +
            '<div class="viz-block"><h6>2. Hasil ' + esc(nama) + ' (klik satu baris untuk melihat hitungannya)</h6><div class="pk-scroll"><div data-role="tbl"></div></div></div>' +
            '<div class="viz-block"><h6>3. Hitungan baris terpilih</h6><div class="pk-scroll"><div data-role="detail"></div></div></div>' + NOTE_DX;
        return r => rootEl.querySelector('[data-role="' + r + '"]');
    }
    function chipsDari(sym, sel, $) {
        $('chips').innerHTML = Object.keys(sym).map(Number).map(id =>
            '<button type="button" class="pk-fact' + (sel.includes(id) ? ' known' : '') + '" data-s="' + id + '" aria-pressed="' + sel.includes(id) + '">' + esc(sym[id]) + '</button>').join('');
        $('n').textContent = '(' + sel.length + ' dipilih)';
    }
    function pasangEvent(rootEl, $, presets, getSel, setSel, setCur, render) {
        rootEl.addEventListener('click', e => {
            const chip = e.target.closest('[data-s]');
            if (chip) {
                const s = +chip.dataset.s, sel = getSel();
                setSel(sel.includes(s) ? sel.filter(x => x !== s) : sel.concat(s));
                render();
                return;
            }
            const pre = e.target.closest('[data-pre]');
            if (pre) { setSel(presets[+pre.dataset.pre][1].slice()); setCur(null); render(); return; }
            if (e.target.closest('[data-role="reset"]')) { setSel([]); setCur(null); render(); return; }
            const row = e.target.closest('tr[data-id]');
            if (row) { setCur(+row.dataset.id); render(); }
        });
    }

    /* TropisCheck: Certainty Factor + "DS" */
    function initTropis(rootEl) {
        const A = APP.tropis;
        const PRESET = [
            ['Demam berdarah: gejala klasik', [1, 5, 10, 11, 4]],
            ['Setelah banjir', [27, 22, 17, 1]],
            ['Mata dan kulit menguning', [18, 19, 28]]
        ];
        let sel = PRESET[0][1].slice(), cur = null;
        const $ = appShell(rootEl, PRESET, 'CF dan DS');
        function render() {
            chipsDari(A.sym, sel, $);
            const hasil = tropisHitung(sel);
            if (!hasil.rows.length) {
                $('tbl').innerHTML = '<p class="pk-note">Belum ada gejala yang dipilih.</p>';
                $('detail').innerHTML = '<p class="pk-note">Pilih minimal satu gejala atau klik salah satu skenario di atas.</p>';
                return;
            }
            if (!hasil.rows.some(r => r.id === cur)) cur = hasil.rows[0].id;
            $('tbl').innerHTML =
                '<table class="pk-rtab"><thead><tr><th>#</th><th>Penyakit</th><th>Gejala cocok</th><th>CF</th><th>DS</th></tr></thead><tbody>' +
                hasil.rows.map((r, i) =>
                    '<tr data-id="' + r.id + '" class="' + (r.id === cur ? 'sel' : '') + '"><td>' + (i + 1) + '</td><td><button type="button" class="pk-link">' + esc(r.name) + '</button></td><td>' +
                    r.steps.length + ' dari ' + Object.keys(A.dis.find(d => d.id === r.id).rel).length + '</td><td>' + barHTML(r.cf, p1(r.cf)) + '</td><td>' + barHTML(r.ds, p1(r.ds), true) + '</td></tr>').join('') +
                '</tbody></table>';
            const r = hasil.rows.find(x => x.id === cur);
            $('detail').innerHTML =
                '<p style="margin:0 0 8px"><b>' + esc(r.name) + '</b>: CF diakumulasi gejala demi gejala dengan <span class="pk-var">CF baru = CF lama + cf × (1 − CF lama)</span></p>' +
                '<table class="pk-rtab"><thead><tr><th>Gejala yang cocok</th><th>cf pakar</th><th>Perhitungan</th><th>CF baru</th></tr></thead><tbody>' +
                r.steps.map(t => '<tr><td>' + esc(A.sym[t.s]) + '</td><td>' + f2(t.c) + '</td><td>' + f2(t.lama) + ' + ' + f2(t.c) + ' × (1 − ' + f2(t.lama) + ')</td><td><b>' + f2(t.baru) + '</b></td></tr>').join('') +
                '</tbody></table>' +
                '<p style="margin:10px 0 0"><b>DS</b> pada aplikasi ini = jumlah cf gejala yang cocok ÷ jumlah semua penyakit: <span class="pk-var">' +
                f2(r.sum) + ' ÷ ' + f2(hasil.total) + ' = ' + p1(r.ds) + '</span></p>' +
                '<p class="pk-note">Perhatikan dua hal: CF tidak pernah turun ketika gejala bertambah, dan DS ini hanya pembagian (normalisasi), bukan aturan kombinasi Dempster yang sebenarnya. Bandingkan dengan BabyCheck di bawah.</p>';
        }
        pasangEvent(rootEl, $, PRESET, () => sel, v => { sel = v; }, v => { cur = v; }, render);
        render();
    }

    /* BabyCheck: forward chaining + Dempster-Shafer */
    function initBalita(rootEl) {
        const A = APP.balita;
        const PRESET = [
            ['Demam, batuk, pilek', [1, 2, 3]],
            ['Hanya demam', [1]],
            ['Batuk dan sesak napas', [2, 7]]
        ];
        let sel = PRESET[0][1].slice(), cur = null;
        const $ = appShell(rootEl, PRESET, 'forward chaining + DS');
        function render() {
            chipsDari(A.sym, sel, $);
            const semua = balitaHitung(sel);
            if (!semua.length) {
                $('tbl').innerHTML = '<p class="pk-note">Belum ada gejala yang dipilih.</p>';
                $('detail').innerHTML = '<p class="pk-note">Pilih minimal satu gejala atau klik salah satu skenario di atas.</p>';
                return;
            }
            const rows = semua.slice(0, 5);
            const nAturan = semua.reduce((a, r) => a + r.ss.length, 0);
            if (!rows.some(r => r.id === cur)) cur = rows[0].id;
            $('tbl').innerHTML =
                '<p class="pk-note" style="margin:0 0 8px"><b>' + nAturan + '</b> aturan ditembakkan dan menyentuh <b>' + semua.length + '</b> penyakit; aplikasi hanya menampilkan 5 teratas.</p>' +
                '<table class="pk-rtab"><thead><tr><th>#</th><th>Penyakit</th><th>Aturan yang menembak</th><th>Tingkat kepercayaan</th></tr></thead><tbody>' +
                rows.map((r, i) =>
                    '<tr data-id="' + r.id + '" class="' + (r.id === cur ? 'sel' : '') + '"><td>' + (i + 1) + '</td><td><button type="button" class="pk-link">' + esc(r.name) + '</button></td><td>' +
                    r.ss.length + '</td><td>' + barHTML(r.m, p2(r.m)) + '</td></tr>').join('') +
                '</tbody></table>';
            const r = semua.find(x => x.id === cur);
            const odds = r.cs.reduce((a, c) => a * c / (1 - c), 1);
            $('detail').innerHTML =
                '<p style="margin:0 0 6px"><b>' + esc(r.name) + '</b>. Aturan yang ditembakkan oleh gejala terpilih (fakta):</p>' +
                '<div class="pk-rule" style="margin-bottom:10px"><div class="f">' + r.ss.map((s, i) =>
                    '<span class="t">IF</span> ' + esc(A.sym[s]) + ' <span class="t">THEN</span> ' + esc(r.name) + ' <span class="x">(certainty ' + f2(r.cs[i]) + ')</span>').join('<br>') + '</div></div>' +
                '<p style="margin:0 0 6px">Massa awal m(Penyakit) = 0,50 dan m(Bukan penyakit) = 0,50. Tiap aturan membawa massa (c, 1 − c) lalu digabung dengan aturan Dempster:</p>' +
                '<table class="pk-rtab"><thead><tr><th>Gejala</th><th>c</th><th>m(Penyakit) sebelum</th><th>Konflik K</th><th>m(Penyakit) sesudah</th></tr></thead><tbody>' +
                r.steps.map((t, i) => '<tr><td>' + esc(A.sym[r.ss[i]]) + '</td><td>' + f2(t.c) + '</td><td>' + f2(t.dari) + '</td><td>' + f2(t.k) + '</td><td><b>' + (i === r.steps.length - 1 ? p2(t.m) : f2(t.m)) + '</b></td></tr>').join('') +
                '</tbody></table>' +
                '<p style="margin:10px 0 0">Jalan pintas: dengan massa awal 0,5, hasilnya sama dengan mengalikan rasio <i>odds</i> <span class="pk-var">' +
                r.cs.map(c => f2(c) + '/' + f2(1 - c)).join(' × ') + ' = ' + fN(odds) + '</span>, lalu <span class="pk-var">' + fN(odds) + ' ÷ (1 + ' + fN(odds) + ') = ' + p2(r.m) + '</span>.</p>' +
                '<p class="pk-note">Gejala penyakit yang <i>tidak</i> dipilih tidak mengurangi keyakinan sama sekali. Coba skenario “Hanya demam”: beberapa penyakit berbagi nilai 90% yang sama.</p>';
        }
        pasangEvent(rootEl, $, PRESET, () => sel, v => { sel = v; }, v => { cur = v; }, render);
        render();
    }

    /* SehatBalita: CBR + fuzzy */
    function initCBR(rootEl) {
        const A = APP.cbr;
        const PRESET = [
            ['Mirip batuk pilek', { 1: 0.7, 2: 0.5, 4: 0.3 }],
            ['Mirip demam berdarah', { 1: 0.9, 8: 0.7, 9: 0.5 }],
            ['Mirip asma', { 10: 0.9, 3: 0.7, 8: 0.5 }]
        ];
        let input = Object.assign({}, PRESET[0][1]), cur = null;
        rootEl.classList.add('viz', 'pk');
        rootEl.innerHTML =
            '<div class="pk-facts"><span class="pk-facts-title">Coba skenario:</span>' +
            PRESET.map((p, i) => '<button type="button" class="viz-btn secondary" data-pre="' + i + '">' + esc(p[0]) + '</button>').join('') +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Kosongkan</button></div>' +
            '<div class="viz-block"><h6>1. Pilih gejala, klik lagi untuk menaikkan intensitas <span data-role="n"></span></h6><div class="pk-facts" data-role="chips"></div></div>' +
            '<div class="viz-block"><h6>2. Mencari kasus yang mirip (klik satu baris untuk melihat hitungannya)</h6><div data-role="verdict"></div><div class="pk-scroll"><div data-role="tbl"></div></div></div>' +
            '<div class="viz-block"><h6>3. Hitungan kasus terpilih</h6><div class="pk-scroll"><div data-role="detail"></div></div></div>' + NOTE_DX;
        const $ = r => rootEl.querySelector('[data-role="' + r + '"]');
        const namaTingkat = v => { const t = A.tingkat.find(x => x[1] === v); return t ? t[0] : ''; };
        function render() {
            const gid = Object.keys(input).map(Number);
            $('chips').innerHTML = A.gejala.map(g => {
                const on = input[g.id] !== undefined;
                return '<button type="button" class="pk-fact' + (on ? ' known' : '') + '" data-g="' + g.id + '" aria-pressed="' + on + '">' + esc(g.nama) +
                    (on ? ' <small>' + namaTingkat(input[g.id]) + ' (' + f2(input[g.id]) + ')</small>' : '') + '</button>';
            }).join('');
            $('n').textContent = '(' + gid.length + ' dipilih)';
            if (!gid.length) {
                $('verdict').innerHTML = '';
                $('tbl').innerHTML = '<p class="pk-note">Belum ada gejala yang dipilih.</p>';
                $('detail').innerHTML = '<p class="pk-note">Pilih minimal satu gejala atau klik salah satu skenario di atas.</p>';
                return;
            }
            const h = cbrHitung(input);
            const urut = h.rows.slice().sort((a, b) => b.nilai - a.nilai);
            if (!urut.some(r => r.id === cur)) cur = (h.terbaik || urut[0]).id;
            $('verdict').innerHTML = h.terbaik
                ? '<div class="pk-verdict ok">' + ICON('circle-check') + ' Kasus terbaik: Kasus ' + h.terbaik.id + ' (' + esc(h.terbaik.penyakit) + '), kecocokan ' + p1(h.terbaik.nilai).replace(',0%', '%') + ' (' + cbrKategori(h.terbaik.nilai) + '). Rekomendasi diambil dari solusi penyakit itu.</div>'
                : '<div class="pk-verdict bad">' + ICON('circle-info') + ' Tidak ada kasus dengan nilai di atas ' + f2(A.batas) + '. Sistem menyatakan belum ada kasus yang cocok dan menyarankan pemeriksaan medis.</div>';
            $('tbl').innerHTML =
                '<table class="pk-rtab"><thead><tr><th>Kasus</th><th>Penyakit pada kasus</th><th>Gejala cocok</th><th>Kemiripan</th><th>Nilai akhir</th><th>Status</th></tr></thead><tbody>' +
                urut.map(r => {
                    const cls = (r === h.terbaik ? 'pick' : r.lolos ? '' : 'nomatch') + (r.id === cur ? ' sel' : '');
                    return '<tr data-id="' + r.id + '" class="' + cls + '"><td><button type="button" class="pk-link">Kasus ' + r.id + '</button></td><td>' + esc(r.penyakit) + '</td><td>' + r.cocok + ' dari ' + r.dipilih + '</td><td>' +
                        (r.cocok ? f2(r.kem) : '–') + '</td><td>' + barHTML(r.nilai, f2(r.nilai)) + '</td><td>' + (r === h.terbaik ? 'terbaik' : r.lolos ? 'lolos' : 'dibuang') + '</td></tr>';
                }).join('') + '</tbody></table>';
            const r = h.rows.find(x => x.id === cur);
            const nm = id => A.gejala.find(g => g.id === id).nama;
            const bobot = id => A.gejala.find(g => g.id === id).bobot;
            $('detail').innerHTML =
                '<p style="margin:0 0 6px"><b>Kasus ' + r.id + ' (' + esc(r.penyakit) + ')</b>. Skor fuzzy <span class="pk-var">(1 − |intensitas − bobot|) × bobot</span>, kemiripan <span class="pk-var">1 − |intensitas Anda − intensitas kasus|</span>:</p>' +
                '<table class="pk-rtab"><thead><tr><th>Gejala Anda</th><th>Intensitas</th><th>Bobot</th><th>Skor fuzzy</th><th>Intensitas kasus</th><th>Kemiripan</th><th>Kemiripan × skor</th></tr></thead><tbody>' +
                r.det.map(d => d.ada
                    ? '<tr><td>' + esc(nm(d.g)) + '</td><td>' + f2(input[d.g]) + '</td><td>' + f2(bobot(d.g)) + '</td><td>' + f2(d.skor) + '</td><td>' + f2(d.kasus) + '</td><td>' + f2(d.sim) + '</td><td><b>' + f2(d.kontribusi) + '</b></td></tr>'
                    : '<tr class="nomatch"><td>' + esc(nm(d.g)) + '</td><td>' + f2(input[d.g]) + '</td><td>' + f2(bobot(d.g)) + '</td><td>' + f2(h.skor[d.g]) + '</td><td colspan="3">tidak ada pada kasus ini</td></tr>').join('') +
                '</tbody></table>' +
                (r.cocok
                    ? '<p style="margin:10px 0 0">Kemiripan kasus = Σ(kemiripan × skor) ÷ Σ skor = <span class="pk-var">' + f2(r.sum) + ' ÷ ' + f2(r.w) + ' = ' + f2(r.kem) + '</span></p>' +
                      '<p style="margin:6px 0 0">Nilai akhir = kemiripan × (gejala cocok ÷ gejala dipilih) = <span class="pk-var">' + f2(r.kem) + ' × ' + r.cocok + '/' + r.dipilih + ' = ' + f2(r.nilai) + '</span>' +
                      (r.lolos ? '' : ', tidak lebih dari ' + f2(A.batas) + ' sehingga kasus ini dibuang') + '.</p>'
                    : '<p style="margin:10px 0 0">Tidak ada gejala Anda yang dimiliki kasus ini, sehingga nilainya 0.</p>') +
                '<p class="pk-note">Sistem ini tidak punya aturan IF-THEN. Pengetahuannya adalah kumpulan kasus; kecocokan dihitung, bukan ditelusuri lewat aturan.</p>';
        }
        rootEl.addEventListener('click', e => {
            const chip = e.target.closest('[data-g]');
            if (chip) {
                const g = +chip.dataset.g, i = A.tingkat.findIndex(t => t[1] === input[g]);
                if (i + 1 < A.tingkat.length) input[g] = A.tingkat[i + 1][1]; else delete input[g];
                render();
                return;
            }
            const pre = e.target.closest('[data-pre]');
            if (pre) { input = Object.assign({}, PRESET[+pre.dataset.pre][1]); cur = null; render(); return; }
            if (e.target.closest('[data-role="reset"]')) { input = {}; cur = null; render(); return; }
            const row = e.target.closest('tr[data-id]');
            if (row) { cur = +row.dataset.id; render(); }
        });
        render();
    }

    /* =====================================================================
     * 4. INISIALISASI / EKSPOR
     * ===================================================================== */
    const INIT = {
        'rule-lab': initRuleLab,
        'es-arch': initArch,
        'rule-chain': initRuleChain,
        'es-consult': initConsult,
        'infer-table': initInferTable,
        'conflict-lab': initConflict,
        'skor-lab': initSkor,
        'app-tropis': initTropis,
        'app-balita': initBalita,
        'app-cbr': initCBR
    };
    function boot() {
        const doc = root.document;
        const targets = Array.from(doc.querySelectorAll('[data-viz]')).filter(el => INIT[el.dataset.viz]);
        if (!targets.length) return;
        installDOM();
        targets.forEach(el => {
            try { INIT[el.dataset.viz](el); }
            catch (err) { if (root.console) root.console.error('pakar-viz:', el.dataset.viz, err); }
        });
    }

    root.PakarViz = {
        KB, kbInit, forwardRun, backwardRun, howLines, makeConsult, lamaranSteps, lamaranFinal,
        obligasiSteps, pilihKonflik, DISKON, SPAM, SPAM_BATAS, TABEL_LAMARAN, TABEL_OBLIGASI,
        APP, tropisHitung, dsKombinasi, balitaHitung, cbrHitung, cbrKategori
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.PakarViz;
    if (root.document) {
        if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})(typeof window !== 'undefined' ? window : globalThis);
