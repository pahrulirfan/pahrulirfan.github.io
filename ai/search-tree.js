/* ENGINE-START */
const GRAPH = window.SEARCH_GRAPH;
const HV = GRAPH.h || null;   // nilai heuristik h(n), opsional

function neighbors(s) {
    const out = [];
    GRAPH.edges.forEach(([u, v, c]) => {
        if (u === s) out.push([v, c]);
        else if (v === s) out.push([u, c]);
    });
    return out.sort((a, b) => a[0].localeCompare(b[0]));
}

function edgeCost(u, v) {
    const e = GRAPH.edges.find(([a, b]) => (a === u && b === v) || (a === v && b === u));
    return e ? e[2] : null;
}

function makeNode(nodes, state, parent, gen) {
    const p = parent == null ? null : nodes[parent];
    const n = {
        id: nodes.length, state, parent,
        g: p ? p.g + edgeCost(p.state, state) : 0,
        depth: p ? p.depth + 1 : 0,
        path: p ? p.path.concat(state) : [state],
        order: null, gen
    };
    if (HV) { n.h = HV[state]; n.f = n.g + n.h; }
    nodes.push(n);
    return n.id;
}

/* Penelusuran berbentuk pohon: anak = tetangga urut abjad, kecuali leluhur
   (simpul yang sudah ada di lintasan dari akar). algo: 'ucs' | 'bfs' | 'dfs' | 'gbfs' | 'astar'. */
function runSearch(algo) {
    const nodes = [];
    const steps = [];
    const PQ = algo === 'ucs' || algo === 'astar' || algo === 'gbfs';
    const keyOf = n => algo === 'astar' ? n.g + n.h : algo === 'gbfs' ? n.h : n.g;
    const cmp = (a, b) => {
        const na = nodes[a], nb = nodes[b];
        if (keyOf(na) !== keyOf(nb)) return keyOf(na) - keyOf(nb);
        if (na.state !== nb.state) return na.state.localeCompare(nb.state);
        return na.path.join('').localeCompare(nb.path.join(''));
    };

    let open = [makeNode(nodes, GRAPH.start, null, 0)];
    const closed = [];
    steps.push({ kind: 'start', cur: null, tieWith: [], children: [], skipped: [], open: open.slice(), closed: [] });

    let order = 0;
    while (open.length) {
        let cur, tieWith = [];
        if (PQ) {
            open.sort(cmp);
            cur = open[0];
            tieWith = open.slice(1).filter(id => keyOf(nodes[id]) === keyOf(nodes[cur]));
            open = open.slice(1);
        } else {
            cur = open.shift();          // BFS: kepala antrian; DFS: puncak tumpukan
        }
        const n = nodes[cur];
        n.order = ++order;

        // UCS & DFS: uji tujuan saat simpul diambil dari Open
        if (algo !== 'bfs' && n.state === GRAPH.goal) {
            steps.push({ kind: 'goal', cur, goal: cur, tieWith, children: [], skipped: [], open: open.slice(), closed: closed.slice() });
            return { nodes, steps, goal: cur };
        }

        closed.push(cur);
        const nb = neighbors(n.state);
        const skipped = nb.filter(([s]) => n.path.includes(s)).map(([s]) => s);
        const kids = [];
        let goalKid = null;
        for (const [s] of nb) {
            if (n.path.includes(s)) continue;
            const kid = makeNode(nodes, s, cur, steps.length);
            kids.push(kid);
            // BFS: uji tujuan saat anak dibangkitkan (sesuai Materi 2)
            if (algo === 'bfs' && s === GRAPH.goal) { goalKid = kid; break; }
        }

        if (algo === 'bfs') open = open.concat(kids);
        else if (algo === 'dfs') open = kids.slice().concat(open);   // anak abjad pertama di puncak
        else { open = open.concat(kids); open.sort(cmp); }

        const step = { kind: kids.length ? 'expand' : 'dead', cur, tieWith, children: kids, skipped, open: open.slice(), closed: closed.slice() };
        if (goalKid != null) {
            step.kind = 'goal-gen';
            step.goal = goalKid;
            step.open = open.filter(id => id !== goalKid);
        }
        steps.push(step);
        if (goalKid != null) return { nodes, steps, goal: goalKid };
    }
    return { nodes, steps, goal: null };
}

/* Pohon lengkap: semua lintasan dari awal yang tidak berputar */
function fullTree() {
    const nodes = [];
    const grow = id => {
        const n = nodes[id];
        if (n.state === GRAPH.goal) return;
        neighbors(n.state).forEach(([s]) => {
            if (!n.path.includes(s)) grow(makeNode(nodes, s, id, 0));
        });
    };
    grow(makeNode(nodes, GRAPH.start, null, 0));
    return nodes;
}

/* Hill Climbing: hanya satu keadaan sekarang, "lebih baik" = h lebih kecil.
   steep = false: Simple HC (tetangga menurut abjad, ambil yang PERTAMA lebih baik).
   steep = true : Steepest-Ascent HC (nilai semua tetangga, ambil yang terbaik; seri → abjad). */
function runHC(steep) {
    const steps = [];
    const path = [GRAPH.start];
    let cur = GRAPH.start;
    for (let guard = 0; guard < 40; guard++) {
        if (cur === GRAPH.goal) { steps.push({ kind: 'goal', cur, h: HV[cur], path: path.slice(), nbs: [], checked: [], chosen: null }); break; }
        const hc = HV[cur];
        const nbs = neighbors(cur).map(([s, c]) => ({ s, c, h: HV[s], better: HV[s] < hc }));
        let chosen = null, checked = [];
        if (!steep) {
            for (const x of nbs) { checked.push(x.s); if (x.better) { chosen = x; break; } }
        } else {
            checked = nbs.map(x => x.s);
            for (const x of nbs) if (x.better && (chosen === null || x.h < chosen.h)) chosen = x;
        }
        steps.push({ kind: chosen ? 'move' : 'stuck', cur, h: hc, path: path.slice(), nbs, checked, chosen: chosen ? chosen.s : null });
        if (!chosen) break;
        cur = chosen.s;
        path.push(cur);
    }
    let cost = 0;
    for (let i = 1; i < path.length; i++) cost += edgeCost(path[i - 1], path[i]);
    return { steps, path, cost, reached: cur === GRAPH.goal };
}
/* ENGINE-END */

// ================================================================
// Gambar
// ================================================================
const SVGNS = 'http://www.w3.org/2000/svg';
const pathText = n => n.path.join('–');
const costText = n => {
    const parts = [];
    for (let i = 1; i < n.path.length; i++) parts.push(edgeCost(n.path[i - 1], n.path[i]));
    return parts.join(' + ') + ' = ' + n.g;
};
const listStates = arr => arr.join(', ');

function svgEl(w, h, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" role="img" aria-label="' + label + '">';
}

/* Graf soal. hl = { path: [...], cur: 'X', final: bool } */
function graphSVG(hl) {
    const P = GRAPH.pos;
    const onPath = new Set();
    if (hl) for (let i = 1; i < hl.path.length; i++) onPath.add([hl.path[i - 1], hl.path[i]].sort().join(''));
    let s = svgEl(GRAPH.size[0], GRAPH.size[1], 'Graf soal: simpul A sampai F dengan biaya ruas');
    GRAPH.edges.forEach(([u, v]) => {
        const cls = onPath.has([u, v].sort().join('')) ? (hl.final ? ' final' : ' path') : '';
        s += '<line x1="' + P[u][0] + '" y1="' + P[u][1] + '" x2="' + P[v][0] + '" y2="' + P[v][1] + '" class="g-edge' + cls + '"/>';
    });
    GRAPH.edges.forEach(([u, v, c]) => {
        const mx = (P[u][0] + P[v][0]) / 2, my = (P[u][1] + P[v][1]) / 2;
        const dx = P[v][0] - P[u][0], dy = P[v][1] - P[u][1], len = Math.hypot(dx, dy);
        const ox = -dy / len * 14, oy = dx / len * 14;
        s += '<text x="' + (mx + ox) + '" y="' + (my + oy + 5) + '" class="g-cost" text-anchor="middle">' + c + '</text>';
    });
    Object.keys(P).forEach(k => {
        let cls = 'node-default';
        if (hl && hl.path.includes(k)) cls = 'node-visited';
        if (hl && hl.cur === k) cls = hl.final ? 'node-goal' : 'node-current';
        if (hl && hl.ring && hl.ring[k]) s += '<circle cx="' + P[k][0] + '" cy="' + P[k][1] + '" r="29" class="g-ring ' + hl.ring[k] + '"/>';
        s += '<circle cx="' + P[k][0] + '" cy="' + P[k][1] + '" r="22" class="' + cls + '"/>';
        s += '<text x="' + P[k][0] + '" y="' + (P[k][1] + 5) + '" class="node-text" text-anchor="middle">' + k + '</text>';
    });
    if (HV) Object.keys(P).forEach(k => {
        const o = (GRAPH.hpos && GRAPH.hpos[k]) || [0, -32];
        s += '<text x="' + (P[k][0] + o[0]) + '" y="' + (P[k][1] + o[1]) + '" class="g-h" text-anchor="middle">h=' + HV[k] + '</text>';
    });
    const tp = GRAPH.tagpos || {};
    const ts = tp.start || [0, -30], tg = tp.goal || [0, 40];
    s += '<text x="' + (P[GRAPH.start][0] + ts[0]) + '" y="' + (P[GRAPH.start][1] + ts[1]) + '" class="g-tag" text-anchor="middle">awal</text>';
    s += '<text x="' + (P[GRAPH.goal][0] + tg[0]) + '" y="' + (P[GRAPH.goal][1] + tg[1]) + '" class="g-tag" text-anchor="middle">tujuan</text>';
    return s + '</svg>';
}

function layoutTree(nodes) {
    const kids = {};
    nodes.forEach(n => { if (n.parent != null) (kids[n.parent] = kids[n.parent] || []).push(n.id); });
    let leaf = 0;
    const X = {};
    const visit = id => {
        const k = kids[id] || [];
        if (!k.length) X[id] = leaf++;
        else { k.forEach(visit); X[id] = (X[k[0]] + X[k[k.length - 1]]) / 2; }
    };
    visit(0);
    return { X, kids, leaves: leaf, maxDepth: Math.max(...nodes.map(n => n.depth)) };
}

/* opt: { gap, showG, view(id) -> {cls, dark, tag, tagColor, isNew, edge} | null, levels } */
function treeSVG(nodes, opt) {
    const L = layoutTree(nodes);
    const gap = opt.gap || 70, lv = 78, left = opt.levels ? 64 : 30, top = 34;
    const W = left + (L.leaves - 1) * gap + 40;
    const lc = opt.lineCount || (opt.showG ? 1 : 0);
    const H = top + L.maxDepth * lv + (lc ? 37 + 13 * lc : 40);
    const xy = id => [left + L.X[id] * gap, top + nodes[id].depth * lv];
    let s = svgEl(W, H, 'Pohon pencarian');
    if (opt.levels) for (let d = 0; d <= L.maxDepth; d++) {
        s += '<text x="6" y="' + (top + d * lv + 4) + '" class="t-level">Level ' + d + '</text>';
    }
    const views = nodes.map(n => opt.view(n.id));
    // ruas
    nodes.forEach(n => {
        if (n.parent == null || !views[n.id]) return;
        const [x1, y1] = xy(n.parent), [x2, y2] = xy(n.id);
        s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="t-edge ' + (views[n.id].edge || '') + '"/>';
        const mx = (x1 + x2) / 2 + (x2 < x1 ? -9 : 9), my = (y1 + y2) / 2 + 3;
        s += '<text x="' + mx + '" y="' + my + '" class="t-cost" text-anchor="middle">' + edgeCost(nodes[n.parent].state, n.state) + '</text>';
    });
    // simpul
    nodes.forEach(n => {
        const v = views[n.id];
        if (!v) return;
        const [x, y] = xy(n.id);
        s += '<g class="t-node">';
        if (v.isNew) s += '<circle cx="' + x + '" cy="' + y + '" r="23" class="t-new"/>';
        s += '<circle cx="' + x + '" cy="' + y + '" r="17" class="' + v.cls + '"/>';
        s += '<text x="' + x + '" y="' + (y + 5) + '" class="node-text' + (v.dark ? ' dark' : '') + '" text-anchor="middle">' + n.state + '</text>';
        let below = y + 32;
        if (opt.lines) {
            opt.lines(n).forEach(([t, c]) => {
                s += '<text x="' + x + '" y="' + below + '" class="' + c + '" text-anchor="middle">' + t + '</text>';
                below += 13;
            });
        } else if (opt.showG) {
            s += '<text x="' + x + '" y="' + below + '" class="t-g" text-anchor="middle">g=' + n.g + '</text>';
            below += 13;
        }
        if (v.tag) s += '<text x="' + x + '" y="' + below + '" class="t-tag" fill="' + v.tagColor + '" text-anchor="middle">' + v.tag + '</text>';
        if (v.badge) {
            s += '<g class="t-badge"><circle cx="' + (x + 16) + '" cy="' + (y - 14) + '" r="8.5"/>' +
                 '<text x="' + (x + 16) + '" y="' + (y - 10.5) + '" text-anchor="middle">' + v.badge + '</text></g>';
        }
        s += '</g>';
    });
    return s + '</svg>';
}

// Tampilan tiap simpul pohon pada langkah k
function nodeView(r, k, id) {
    const n = r.nodes[id], st = r.steps[k];
    if (n.gen > k) return null;
    const done = st.kind === 'goal' || st.kind === 'goal-gen';
    const goalPath = done ? new Set(r.nodes[st.goal].path.map((_, i, p) => p.slice(0, i + 1).join(''))) : null;
    const curPath = st.cur != null ? new Set(r.nodes[st.cur].path.map((_, i, p) => p.slice(0, i + 1).join(''))) : new Set();
    const key = n.path.join('');
    const v = { cls: 'node-default', edge: '' };
    if (n.order != null && r.steps.findIndex(s => s.cur === id) <= k) v.badge = n.order;
    const expandedNoKids = st.closed.includes(id) && !r.nodes.some(m => m.parent === id);

    if (done && id === st.goal) { v.cls = 'node-goal'; v.tag = 'tujuan'; v.tagColor = '#2e7d32'; }
    else if (id === st.cur) { v.cls = expandedNoKids ? 'node-dead' : 'node-current'; if (expandedNoKids) { v.tag = 'buntu'; v.tagColor = '#78909c'; } }
    else if (expandedNoKids) { v.cls = 'node-dead'; v.tag = 'buntu'; v.tagColor = '#78909c'; }
    else if (st.closed.includes(id)) v.cls = 'node-visited';
    else if (st.open.includes(id)) { v.cls = 'node-frontier'; v.dark = true; }

    if (done) { if (goalPath.has(key)) v.edge = 'final'; }
    else if (curPath.has(key)) v.edge = 'path';
    if (n.gen === k && k > 0) v.isNew = true;
    if (id === st.cur && st.kind !== 'goal' && !expandedNoKids) v.cls = 'node-current';
    return v;
}

// ================================================================
// Catatan per langkah
// ================================================================
/* val(n): angka kecil di samping huruf simpul; nameVal(n): keterangan di catatan;
   keyTxt(n): nilai yang dibandingkan saat seri; kidTxt(n, c): hitungan anak. */
const ALGO = {
    ucs: { name: 'UCS', showG: true, openLbl: 'Open — antrian prioritas (urut g, seri → abjad)', take: 'karena g-nya paling kecil di Open',
           val: n => n.g, nameVal: n => 'g = ' + n.g, keyTxt: n => 'g = ' + n.g,
           kidTxt: (n, c) => 'g = ' + n.g + ' + ' + edgeCost(n.state, c.state) + ' = ' + c.g, sortBy: 'g' },
    bfs: { name: 'BFS', showG: false, openLbl: 'Open — antrian FIFO (kiri = depan)', take: 'dari <strong>depan</strong> antrian' },
    dfs: { name: 'DFS', showG: false, openLbl: 'Open — tumpukan LIFO (kiri = puncak)', take: 'dari <strong>puncak</strong> tumpukan' },
    astar: { name: 'A*', showG: false, openLbl: 'Open — antrian prioritas (urut f = g + h, seri → abjad)', take: 'karena f-nya paling kecil di Open',
             val: n => n.g + '+' + n.h + '=' + n.f,
             nameVal: n => 'g = ' + n.g + ', h = ' + n.h + ', f = ' + n.f,
             keyTxt: n => 'f = ' + n.f,
             kidTxt: (n, c) => 'g = ' + n.g + ' + ' + edgeCost(n.state, c.state) + ' = ' + c.g + ', h = ' + c.h + ', f = ' + c.g + ' + ' + c.h + ' = ' + c.f,
             sortBy: 'f',
             lineCount: 2, lines: n => [['f=' + n.f, 't-g'], [n.g + '+' + n.h, 't-g2']] },
    gbfs: { name: 'GBFS', showG: false, openLbl: 'Open — antrian prioritas (urut h, seri → abjad)', take: 'karena h-nya paling kecil di Open',
            val: n => n.h,
            nameVal: n => 'h = ' + n.h,
            keyTxt: n => 'h = ' + n.h,
            kidTxt: (n, c) => 'h = ' + c.h,
            sortBy: 'h',
            lineCount: 2, lines: n => [['h=' + n.h, 't-g'], ['g=' + n.g, 't-g2']] }
};

function nodeLabel(r, id, A) {
    const n = r.nodes[id];
    return '<b>' + n.state + '</b>' + (A.val ? '(' + A.val(n) + ')' : '');
}

function noteFor(algo, r, k) {
    const st = r.steps[k], A = ALGO[algo], N = r.nodes;
    if (st.kind === 'start') {
        return '<strong>Mulai.</strong> Open berisi akar <b>' + GRAPH.start + '</b>' + (A.nameVal ? ' (' + A.nameVal(N[st.open[0]]) + ')' : '') + '. Closed masih kosong.';
    }
    const n = N[st.cur];
    let s = '<strong>Langkah ' + k + '.</strong> Ambil <b>' + n.state + '</b> (lintasan ' + pathText(n) + (A.nameVal ? ', ' + A.nameVal(n) : '') + ') ' + A.take + '.';
    if (st.tieWith && st.tieWith.length) {
        const t = st.tieWith.map(id => N[id].state + ' (' + pathText(N[id]) + ', ' + A.keyTxt(N[id]) + ')').join(', ');
        if (st.tieWith.every(id => N[id].state === n.state)) {
            s += ' <strong>Ada seri</strong> dengan ' + t + ': hurufnya sama (' + n.state + '), jadi bandingkan lintasannya huruf demi huruf. <b>' + pathText(n) + '</b> lebih awal secara abjad, maka <b>' + pathText(n) + '</b> diambil lebih dulu.';
        } else {
            s += ' <strong>Ada seri</strong> dengan ' + t + ': sesuai catatan soal, pilih huruf yang lebih awal → <b>' + n.state + '</b>.';
        }
    }
    if (st.kind === 'goal') {
        return s + ' <b>' + n.state + '</b> adalah tujuan, pencarian <strong>berhenti</strong>. Lintasan: <strong>' + n.path.join(' → ') + '</strong>, biaya ' + costText(n) + '.';
    }
    s += ' ' + n.state + ' bukan tujuan, jadi diekspansi.';
    if (st.kind === 'dead') {
        s += ' Semua tetangganya (' + listStates(st.skipped) + ') sudah ada di lintasan, jadi tidak ada anak baru. Simpul ini <strong>buntu</strong>, ' +
            (algo === 'dfs' ? 'DFS mundur ke simpul berikutnya di tumpukan.' : 'tidak ada yang masuk Open, lanjut ke simpul berikutnya di Open.');
        return s;
    }
    const kids = st.children.map(id => {
        const c = N[id];
        return '<b>' + c.state + '</b>' + (A.kidTxt ? ' (' + A.kidTxt(n, c) + ')' : '');
    });
    s += ' Anak urut abjad: ' + kids.join(', ') + '.';
    if (st.skipped.length) s += ' ' + listStates(st.skipped) + ' tidak dibangkitkan karena sudah ada di lintasan (leluhur).';
    if (st.kind === 'goal-gen') {
        const g = N[st.goal];
        s += ' Anak <b>' + g.state + '</b> adalah tujuan, BFS langsung <strong>berhenti</strong> saat tujuan dibangkitkan. Lintasan: <strong>' + g.path.join(' → ') + '</strong>, biaya ' + costText(g) + '.';
        return s;
    }
    if (algo === 'bfs') s += ' Anak masuk ke <strong>belakang</strong> antrian.';
    if (algo === 'dfs') s += ' Anak masuk ke <strong>puncak</strong> tumpukan, abjad pertama paling atas.';
    if (algo === 'astar' || algo === 'gbfs') {
        s += ' Open diurutkan ulang menurut ' + A.sortBy + '.';
        const goalKid = st.children.find(id => N[id].state === GRAPH.goal);
        if (goalKid != null && algo === 'astar') {
            if (st.open[0] === goalKid) s += ' <b>' + GRAPH.goal + '</b> masuk Open (' + A.keyTxt(N[goalKid]) + ') dan f-nya terkecil di Open, jadi diambil pada langkah berikutnya. Saat diambil itulah A* berhenti.';
            else s += ' <b>' + GRAPH.goal + '</b> sudah masuk Open (' + A.keyTxt(N[goalKid]) + '), tetapi A* <em>belum</em> berhenti: uji tujuan baru dilakukan saat ' + GRAPH.goal + ' diambil dari Open, karena masih ada simpul dengan f lebih kecil.';
        }
        if (goalKid != null && algo === 'gbfs') s += ' <b>' + GRAPH.goal + '</b> masuk Open dengan h = 0, jadi langsung berada di depan antrian.';
    }
    if (algo === 'ucs') {
        s += ' Open diurutkan ulang menurut g.';
        const goalKid = st.children.find(id => N[id].state === GRAPH.goal);
        if (goalKid != null) s += ' <b>' + GRAPH.goal + '</b> sudah masuk Open, tetapi UCS <em>belum</em> berhenti: uji tujuan baru dilakukan saat ' + GRAPH.goal + ' diambil dari Open, karena mungkin masih ada lintasan yang lebih murah.';
    }
    if (algo === 'dfs') {
        const goalKid = st.children.find(id => N[id].state === GRAPH.goal);
        if (goalKid != null && st.children[0] !== goalKid) s += ' <b>' + GRAPH.goal + '</b> sudah dibangkitkan, tetapi bukan di puncak tumpukan, jadi DFS lebih dulu turun ke <b>' + N[st.children[0]].state + '</b>.';
    }
    return s;
}

function chips(r, ids, cls, A, markFirst) {
    if (!ids.length) return '<span class="empty">kosong</span>';
    return ids.map((id, i) => {
        const n = r.nodes[id];
        return '<span class="chip ' + cls + (markFirst && i === 0 ? ' chip-next' : '') + '" title="Lintasan ' + pathText(n) + '">' +
            '<span><b>' + n.state + '</b>' + (A.val ? '(' + A.val(n) + ')' : '') + '</span><small>' + pathText(n) + '</small></span>';
    }).join('');
}

// ================================================================
// Stepper
// ================================================================
function buildStepper(el, algo) {
    const r = runSearch(algo), A = ALGO[algo];
    const last = r.steps.length - 1;
    el.innerHTML =
        '<div class="ss-grid">' +
            '<div class="ss-panel"><h5>Graf soal — lintasan simpul yang diambil</h5><div class="ss-graph"></div></div>' +
            '<div class="ss-panel"><h5>Pohon pencarian ' + A.name + '</h5><div class="ss-tree" style="overflow-x:auto;"></div></div>' +
        '</div>' +
        '<div class="legend">' +
            '<div class="legend-item"><div class="legend-dot" style="background:#e65100;"></div>Sedang diambil</div>' +
            '<div class="legend-item"><div class="legend-ring"></div>Baru dibangkitkan</div>' +
            '<div class="legend-item"><div class="legend-dot" style="background:#7986cb;"></div>Sudah diekspansi (Closed)</div>' +
            '<div class="legend-item"><div class="legend-dot" style="background:#f9a825;"></div>Di Open</div>' +
            '<div class="legend-item"><div class="legend-dot" style="background:#90a4ae;"></div>Buntu</div>' +
            '<div class="legend-item"><div class="legend-dot" style="background:#2e7d32;"></div>Tujuan</div>' +
        '</div>' +
        '<div class="ss-lists">' +
            '<div class="ss-list"><div class="lbl">' + A.openLbl + '</div><div class="chips ss-open"></div></div>' +
            '<div class="ss-list"><div class="lbl">Closed — sudah diekspansi</div><div class="chips ss-closed"></div></div>' +
        '</div>' +
        '<div class="stepper-controls">' +
            '<button type="button" class="ts-btn ts-prev"><i class="fa-solid fa-backward-step"></i> Sebelumnya</button>' +
            '<button type="button" class="ts-btn ts-next">Berikutnya <i class="fa-solid fa-forward-step"></i></button>' +
            '<button type="button" class="ts-btn ts-reset"><i class="fa-solid fa-rotate-left"></i> Ulang</button>' +
            '<span class="ts-counter"></span>' +
        '</div>' +
        '<div class="step-box"><span class="ts-note"></span></div>';

    let k = 0;
    const q = sel => el.querySelector(sel);
    function render() {
        const st = r.steps[k];
        const done = st.kind === 'goal' || st.kind === 'goal-gen';
        let hl = null;
        if (done) { const g = r.nodes[st.goal]; hl = { path: g.path, cur: g.state, final: true }; }
        else if (st.cur != null) { const c = r.nodes[st.cur]; hl = { path: c.path, cur: c.state, final: false }; }
        else hl = { path: [GRAPH.start], cur: GRAPH.start, final: false };
        q('.ss-graph').innerHTML = graphSVG(hl);
        q('.ss-tree').innerHTML = treeSVG(r.nodes, { showG: A.showG, lines: A.lines, lineCount: A.lineCount, levels: true, view: id => nodeView(r, k, id) });
        q('.ss-open').innerHTML = done && st.kind === 'goal' && !st.open.length ? '<span class="empty">—</span>' : chips(r, st.open, 'chip-open', A, !done);
        q('.ss-closed').innerHTML = chips(r, st.closed, 'chip-closed', A, false);
        q('.ts-note').innerHTML = noteFor(algo, r, k);
        q('.ts-counter').textContent = 'Langkah ' + k + ' / ' + last;
        q('.ts-prev').disabled = k === 0;
        q('.ts-next').disabled = k === last;
    }
    q('.ts-prev').addEventListener('click', () => { if (k > 0) { k--; render(); } });
    q('.ts-next').addEventListener('click', () => { if (k < last) { k++; render(); } });
    q('.ts-reset').addEventListener('click', () => { k = 0; render(); });
    render();
}

function buildTrace(table, algo) {
    const r = runSearch(algo), A = ALGO[algo];
    const lbl = id => '<span class="nl">' + nodeLabel(r, id, A) + '<i>' + pathText(r.nodes[id]) + '</i></span>';
    const openHead = { ucs: 'Open sesudahnya (urut g)', bfs: 'Open sesudahnya (antrian, kiri = depan)', dfs: 'Open sesudahnya (tumpukan, kiri = puncak)', astar: 'Open sesudahnya (urut f = g + h)', gbfs: 'Open sesudahnya (urut h)' }[algo];
    let h = '<thead><tr><th>Langkah</th><th>Diambil</th><th>Anak dibangkitkan</th><th>' + openHead + '</th><th>Closed</th></tr></thead><tbody>';
    r.steps.forEach((st, k) => {
        const done = st.kind === 'goal' || st.kind === 'goal-gen';
        const cls = done ? ' class="tr-goal"' : (st.tieWith && st.tieWith.length ? ' class="tr-tie"' : '');
        let kids;
        if (st.kind === 'start') kids = '—';
        else if (st.kind === 'goal') kids = '<i class="fa-solid fa-check" style="color:#2e7d32;"></i> <strong>Tujuan diambil, berhenti</strong>';
        else if (st.kind === 'dead') kids = '<em>tidak ada (buntu)</em>';
        else kids = st.children.map(lbl).join(' ') + (st.kind === 'goal-gen' ? ' <i class="fa-solid fa-check" style="color:#2e7d32;"></i> <strong>' + GRAPH.goal + ' tujuan, berhenti</strong>' : '');
        const taken = st.cur == null ? '—' : lbl(st.cur) + (st.tieWith && st.tieWith.length ? '<br><small style="color:#e65100;">seri → abjad</small>' : '');
        h += '<tr' + cls + '><td>' + k + '</td><td>' + taken + '</td><td>' + kids + '</td><td>' +
             (st.open.length ? st.open.map(lbl).join(' ') : '—') + '</td><td>' +
             (st.closed.length ? st.closed.map(id => r.nodes[id].state).join(', ') : '—') + '</td></tr>';
    });
    table.innerHTML = h + '</tbody>';
}

// ================================================================
// Hill Climbing
// ================================================================
function hcCostText(path) {
    const parts = [];
    for (let i = 1; i < path.length; i++) parts.push(edgeCost(path[i - 1], path[i]));
    return parts.join(' + ') + ' = ' + parts.reduce((a, b) => a + b, 0);
}

function hcNote(mode, r, k) {
    const st = r.steps[k];
    if (st.kind === 'goal') {
        return '<strong>Langkah ' + (k + 1) + '.</strong> Posisi sekarang <b>' + st.cur + '</b> (h = ' + st.h + ') adalah tujuan, HC <strong>berhenti</strong>. Lintasan: <strong>' + st.path.join(' → ') + '</strong>, biaya ' + hcCostText(st.path) + '.';
    }
    let s = '<strong>Langkah ' + (k + 1) + '.</strong> Posisi sekarang <b>' + st.cur + '</b> (h = ' + st.h + '). ';
    if (mode === 'simple') {
        const parts = st.checked.map(x => {
            const nb = st.nbs.find(o => o.s === x);
            return '<b>' + nb.s + '</b> (h = ' + nb.h + ') ' + (nb.better ? 'lebih kecil dari ' + st.h + ' → <strong>lebih baik</strong>' : 'tidak lebih kecil dari ' + st.h);
        });
        s += 'Tetangga dicoba menurut abjad: ' + parts.join('; ') + '.';
        const rest = st.nbs.map(o => o.s).filter(x => !st.checked.includes(x));
        if (st.chosen) {
            s += ' Tetangga pertama yang lebih baik langsung dipilih' + (rest.length ? ', jadi ' + listStates(rest) + ' tidak perlu diperiksa' : '') + '. Pindah ke <b>' + st.chosen + '</b>.';
        } else {
            s += ' Tidak ada tetangga dengan h lebih kecil dari ' + st.h + ', HC <strong>terjebak</strong> di <b>' + st.cur + '</b> (local optimum).';
        }
    } else {
        s += 'Semua tetangga dinilai: ' + st.nbs.map(o => '<b>' + o.s + '</b> (h = ' + o.h + ')').join(', ') + '.';
        if (st.chosen) {
            const ch = st.nbs.find(o => o.s === st.chosen);
            const ties = st.nbs.filter(o => o.better && o.h === ch.h && o.s !== ch.s).map(o => o.s);
            s += ' Yang h-nya paling kecil adalah <b>' + ch.s + '</b> (h = ' + ch.h + '), lebih kecil dari ' + st.h + ' → pindah ke <b>' + ch.s + '</b>.';
            if (ties.length) s += ' Seri dengan ' + listStates(ties) + ', dipilih huruf yang lebih awal.';
        } else {
            s += ' Tidak ada tetangga dengan h lebih kecil dari ' + st.h + ', HC <strong>terjebak</strong> di <b>' + st.cur + '</b> (local optimum).';
        }
    }
    return s;
}

function hcEvalHTML(mode, st) {
    if (st.kind === 'goal') return '<div class="hc-head">Posisi sekarang: <b>' + st.cur + '</b> (h = ' + st.h + ')</div><div class="hc-row ok"><i class="fa-solid fa-flag-checkered"></i> Tujuan tercapai, HC berhenti.</div>';
    let h = '<div class="hc-head">Posisi sekarang: <b>' + st.cur + '</b> (h = ' + st.h + ')</div>';
    st.nbs.forEach(o => {
        const seen = st.checked.includes(o.s);
        let cls, txt;
        if (!seen) { cls = 'skip'; txt = 'tidak diperiksa'; }
        else if (st.chosen === o.s) { cls = 'pick'; txt = '<i class="fa-solid fa-check"></i> ' + (mode === 'simple' ? 'lebih baik, pertama → dipilih' : 'terbaik → dipilih'); }
        else if (o.better) { cls = 'ok'; txt = '<i class="fa-solid fa-check"></i> lebih baik, tetapi bukan yang terbaik'; }
        else { cls = 'no'; txt = '<i class="fa-solid fa-xmark"></i> tidak lebih baik (h ≥ ' + st.h + ')'; }
        h += '<div class="hc-row ' + cls + '"><b>' + o.s + '</b><span class="hv">h = ' + o.h + '</span><span class="hs">' + txt + '</span></div>';
    });
    if (!st.chosen) h += '<div class="hc-row stuck"><i class="fa-solid fa-ban"></i> Tidak ada yang lebih baik: terjebak.</div>';
    return h;
}

function buildHCStepper(el, mode) {
    const r = runHC(mode === 'steep');
    const last = r.steps.length - 1;
    el.innerHTML =
        '<div class="ss-grid">' +
            '<div class="ss-panel"><h5>Graf soal — posisi sekarang dan tetangga yang dinilai</h5><div class="ss-graph"></div></div>' +
            '<div class="ss-panel"><h5>Penilaian tetangga (urut abjad)</h5><div class="hc-eval"></div></div>' +
        '</div>' +
        '<div class="legend">' +
            '<div class="legend-item"><div class="legend-dot" style="background:#e65100;"></div>Posisi sekarang</div>' +
            '<div class="legend-item"><div class="legend-dot" style="background:#7986cb;"></div>Sudah dilewati</div>' +
            '<div class="legend-item"><div class="legend-ring"></div>Tetangga yang dinilai</div>' +
            '<div class="legend-item"><div class="legend-ring ok"></div>Tetangga yang dipilih</div>' +
            '<div class="legend-item"><div class="legend-dot" style="background:#2e7d32;"></div>Tujuan</div>' +
        '</div>' +
        '<div class="stepper-controls">' +
            '<button type="button" class="ts-btn ts-prev"><i class="fa-solid fa-backward-step"></i> Sebelumnya</button>' +
            '<button type="button" class="ts-btn ts-next">Berikutnya <i class="fa-solid fa-forward-step"></i></button>' +
            '<button type="button" class="ts-btn ts-reset"><i class="fa-solid fa-rotate-left"></i> Ulang</button>' +
            '<span class="ts-counter"></span>' +
        '</div>' +
        '<div class="step-box"><span class="ts-note"></span></div>';
    let k = 0;
    const q = sel => el.querySelector(sel);
    function render() {
        const st = r.steps[k];
        const ring = {};
        st.checked.forEach(x => { ring[x] = x === st.chosen ? 'ok' : ''; });
        q('.ss-graph').innerHTML = graphSVG({ path: st.path, cur: st.cur, final: st.kind === 'goal', ring });
        q('.hc-eval').innerHTML = hcEvalHTML(mode, st);
        q('.ts-note').innerHTML = hcNote(mode, r, k);
        q('.ts-counter').textContent = 'Langkah ' + (k + 1) + ' / ' + (last + 1);
        q('.ts-prev').disabled = k === 0;
        q('.ts-next').disabled = k === last;
    }
    q('.ts-prev').addEventListener('click', () => { if (k > 0) { k--; render(); } });
    q('.ts-next').addEventListener('click', () => { if (k < last) { k++; render(); } });
    q('.ts-reset').addEventListener('click', () => { k = 0; render(); });
    render();
}

function buildHCTrace(table, mode) {
    const r = runHC(mode === 'steep');
    let h = '<thead><tr><th>Langkah</th><th>Posisi (h)</th><th>Tetangga menurut abjad, dengan h</th><th>Keputusan</th></tr></thead><tbody>';
    r.steps.forEach((st, k) => {
        const done = st.kind === 'goal';
        let nbs = '—', dec;
        if (!done) {
            nbs = st.nbs.map(o => {
                const seen = st.checked.includes(o.s);
                const mark = !seen ? '' : (o.better ? ' <i class="fa-solid fa-check" style="color:#2e7d32;"></i>' : ' <i class="fa-solid fa-xmark" style="color:#c62828;"></i>');
                return '<span class="nl' + (seen ? '' : ' unseen') + '"><b>' + o.s + '</b>(' + o.h + ')' + mark + '</span>';
            }).join(' ');
        }
        if (done) dec = '<i class="fa-solid fa-check" style="color:#2e7d32;"></i> <strong>Tujuan, berhenti</strong>';
        else if (st.chosen) dec = 'Pindah ke <b>' + st.chosen + '</b>';
        else dec = '<strong>Terjebak</strong> (local optimum)';
        h += '<tr' + (done ? ' class="tr-goal"' : '') + '><td>' + (k + 1) + '</td><td><b>' + st.cur + '</b> (' + st.h + ')</td><td>' + nbs + '</td><td>' + dec + '</td></tr>';
    });
    table.innerHTML = h + '</tbody>';
}

function finalPathFor(algo) {
    if (algo === 'hc' || algo === 'sthc') { const r = runHC(algo === 'sthc'); return { path: r.path, cost: r.cost, reached: r.reached }; }
    const r = runSearch(algo), n = r.nodes[r.goal];
    return { path: n.path, cost: n.g };
}

document.querySelectorAll('.graph-static').forEach(el => { el.innerHTML = graphSVG(null); });

document.querySelectorAll('.full-tree').forEach(el => {
    const nodes = fullTree();
    el.innerHTML = treeSVG(nodes, {
        gap: +el.dataset.gap || 58, showG: true, levels: true,
        view: id => nodes[id].state === GRAPH.goal
            ? { cls: 'node-goal', tag: 'tujuan', tagColor: '#2e7d32' }
            : (nodes.some(m => m.parent === id) ? { cls: 'node-default' } : { cls: 'node-dead', tag: 'buntu', tagColor: '#78909c' })
    });
});

document.querySelectorAll('.search-stepper').forEach(el => buildStepper(el, el.dataset.algo));
document.querySelectorAll('[data-trace-for]').forEach(t => buildTrace(t, t.dataset.traceFor));
document.querySelectorAll('.final-tree').forEach(el => {
    const algo = el.dataset.algo, r = runSearch(algo), k = r.steps.length - 1;
    el.innerHTML = treeSVG(r.nodes, { gap: 52, showG: algo === 'ucs', lines: ALGO[algo].lines, lineCount: ALGO[algo].lineCount, view: id => nodeView(r, k, id) });
    el.querySelectorAll('.t-new').forEach(c => c.remove());
});

document.querySelectorAll('.hc-stepper').forEach(el => buildHCStepper(el, el.dataset.mode));
document.querySelectorAll('[data-hc-trace]').forEach(t => buildHCTrace(t, t.dataset.hcTrace));
document.querySelectorAll('.final-graph').forEach(el => {
    const f = finalPathFor(el.dataset.algo);
    const stuck = f.reached === false;
    el.innerHTML = graphSVG({ path: f.path, cur: stuck ? f.path[f.path.length - 1] : GRAPH.goal, final: !stuck });
});
