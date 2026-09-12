/*!
 * aima-viz.js — Visualisasi interaktif untuk materi Kecerdasan Buatan (MKL1303131)
 *
 * Ide visualisasi diadaptasi dari "AIMA Visualizations" karya Sebastian Urrea
 *   https://github.com/jsurrea/aima-visualizations — MIT License, (c) 2026 Sebastian Urrea
 * Data peta Romania (jarak jalan dan koordinat kota) dari aima-python
 *   https://github.com/aimacode/aima-python — MIT License, (c) 2016 aima-python contributors
 * Nilai jarak garis lurus (SLD) ke Bucharest dari Russell & Norvig (2021), AIMA edisi 4, Bab 3.
 *
 * Pemakaian: tempatkan elemen <div data-viz="..."> di halaman, lalu muat berkas ini.
 *   data-viz="romania-map"     peta statis            (data-show-h="true" untuk menampilkan h)
 *   data-viz="search"          penelusur langkah demi langkah
 *                              (data-algo, data-algos="bfs,dfs,dls,ids,ucs,greedy,astar")
 *   data-viz="search-compare"  tabel adu algoritma     (data-algos)
 *   data-viz="grid-lab"        lab heuristik berbasis grid (data-heuristic, data-weight)
 *   data-viz="vacuum"          dunia penyedot debu     (data-agents="reflex" | "reflex,model" | "hunter")
 */
(function () {
    'use strict';

    /* =====================================================================
     * 1. DATA PETA ROMANIA
     * ===================================================================== */
    const ROADS = [
        ['Arad', 'Zerind', 75], ['Arad', 'Sibiu', 140], ['Arad', 'Timisoara', 118],
        ['Bucharest', 'Urziceni', 85], ['Bucharest', 'Pitesti', 101],
        ['Bucharest', 'Giurgiu', 90], ['Bucharest', 'Fagaras', 211],
        ['Craiova', 'Drobeta', 120], ['Craiova', 'Rimnicu', 146], ['Craiova', 'Pitesti', 138],
        ['Drobeta', 'Mehadia', 75], ['Eforie', 'Hirsova', 86], ['Fagaras', 'Sibiu', 99],
        ['Hirsova', 'Urziceni', 98], ['Iasi', 'Vaslui', 92], ['Iasi', 'Neamt', 87],
        ['Lugoj', 'Timisoara', 111], ['Lugoj', 'Mehadia', 70],
        ['Oradea', 'Zerind', 71], ['Oradea', 'Sibiu', 151],
        ['Pitesti', 'Rimnicu', 97], ['Rimnicu', 'Sibiu', 80], ['Urziceni', 'Vaslui', 142]
    ];
    const LOC = {
        Arad: [91, 492], Bucharest: [400, 327], Craiova: [253, 288], Drobeta: [165, 299],
        Eforie: [562, 293], Fagaras: [305, 449], Giurgiu: [375, 270], Hirsova: [534, 350],
        Iasi: [473, 506], Lugoj: [165, 379], Mehadia: [168, 339], Neamt: [406, 537],
        Oradea: [131, 571], Pitesti: [320, 368], Rimnicu: [233, 410], Sibiu: [207, 457],
        Timisoara: [94, 410], Urziceni: [456, 350], Vaslui: [509, 444], Zerind: [108, 531]
    };
    const SLD_BUCHAREST = {
        Arad: 366, Bucharest: 0, Craiova: 160, Drobeta: 242, Eforie: 161, Fagaras: 176,
        Giurgiu: 77, Hirsova: 151, Iasi: 226, Lugoj: 244, Mehadia: 241, Neamt: 234,
        Oradea: 380, Pitesti: 100, Rimnicu: 193, Sibiu: 253, Timisoara: 329,
        Urziceni: 80, Vaslui: 199, Zerind: 374
    };
    // Posisi label kota relatif terhadap titik kota: [dx, dy, text-anchor]
    const LABEL = {
        Arad: [-13, 4, 'end'], Bucharest: [10, 22, 'start'], Craiova: [0, 25, 'middle'],
        Drobeta: [-13, 4, 'end'], Eforie: [13, 4, 'start'], Fagaras: [0, -15, 'middle'],
        Giurgiu: [13, 4, 'start'], Hirsova: [13, 4, 'start'], Iasi: [13, 4, 'start'],
        Lugoj: [13, 5, 'start'], Mehadia: [13, 7, 'start'], Neamt: [-13, 4, 'end'],
        Oradea: [13, -3, 'start'], Pitesti: [0, -15, 'middle'], Rimnicu: [-13, 4, 'end'],
        Sibiu: [0, -15, 'middle'], Timisoara: [0, 25, 'middle'], Urziceni: [0, 25, 'middle'],
        Vaslui: [13, 4, 'start'], Zerind: [13, 4, 'start']
    };

    function makeRomania() {
        const adj = {};
        ROADS.forEach(([a, b, c]) => {
            (adj[a] = adj[a] || {})[b] = c;
            (adj[b] = adj[b] || {})[a] = c;
        });
        const cities = Object.keys(adj).sort();
        return {
            cities,
            adj,
            // Tetangga diurutkan menurut abjad (konvensi AIMA)
            neighbors: s => Object.keys(adj[s]).sort().map(t => [t, adj[s][t]]),
            // Tujuan Bucharest memakai tabel SLD buku; tujuan lain memakai jarak Euclid
            // dari koordinat peta (dibulatkan ke bawah agar tetap admissible & konsisten).
            heuristic(goal) {
                if (goal === 'Bucharest') return s => SLD_BUCHAREST[s];
                const [gx, gy] = LOC[goal];
                return s => Math.floor(Math.hypot(LOC[s][0] - gx, LOC[s][1] - gy));
            }
        };
    }
    const ROMANIA = makeRomania();

    function shortestCost(graph, start, goal) {
        const dist = {};
        graph.cities.forEach(c => { dist[c] = Infinity; });
        dist[start] = 0;
        const done = new Set();
        while (done.size < graph.cities.length) {
            let u = null;
            graph.cities.forEach(c => { if (!done.has(c) && (u === null || dist[c] < dist[u])) u = c; });
            if (dist[u] === Infinity) break;
            done.add(u);
            graph.neighbors(u).forEach(([v, c]) => { dist[v] = Math.min(dist[v], dist[u] + c); });
        }
        return dist[goal];
    }

    /* =====================================================================
     * 2. MESIN PENCARIAN — menghasilkan rekaman langkah (snapshot)
     * ===================================================================== */
    const ALGOS = {
        bfs:    { label: 'BFS — Breadth-First',       structure: 'queue' },
        dfs:    { label: 'DFS — Depth-First',         structure: 'stack' },
        dls:    { label: 'DLS — Depth-Limited',       structure: 'stack' },
        ids:    { label: 'IDS — Iterative Deepening', structure: 'stack' },
        ucs:    { label: 'UCS — Uniform Cost',        structure: 'pq' },
        greedy: { label: 'Greedy Best-First',         structure: 'pq', informed: true },
        astar:  { label: 'A*',                        structure: 'pq', informed: true }
    };
    const SHORT = { bfs: 'BFS', dfs: 'DFS', dls: 'DLS', ids: 'IDS', ucs: 'UCS', greedy: 'Greedy', astar: 'A*' };

    function runSearch(graph, algo, start, goal, limit) {
        const h = graph.heuristic(goal);
        const steps = [];
        const isStack = ALGOS[algo].structure === 'stack';
        let frontier = [];
        let visited = [];
        let expanded = 0, generated = 0, maxFrontier = 0, seq = 0;
        let iteration = null;

        const mk = (state, parent, g) => {
            generated++;
            return { state, parent, g, depth: parent ? parent.depth + 1 : 0, seq: seq++ };
        };
        const pathOf = n => { const p = []; for (; n; n = n.parent) p.unshift(n.state); return p; };
        const onPath = (n, s) => { for (; n; n = n.parent) if (n.state === s) return true; return false; };
        const inFrontier = s => frontier.find(n => n.state === s);
        const isVisited = s => visited.some(n => n.state === s);
        const b = s => '<b>' + s + '</b>';
        const list = arr => arr.map(b).join(', ');

        const key = { ucs: n => n.g, greedy: n => h(n.state), astar: n => n.g + h(n.state) }[algo];
        const sortFrontier = () => {
            if (!key) return;
            frontier.sort((x, y) => key(x) - key(y) ||
                (algo === 'astar' ? h(x.state) - h(y.state) : 0) || x.seq - y.seq);
        };
        const metric = n => algo === 'ucs' ? 'g = ' + n.g
            : algo === 'greedy' ? 'h = ' + h(n.state)
            : 'f = ' + n.g + ' + ' + h(n.state) + ' = ' + (n.g + h(n.state));

        const snap = (kind, current, msg, extra) => {
            maxFrontier = Math.max(maxFrontier, frontier.length);
            const shown = isStack ? frontier.slice().reverse() : frontier.slice();
            const tree = [];
            visited.concat(frontier).forEach(n => { if (n.parent) tree.push([n.parent.state, n.state]); });
            steps.push(Object.assign({
                kind, current, msg, iteration,
                frontier: shown.map(n => ({ s: n.state, g: n.g, h: h(n.state), d: n.depth })),
                explored: visited.map(n => n.state),
                tree, expanded, generated, maxFrontier
            }, extra || {}));
        };
        const goalSnap = (node, msg) => snap('goal', node.state, msg,
            { path: pathOf(node), cost: node.g, found: true });

        const skippedText = (skipped, why) => skipped.length
            ? ' Dilewati: ' + list(skipped) + ' (' + why + ').' : '';
        const skipText = (done, fr, frWhy) =>
            (done.length ? ' Dilewati karena sudah diekspansi: ' + list(done) + '.' : '') +
            (fr.length ? ' Sudah ada di frontier' + (frWhy || '') + ': ' + list(fr) + '.' : '');

        /* ---------- BFS: antrian FIFO, uji tujuan saat dibangkitkan ---------- */
        if (algo === 'bfs') {
            const root = mk(start, null, 0);
            frontier = [root];
            if (start === goal) {
                goalSnap(root, 'Keadaan awal sudah merupakan tujuan.');
                return steps;
            }
            snap('init', null, 'Simpul awal ' + b(start) + ' dimasukkan ke antrian frontier.');
            while (frontier.length) {
                const node = frontier.shift();
                visited.push(node);
                expanded++;
                const added = [], done = [], fr = [];
                for (const [t, c] of graph.neighbors(node.state)) {
                    if (isVisited(t)) { done.push(t); continue; }
                    if (inFrontier(t)) { fr.push(t); continue; }
                    const child = mk(t, node, node.g + c);
                    frontier.push(child);
                    if (t === goal) {
                        goalSnap(child, 'Ambil ' + b(node.state) + ' dari depan antrian lalu ekspansi. ' +
                            'Anak ' + b(t) + ' adalah tujuan. BFS menguji tujuan saat simpul ' +
                            '<em>dibangkitkan</em>, sehingga pencarian langsung berhenti.');
                        return steps;
                    }
                    added.push(t);
                }
                snap('expand', node.state, 'Ambil ' + b(node.state) + ' dari <em>depan</em> antrian lalu ekspansi. ' +
                    (added.length ? 'Masuk ke <em>belakang</em> antrian: ' + list(added) + '.' : 'Tidak ada anak baru.') +
                    skipText(done, fr));
            }
            snap('fail', null, 'Frontier kosong: tidak ada lintasan ke tujuan.', { found: false });
            return steps;
        }

        /* ---------- DFS: tumpukan LIFO dengan explored set ---------- */
        if (algo === 'dfs') {
            frontier = [mk(start, null, 0)];
            snap('init', null, 'Simpul awal ' + b(start) + ' dimasukkan ke tumpukan frontier.');
            while (frontier.length) {
                const node = frontier.pop();
                if (node.state === goal) {
                    visited.push(node);
                    goalSnap(node, 'Ambil ' + b(node.state) + ' dari puncak tumpukan: ini tujuan. Selesai.');
                    return steps;
                }
                visited.push(node);
                expanded++;
                const added = [], done = [], fr = [];
                for (const [t, c] of graph.neighbors(node.state)) {
                    if (isVisited(t)) { done.push(t); continue; }
                    if (inFrontier(t)) { fr.push(t); continue; }
                    added.push(mk(t, node, node.g + c));
                }
                for (let i = added.length - 1; i >= 0; i--) frontier.push(added[i]);
                snap('expand', node.state, 'Ambil ' + b(node.state) + ' dari <em>puncak</em> tumpukan lalu ekspansi. ' +
                    (added.length ? 'Masuk ke puncak tumpukan: ' + list(added.map(n => n.state)) +
                        ' (anak pertama menurut abjad berada paling atas).' : 'Tidak ada anak baru — mundur (backtrack).') +
                    skipText(done, fr));
            }
            snap('fail', null, 'Frontier kosong: tidak ada lintasan ke tujuan.', { found: false });
            return steps;
        }

        /* ---------- DLS & IDS: pencarian pohon berbatas kedalaman ---------- */
        if (algo === 'dls' || algo === 'ids') {
            const dls = L => {
                frontier = [mk(start, null, 0)];
                visited = [];
                let cutoff = false;
                while (frontier.length) {
                    const node = frontier.pop();
                    if (node.state === goal) {
                        visited.push(node);
                        goalSnap(node, 'Ambil ' + b(node.state) + ' dari puncak tumpukan: ini tujuan (kedalaman ' +
                            node.depth + ' ≤ ℓ = ' + L + '). Selesai.');
                        return 'goal';
                    }
                    visited.push(node);
                    if (node.depth >= L) {
                        cutoff = true;
                        snap('cutoff', node.state, b(node.state) + ' berada di kedalaman ' + node.depth +
                            ' = batas ℓ, sehingga <em>tidak</em> diekspansi (cutoff).');
                        continue;
                    }
                    expanded++;
                    const added = [], skipped = [];
                    for (const [t, c] of graph.neighbors(node.state)) {
                        if (onPath(node, t)) { skipped.push(t); continue; }
                        added.push(mk(t, node, node.g + c));
                    }
                    for (let i = added.length - 1; i >= 0; i--) frontier.push(added[i]);
                    snap('expand', node.state, 'Ambil ' + b(node.state) + ' (kedalaman ' + node.depth +
                        ') dari puncak tumpukan lalu ekspansi. ' +
                        (added.length ? 'Masuk ke puncak tumpukan: ' + list(added.map(n => n.state)) + '.' : 'Tidak ada anak baru.') +
                        skippedText(skipped, 'sudah ada di lintasan ini, mencegah siklus'));
                }
                return cutoff ? 'cutoff' : 'failure';
            };

            if (algo === 'dls') {
                frontier = [mk(start, null, 0)];
                generated = 0;
                snap('init', null, 'DLS dengan batas kedalaman ℓ = ' + limit + '. Simpul awal ' + b(start) +
                    ' (kedalaman 0) dimasukkan ke tumpukan.');
                const r = dls(limit);
                if (r !== 'goal') {
                    frontier = [];
                    snap('fail', null, r === 'cutoff'
                        ? 'Tumpukan kosong dan terjadi <em>cutoff</em>: tujuan tidak ditemukan dalam batas ℓ = ' +
                          limit + '. Coba perbesar ℓ — atau pakai IDS agar ℓ naik otomatis.'
                        : 'Tumpukan kosong tanpa cutoff: tidak ada lintasan ke tujuan.', { found: false, cutoff: r === 'cutoff' });
                }
                return steps;
            }

            for (let L = 0; L <= 20; L++) {
                iteration = L;
                frontier = [];
                visited = [];
                snap('iter', null, '<b>Iterasi ℓ = ' + L + '</b>: mulai lagi dari ' + b(start) +
                    ' dengan batas kedalaman ' + L + '. Hasil iterasi sebelumnya dibuang.');
                const r = dls(L);
                if (r === 'goal') return steps;
                if (r === 'failure') {
                    frontier = [];
                    snap('fail', null, 'Tidak terjadi cutoff: seluruh ruang keadaan sudah diperiksa dan tujuan tidak ada.',
                        { found: false });
                    return steps;
                }
            }
            return steps;
        }

        /* ---------- UCS, Greedy, A*: antrian prioritas, uji tujuan saat diambil ---------- */
        frontier = [mk(start, null, 0)];
        const orderBy = { ucs: 'g(n)', greedy: 'h(n)', astar: 'f(n) = g(n) + h(n)' }[algo];
        snap('init', null, 'Simpul awal ' + b(start) + ' (' + metric(frontier[0]) +
            ') dimasukkan ke antrian prioritas yang diurutkan menurut ' + orderBy + '.');
        while (frontier.length) {
            sortFrontier();
            const node = frontier.shift();
            if (node.state === goal) {
                visited.push(node);
                goalSnap(node, 'Ambil ' + b(node.state) + ' (' + metric(node) + ', terkecil di frontier). ' +
                    'Ini tujuan. ' + SHORT[algo] + ' menguji tujuan saat simpul <em>diambil</em> dari frontier' +
                    (algo === 'greedy' ? ' — tetapi biaya lintasan tidak pernah diperhitungkan.'
                        : ', sehingga tidak ada lintasan lain yang lebih murah.'));
                return steps;
            }
            visited.push(node);
            expanded++;
            const added = [], updated = [], done = [], fr = [];
            for (const [t, c] of graph.neighbors(node.state)) {
                if (isVisited(t)) { done.push(t); continue; }
                const g = node.g + c;
                const ex = inFrontier(t);
                if (ex) {
                    if (algo !== 'greedy' && g < ex.g) {
                        frontier[frontier.indexOf(ex)] = mk(t, node, g);
                        updated.push(b(t) + ': g ' + ex.g + ' → ' + g);
                    } else {
                        fr.push(t);
                    }
                    continue;
                }
                const child = mk(t, node, g);
                frontier.push(child);
                added.push(b(t) + ' (' + metric(child) + ')');
            }
            sortFrontier();
            snap('expand', node.state, 'Ambil ' + b(node.state) + ' (' + metric(node) + ', terkecil di frontier) lalu ekspansi. ' +
                (added.length ? 'Masuk frontier: ' + added.join(', ') + '.' : updated.length ? '' : 'Tidak ada anak baru.') +
                (updated.length ? (added.length ? ' ' : '') + 'Diperbarui karena ditemukan lintasan lebih murah: ' + updated.join('; ') + '.' : '') +
                skipText(done, fr, algo === 'greedy' ? '' : ' dengan g yang sama atau lebih murah'));
        }
        snap('fail', null, 'Frontier kosong: tidak ada lintasan ke tujuan.', { found: false });
        return steps;
    }

    /* =====================================================================
     * 3. MESIN GRID (lab heuristik)
     * ===================================================================== */
    const GRID_H = {
        zero:      { label: 'h = 0 (tanpa heuristik, setara UCS)', f: () => 0 },
        euclid:    { label: 'Garis lurus (Euclid)', f: (dx, dy) => Math.hypot(dx, dy) },
        manhattan: { label: 'Manhattan', f: (dx, dy) => dx + dy },
        weighted:  { label: 'Manhattan × w (tidak admissible jika w > 1)', f: (dx, dy, w) => w * (dx + dy) }
    };

    function gridHeuristic(G, name, w) {
        const gc = G.goal % G.cols, gr = Math.floor(G.goal / G.cols);
        return i => GRID_H[name].f(Math.abs(i % G.cols - gc), Math.abs(Math.floor(i / G.cols) - gr), w);
    }

    function gridNeighbors(G, i) {
        const c = i % G.cols, r = Math.floor(i / G.cols), out = [];
        if (r > 0) out.push(i - G.cols);
        if (c < G.cols - 1) out.push(i + 1);
        if (r < G.rows - 1) out.push(i + G.cols);
        if (c > 0) out.push(i - 1);
        return out.filter(j => !G.walls.has(j));
    }

    // Biaya sebenarnya h*(n) dari setiap petak ke tujuan (BFS mundur, biaya langkah = 1)
    function gridTrueCost(G) {
        const d = new Array(G.cols * G.rows).fill(Infinity);
        d[G.goal] = 0;
        const q = [G.goal];
        while (q.length) {
            const u = q.shift();
            gridNeighbors(G, u).forEach(v => { if (d[v] === Infinity) { d[v] = d[u] + 1; q.push(v); } });
        }
        return d;
    }

    function gridSearch(G, algo, hname, w) {
        const h = gridHeuristic(G, hname, w);
        const open = [];
        const bestG = new Map();
        const closed = new Set();
        const steps = [];
        let seq = 0;
        const push = (i, g, parent) => { open.push({ i, g, parent, seq: seq++ }); bestG.set(i, g); };
        const key = algo === 'greedy' ? n => h(n.i) : n => n.g + h(n.i);
        push(G.start, 0, null);
        while (open.length) {
            open.sort((a, b) => key(a) - key(b) || h(a.i) - h(b.i) || a.seq - b.seq);
            const node = open.shift();
            if (closed.has(node.i)) continue;
            if (node.i === G.goal) {
                const path = [];
                for (let n = node; n; n = n.parent) path.unshift(n.i);
                steps.push({ cur: node.i, frontier: open.map(n => n.i) });
                return { steps, path, cost: node.g, expanded: closed.size };
            }
            closed.add(node.i);
            gridNeighbors(G, node.i).forEach(j => {
                if (closed.has(j)) return;
                const g = node.g + 1;
                if (algo === 'greedy' ? bestG.has(j) : bestG.has(j) && bestG.get(j) <= g) return;
                push(j, g, node);
            });
            steps.push({ cur: node.i, frontier: open.filter(n => !closed.has(n.i)).map(n => n.i) });
        }
        return { steps, path: null, cost: Infinity, expanded: closed.size };
    }

    // Tata letak awal lab heuristik (13 kolom x 8 baris). Tujuan berada di balik dinding dengan
    // celah di tengah: heuristik yang melebih-lebihkan (Manhattan x 2) menggiring A* lurus ke arah
    // tujuan hingga tertahan dinding, sehingga lintasannya berbiaya 20, padahal optimalnya 14.
    const GRID_DEFAULT = {
        cols: 13, rows: 8, start: 5 * 13 + 1, goal: 1 * 13 + 11,
        walls: [
            '..........#..',
            '..........#..',
            '..........#..',
            '..........#..',
            '.............',
            '.............',
            '..........#..',
            '..........#..'
        ]
    };

    function gridFromLayout(L) {
        const walls = new Set();
        L.walls.forEach((row, r) => row.split('').forEach((ch, c) => { if (ch === '#') walls.add(r * L.cols + c); }));
        return { cols: L.cols, rows: L.rows, start: L.start, goal: L.goal, walls };
    }

    /* =====================================================================
     * 3b. POHON PERMAINAN: MINIMAX & ALFA-BETA
     * Pohon ditulis sebagai larik bersarang: larik = simpul dalam, angka = daun.
     * Akar selalu MAX, lalu bergantian MIN, MAX, ...
     * ===================================================================== */
    const GAME_TREES = {
        buku:   { label: 'Contoh buku — 2 ply, b = 3', spec: [[3, 12, 8], [2, 4, 6], [14, 5, 2]] },
        ply3b2: { label: '3 ply, b = 2', spec: [[[3, 5], [6, 9]], [[1, 2], [0, -1]]] },
        ply3b3: { label: '3 ply, b = 3', spec: [
            [[4, 7, 2], [9, 1, 6], [3, 8, 5]],
            [[6, 2, 9], [5, 7, 3], [8, 4, 1]],
            [[2, 5, 8], [7, 3, 6], [1, 9, 4]]
        ] }
    };
    const fmtInf = x => x === Infinity ? '+∞' : x === -Infinity ? '−∞' : String(x);

    function specValue(s, depth) {
        if (!Array.isArray(s)) return s;
        const vs = s.map(c => specValue(c, depth + 1));
        return depth % 2 === 0 ? Math.max(...vs) : Math.min(...vs);
    }

    // Urutan anak: 'asli', 'terbaik' (langkah terbaik tiap pemain dibangkitkan lebih dulu), 'terburuk'
    function reorderSpec(s, mode, depth) {
        depth = depth || 0;
        if (!Array.isArray(s)) return s;
        const kids = s.map(c => reorderSpec(c, mode, depth + 1));
        if (mode === 'asli') return kids;
        const isMax = depth % 2 === 0;
        const sorted = kids.map((k, i) => ({ k, v: specValue(k, depth + 1), i }))
            .sort((a, b) => (isMax ? b.v - a.v : a.v - b.v) || a.i - b.i)
            .map(o => o.k);
        return mode === 'terbaik' ? sorted : sorted.reverse();
    }

    function buildGameTree(spec) {
        let id = 0;
        const make = (x, depth, parent) => {
            const n = { id: id++, depth, parent, type: Array.isArray(x) ? (depth % 2 === 0 ? 'max' : 'min') : 'leaf' };
            if (n.type === 'leaf') n.value = x;
            else n.children = x.map(c => make(c, depth + 1, n));
            return n;
        };
        const root = make(spec, 0, null);
        // Simpul dalam diberi huruf A, B, C, ... menurut urutan melebar; daun diberi nama induk + nomor
        let letter = 0;
        const queue = [root];
        while (queue.length) {
            const n = queue.shift();
            if (n.type === 'leaf') continue;
            n.name = String.fromCharCode(65 + letter++);
            n.children.forEach((c, i) => { if (c.type === 'leaf') c.name = n.name + (i + 1); queue.push(c); });
        }
        return root;
    }

    function runGame(root, useAB) {
        const all = [];
        (function walk(n) { all.push(n); if (n.children) n.children.forEach(walk); })(root);
        const leavesTotal = all.filter(n => n.type === 'leaf').length;
        const st = {};
        all.forEach(n => { st[n.id] = { status: 'idle', v: null, a: null, b: null }; });
        const steps = [];
        const stack = [];
        let evaluated = 0, best = null;
        const role = n => n.type === 'max' ? 'MAX' : 'MIN';
        const snap = (cur, msg, extra) => {
            const copy = {};
            for (const k in st) copy[k] = Object.assign({}, st[k]);
            steps.push(Object.assign({ cur, msg, st: copy, evaluated, leavesTotal, stack: stack.slice(), best }, extra || {}));
        };
        const pruneSub = n => { st[n.id].status = 'pruned'; if (n.children) n.children.forEach(pruneSub); };

        function visit(n, a, b) {
            stack.push(n.name);
            const s = st[n.id];
            s.status = 'active';
            if (n.type === 'leaf') {
                s.v = n.value;
                s.status = 'done';
                evaluated++;
                snap(n.id, 'Daun <b>' + n.name + '</b> dievaluasi: utilitas = <b>' + n.value + '</b>.');
                stack.pop();
                return n.value;
            }
            const isMax = n.type === 'max';
            let v = isMax ? -Infinity : Infinity;
            s.v = v; s.a = a; s.b = b;
            snap(n.id, 'Masuk ke simpul ' + role(n) + ' <b>' + n.name + '</b>' +
                (useAB ? ' membawa α = ' + fmtInf(a) + ' dan β = ' + fmtInf(b) : '') +
                '. Nilai sementara v = ' + fmtInf(v) + '.');
            for (let i = 0; i < n.children.length; i++) {
                const c = n.children[i];
                const cv = visit(c, a, b);
                const old = v;
                v = isMax ? Math.max(v, cv) : Math.min(v, cv);
                s.v = v;
                s.status = 'active';
                if (n === root && v !== old) best = c.id;
                let msg = 'Kembali ke ' + role(n) + ' <b>' + n.name + '</b>: ' + c.name + ' bernilai ' + cv +
                    ', jadi v = ' + (isMax ? 'max' : 'min') + '(' + fmtInf(old) + ', ' + cv + ') = <b>' + fmtInf(v) + '</b>.';
                if (useAB) {
                    // Urutan mengikuti pseudocode Russell & Norvig: perbarui α/β dulu, lalu uji pemangkasan
                    const before = isMax ? a : b;
                    if (isMax) { a = Math.max(a, v); s.a = a; } else { b = Math.min(b, v); s.b = b; }
                    const now = isMax ? a : b;
                    msg += now !== before ? ' Perbarui ' + (isMax ? 'α' : 'β') + ' = ' + fmtInf(now) + '.'
                        : ' ' + (isMax ? 'α' : 'β') + ' tetap ' + fmtInf(now) + '.';
                    if (isMax ? v >= b : v <= a) {
                        const rest = n.children.slice(i + 1);
                        rest.forEach(pruneSub);
                        s.status = 'done';
                        const other = isMax ? 'MIN' : 'MAX';
                        msg += ' Karena v ' + (isMax ? '≥ β = ' + fmtInf(b) : '≤ α = ' + fmtInf(a)) + ', pemain ' + other +
                            ' di atas sudah punya pilihan yang lebih baik dan tidak akan pernah memilih ' + n.name + '. ' +
                            (rest.length ? 'Sisa anak <b>' + rest.map(r => r.name).join(', ') + '</b> dipangkas.'
                                : 'Kebetulan tidak ada sisa anak yang bisa dipangkas.');
                        snap(n.id, msg, { pruned: rest.length });
                        stack.pop();
                        return v;
                    }
                }
                snap(n.id, msg);
            }
            s.status = 'done';
            stack.pop();
            return v;
        }

        snap(null, 'Mulai dari akar <b>' + root.name + '</b> (MAX). ' +
            (useAB ? 'Awalnya α = −∞ (belum ada jaminan untuk MAX) dan β = +∞ (belum ada jaminan untuk MIN).'
                : 'Minimax menelusuri pohon secara mendalam dan memeriksa <em>semua</em> daun.'));
        const value = visit(root, -Infinity, Infinity);
        st[root.id].status = 'done';
        const bestNode = all.find(n => n.id === best);
        snap(root.id, 'Selesai. Nilai minimax akar ' + root.name + ' = <b>' + value + '</b>, sehingga langkah terbaik MAX adalah ke <b>' +
            bestNode.name + '</b>. Daun yang dievaluasi: ' + evaluated + ' dari ' + leavesTotal + '.', { done: true, value });
        return steps;
    }

    /* =====================================================================
     * 3c. TIC-TAC-TOE: minimax dengan alfa-beta, batas kedalaman, fungsi evaluasi
     * Nilai selalu dari sudut pandang X (MAX): menang X = 100 − d, menang O = −(100 − d),
     * seri = 0, dengan d = banyak langkah dari posisi saat ini (menang lebih cepat lebih baik).
     * ===================================================================== */
    const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const TTT_ORDERS = { indeks: [0, 1, 2, 3, 4, 5, 6, 7, 8], pusat: [4, 0, 2, 6, 8, 1, 3, 5, 7] };

    function tttWinner(b) {
        for (const L of TTT_LINES) {
            if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return { who: b[L[0]], line: L };
        }
        return null;
    }

    // Fungsi evaluasi: banyak garis yang masih terbuka bagi X dikurangi garis yang masih terbuka bagi O
    function tttOpenLines(b) {
        let x = 0, o = 0;
        TTT_LINES.forEach(L => {
            const m = L.map(i => b[i]);
            if (m.indexOf('O') < 0) x++;
            if (m.indexOf('X') < 0) o++;
        });
        return { x, o, eval: x - o };
    }

    function tttDecide(board, toMove, opt) {
        const order = TTT_ORDERS[(opt && opt.order) || 'indeks'];
        const limit = (opt && opt.depth) || Infinity;
        let nodes = 0;
        const value = (b, player, depth, ab, a, bt) => {
            nodes++;
            const w = tttWinner(b);
            if (w) return w.who === 'X' ? 100 - depth : depth - 100;
            if (b.every(c => c)) return 0;
            if (depth >= limit) return tttOpenLines(b).eval;
            const isMax = player === 'X';
            let v = isMax ? -Infinity : Infinity;
            for (const i of order) {
                if (b[i]) continue;
                b[i] = player;
                const cv = value(b, isMax ? 'O' : 'X', depth + 1, ab, a, bt);
                b[i] = null;
                if (isMax) {
                    if (cv > v) v = cv;
                    if (ab) { if (v >= bt) return v; if (v > a) a = v; }
                } else {
                    if (cv < v) v = cv;
                    if (ab) { if (v <= a) return v; if (v < bt) bt = v; }
                }
            }
            return v;
        };
        const b = board.slice();
        const isMax = toMove === 'X';
        const moves = order.filter(i => !b[i]);
        // Nilai persis setiap langkah (jendela penuh) untuk ditampilkan kepada mahasiswa
        const values = {};
        moves.forEach(i => {
            b[i] = toMove;
            values[i] = value(b, isMax ? 'O' : 'X', 1, true, -Infinity, Infinity);
            b[i] = null;
        });
        let move = moves[0];
        moves.forEach(i => { if (isMax ? values[i] > values[move] : values[i] < values[move]) move = i; });
        // Banyak simpul yang diperiksa minimax murni vs alfa-beta untuk keputusan yang sama
        nodes = 0; value(b, toMove, 0, false, -Infinity, Infinity);
        const nodesMinimax = nodes;
        nodes = 0; value(b, toMove, 0, true, -Infinity, Infinity);
        const nodesAlphaBeta = nodes;
        return { move, values, nodesMinimax, nodesAlphaBeta };
    }

    /* =====================================================================
     * Ekspor untuk pengujian di Node.js
     * ===================================================================== */
    const core = {
        ROMANIA, ALGOS, runSearch, shortestCost,
        GRID_H, GRID_DEFAULT, gridFromLayout, gridSearch, gridTrueCost, gridHeuristic,
        GAME_TREES, specValue, reorderSpec, buildGameTree, runGame,
        tttWinner, tttOpenLines, tttDecide
    };
    if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

    /* =====================================================================
     * 4. UTILITAS ANTARMUKA
     * ===================================================================== */
    const ICON = n => '<i class="fa-solid fa-' + n + '"></i>';
    const SPEEDS = [1600, 1100, 750, 450, 250];
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const optionList = (items, sel) => items.map(([v, t]) =>
        '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(t) + '</option>').join('');

    function makePlayer(opts) {
        // opts: { count(): number, get(): idx, set(idx), playBtn, speedInput }
        let timer = null;
        const icon = playing => {
            opts.playBtn.innerHTML = playing ? ICON('pause') + ' Jeda' : ICON('play') + ' Jalankan';
        };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } icon(false); };
        const tick = () => {
            if (opts.get() >= opts.count() - 1) { stop(); return; }
            opts.set(opts.get() + 1);
        };
        const start = () => {
            if (opts.get() >= opts.count() - 1) opts.set(0);
            stop();
            timer = setInterval(tick, SPEEDS[(+opts.speedInput.value || 3) - 1]);
            icon(true);
        };
        opts.playBtn.addEventListener('click', () => (timer ? stop() : start()));
        opts.speedInput.addEventListener('input', () => { if (timer) start(); });
        return { stop, isPlaying: () => !!timer };
    }

    /* =====================================================================
     * 5. PETA ROMANIA (SVG)
     * ===================================================================== */
    const P = s => [62 + (LOC[s][0] - 91) * 1.25, 34 + (571 - LOC[s][1]) * 1.25];

    function mapSVG(o) {
        // o: { start, goal, snap, showH, h }
        const snap = o.snap;
        const status = {};
        const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
        const tree = new Set(), path = new Set();
        if (snap) {
            snap.explored.forEach(s => { status[s] = 'explored'; });
            snap.frontier.forEach(f => { status[f.s] = 'frontier'; });
            if (snap.current) status[snap.current] = 'current';
            snap.tree.forEach(([a, b]) => tree.add(pairKey(a, b)));
            if (snap.path) {
                snap.path.forEach(s => { status[s] = 'path'; });
                for (let i = 1; i < snap.path.length; i++) path.add(pairKey(snap.path[i - 1], snap.path[i]));
            }
        }
        let roads = '', costs = '', nodes = '', labels = '';
        ROADS.forEach(([a, b, c]) => {
            const [x1, y1] = P(a), [x2, y2] = P(b);
            const k = pairKey(a, b);
            const cls = path.has(k) ? ' path' : tree.has(k) ? ' tree' : '';
            roads += '<line class="vz-road' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
            costs += '<text class="vz-cost" x="' + ((x1 + x2) / 2) + '" y="' + ((y1 + y2) / 2 + 4) + '" text-anchor="middle">' + c + '</text>';
        });
        ROMANIA.cities.forEach(s => {
            const [x, y] = P(s);
            const [dx, dy, anchor] = LABEL[s];
            if (s === o.start) nodes += '<circle class="vz-ring-start" cx="' + x + '" cy="' + y + '" r="14"/>';
            if (s === o.goal) nodes += '<circle class="vz-ring-goal" cx="' + x + '" cy="' + y + '" r="14"/>';
            nodes += '<circle class="vz-city ' + (status[s] || '') + '" cx="' + x + '" cy="' + y + '" r="9"><title>' + s + '</title></circle>';
            labels += '<text class="vz-city-label" x="' + (x + dx) + '" y="' + (y + dy) + '" text-anchor="' + anchor + '">' + s + '</text>';
            if (o.showH) {
                const hy = dy < 0 ? y + dy - 13 : y + dy + 13;
                labels += '<text class="vz-city-h" x="' + (x + dx) + '" y="' + hy + '" text-anchor="' + anchor + '">h=' + o.h(s) + '</text>';
            }
        });
        return '<svg class="vz-map" viewBox="0 0 722 455" role="img" aria-label="Peta jalan Romania dengan jarak dalam km">' +
            roads + costs + nodes + labels + '</svg>';
    }

    const MAP_LEGEND =
        '<div class="viz-legend">' +
        '<span><i class="vz-dot" style="background:#1565c0"></i>Belum dijelajah</span>' +
        '<span><i class="vz-dot" style="background:#f9a825"></i>Di frontier</span>' +
        '<span><i class="vz-dot" style="background:#e65100"></i>Sedang diambil</span>' +
        '<span><i class="vz-dot" style="background:#7986cb"></i>Sudah diekspansi</span>' +
        '<span><i class="vz-dot" style="background:#2e7d32"></i>Lintasan solusi</span>' +
        '<span><i class="vz-ring"></i>Awal</span>' +
        '<span><i class="vz-ring goal"></i>Tujuan</span>' +
        '</div>';

    function initRomaniaMap(root) {
        const start = root.dataset.start || 'Arad';
        const goal = root.dataset.goal || 'Bucharest';
        const showH = root.dataset.showH === 'true';
        root.classList.add('viz', 'viz-static');
        root.innerHTML = '<div class="viz-stage">' +
            mapSVG({ start, goal, showH, h: ROMANIA.heuristic(goal) }) +
            '<div class="viz-legend"><span><i class="vz-ring"></i>Awal: ' + start + '</span>' +
            '<span><i class="vz-ring goal"></i>Tujuan: ' + goal + '</span>' +
            '<span>Angka pada jalan = jarak (km)</span>' +
            (showH ? '<span class="vz-h-key">h=… = jarak garis lurus ke ' + goal + '</span>' : '') +
            '</div></div>';
    }

    /* =====================================================================
     * 6. PENELUSUR PENCARIAN (langkah demi langkah)
     * ===================================================================== */
    const FRONTIER_TITLE = {
        bfs: 'Frontier — antrian FIFO (depan di kiri)',
        dfs: 'Frontier — tumpukan LIFO (puncak di kiri)',
        dls: 'Frontier — tumpukan LIFO (puncak di kiri)',
        ids: 'Frontier — tumpukan LIFO (puncak di kiri)',
        ucs: 'Frontier — antrian prioritas, urut g(n)',
        greedy: 'Frontier — antrian prioritas, urut h(n)',
        astar: 'Frontier — antrian prioritas, urut f(n)'
    };
    const chipMetric = (algo, f) => algo === 'ucs' ? 'g=' + f.g
        : algo === 'greedy' ? 'h=' + f.h
        : algo === 'astar' ? 'f=' + (f.g + f.h)
        : 'd=' + f.d;

    function initSearch(root) {
        const algos = (root.dataset.algos || 'bfs,dfs,dls,ids,ucs').split(',').map(s => s.trim());
        let algo = root.dataset.algo || algos[0];
        let start = root.dataset.start || 'Arad';
        let goal = root.dataset.goal || 'Bucharest';
        let limit = +(root.dataset.limit || 3);
        let steps = [], idx = 0, optimal = 0;

        const cityOpts = sel => optionList(ROMANIA.cities.map(c => [c, c]), sel);
        root.classList.add('viz', 'viz-search');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Algoritma <select data-role="algo">' + optionList(algos.map(a => [a, ALGOS[a].label]), algo) + '</select></label>' +
            '<label>Awal <select data-role="start">' + cityOpts(start) + '</select></label>' +
            '<label>Tujuan <select data-role="goal">' + cityOpts(goal) + '</select></label>' +
            '<label data-role="limit-wrap">Batas ℓ <input data-role="limit" type="number" min="0" max="12" value="' + limit + '"></label>' +
            '</div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage"><div data-role="map"></div>' + MAP_LEGEND + '</div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="step"></span><span class="vz-tag" data-role="iter" hidden></span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="viz-block"><h6 data-role="fr-title"></h6><div class="viz-chips" data-role="frontier"></div></div>' +
            '<div class="viz-block"><h6 data-role="ex-title"></h6><div class="viz-chips" data-role="explored"></div></div>' +
            '<div class="viz-stats" data-role="stats"></div>' +
            '<div class="viz-result" data-role="result" hidden></div>' +
            '</div></div>' +
            '<div class="viz-controls">' +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Ulang</button>' +
            '<button type="button" class="viz-btn secondary" data-role="prev" aria-label="Langkah sebelumnya">' + ICON('backward-step') + '</button>' +
            '<button type="button" class="viz-btn" data-role="play">' + ICON('play') + ' Jalankan</button>' +
            '<button type="button" class="viz-btn secondary" data-role="next">Langkah ' + ICON('forward-step') + '</button>' +
            '<label class="viz-speed">Kecepatan <input type="range" min="1" max="5" value="3" data-role="speed"></label>' +
            '</div>';

        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const player = makePlayer({
            count: () => steps.length, get: () => idx, set: i => { idx = i; render(); },
            playBtn: $('play'), speedInput: $('speed')
        });

        function compute() {
            player.stop();
            steps = runSearch(ROMANIA, algo, start, goal, limit);
            optimal = shortestCost(ROMANIA, start, goal);
            idx = 0;
            $('limit-wrap').hidden = algo !== 'dls';
            render();
        }

        function render() {
            const s = steps[idx];
            const last = idx === steps.length - 1;
            $('map').innerHTML = mapSVG({ start, goal, snap: s, showH: !!ALGOS[algo].informed, h: ROMANIA.heuristic(goal) });
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            $('iter').hidden = s.iteration === null;
            $('iter').textContent = 'Iterasi ℓ = ' + s.iteration;
            const msg = $('msg');
            msg.className = 'viz-msg' + (s.kind === 'goal' ? ' goal' : s.kind === 'fail' ? ' fail' : '');
            msg.innerHTML = s.msg;
            $('fr-title').textContent = FRONTIER_TITLE[algo];
            $('ex-title').textContent = (algo === 'dls' || algo === 'ids')
                ? 'Sudah dikunjungi (pencarian pohon, iterasi ini)' : 'Explored — sudah diekspansi';
            $('frontier').innerHTML = s.frontier.length
                ? s.frontier.map(f => '<span class="vz-chip frontier">' + f.s + '<small>' + chipMetric(algo, f) + '</small></span>').join('')
                : '<span class="vz-chip empty">(kosong)</span>';
            $('explored').innerHTML = s.explored.length
                ? s.explored.map(e => '<span class="vz-chip">' + e + '</span>').join('')
                : '<span class="vz-chip empty">(kosong)</span>';
            $('stats').innerHTML = 'Diekspansi: <b>' + s.expanded + '</b> · Dibangkitkan: <b>' + s.generated +
                '</b> · Frontier terbesar: <b>' + s.maxFrontier + '</b>';
            const res = $('result');
            res.hidden = !last;
            if (last) {
                if (s.found) {
                    const opt = s.cost === optimal;
                    res.className = 'viz-result ' + (opt ? 'ok' : 'warn');
                    res.innerHTML = ICON(opt ? 'circle-check' : 'triangle-exclamation') +
                        ' <span>Lintasan: <b>' + s.path.join(' → ') + '</b><br>Biaya: <b>' + s.cost + ' km</b> — ' +
                        (opt ? 'optimal.' : '<b>tidak optimal</b> (lintasan termurah ' + optimal + ' km).') + '</span>';
                } else {
                    res.className = 'viz-result bad';
                    res.innerHTML = ICON('circle-xmark') + ' <span>Tujuan tidak ditemukan.</span>';
                }
            }
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
        }

        $('algo').addEventListener('change', e => { algo = e.target.value; compute(); });
        $('start').addEventListener('change', e => { start = e.target.value; compute(); });
        $('goal').addEventListener('change', e => { goal = e.target.value; compute(); });
        $('limit').addEventListener('change', e => {
            limit = Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0));
            e.target.value = limit;
            compute();
        });
        $('reset').addEventListener('click', () => { player.stop(); idx = 0; render(); });
        $('prev').addEventListener('click', () => { player.stop(); if (idx > 0) { idx--; render(); } });
        $('next').addEventListener('click', () => { player.stop(); if (idx < steps.length - 1) { idx++; render(); } });
        compute();
    }

    /* =====================================================================
     * 7. TABEL ADU ALGORITMA
     * ===================================================================== */
    function initCompare(root) {
        const algos = (root.dataset.algos || 'bfs,dfs,ids,ucs').split(',').map(s => s.trim());
        let start = root.dataset.start || 'Arad';
        let goal = root.dataset.goal || 'Bucharest';
        const cityOpts = sel => optionList(ROMANIA.cities.map(c => [c, c]), sel);
        root.classList.add('viz', 'viz-compare');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Awal <select data-role="start">' + cityOpts(start) + '</select></label>' +
            '<label>Tujuan <select data-role="goal">' + cityOpts(goal) + '</select></label>' +
            '</div><div class="vz-table-wrap" data-role="table"></div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');

        function render() {
            const optimal = shortestCost(ROMANIA, start, goal);
            const rows = algos.map(a => {
                const st = runSearch(ROMANIA, a, start, goal, 3);
                return Object.assign({ algo: a }, st[st.length - 1]);
            });
            const maxExp = Math.max(1, ...rows.map(r => r.expanded));
            $('table').innerHTML = '<table class="vz-compare-table"><thead><tr>' +
                '<th>Algoritma</th><th>Simpul diekspansi</th><th>Frontier terbesar</th><th>Lintasan</th><th>Biaya</th><th>Optimal?</th>' +
                '</tr></thead><tbody>' +
                rows.map(r => '<tr><td><strong>' + SHORT[r.algo] + '</strong></td>' +
                    '<td><div class="vz-bar"><span style="width:' + (100 * r.expanded / maxExp) + '%"></span></div><b>' + r.expanded + '</b></td>' +
                    '<td>' + r.maxFrontier + '</td>' +
                    '<td class="vz-path">' + (r.found ? r.path.join(' → ') : '—') + '</td>' +
                    '<td>' + (r.found ? r.cost + ' km' : '—') + '</td>' +
                    '<td>' + (!r.found ? '—' : r.cost === optimal
                        ? '<span class="vz-yes">' + ICON('check') + ' Ya</span>'
                        : '<span class="vz-no">' + ICON('xmark') + ' Tidak</span>') + '</td></tr>').join('') +
                '</tbody></table>';
        }
        $('start').addEventListener('change', e => { start = e.target.value; render(); });
        $('goal').addEventListener('change', e => { goal = e.target.value; render(); });
        render();
    }

    /* =====================================================================
     * 8. LAB HEURISTIK BERBASIS GRID
     * ===================================================================== */
    function initGridLab(root) {
        let G = gridFromLayout(GRID_DEFAULT);
        let hname = root.dataset.heuristic || 'manhattan';
        let w = +(root.dataset.weight || 2);
        let algo = 'astar';
        let mode = 'wall';
        let showH = true;
        let run = null, idx = 0, painting = null;

        root.classList.add('viz', 'viz-grid');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Heuristik <select data-role="h">' + optionList(Object.keys(GRID_H).map(k => [k, GRID_H[k].label]), hname) + '</select></label>' +
            '<label data-role="w-wrap">w = <b data-role="w-val"></b> <input type="range" min="1" max="4" step="0.5" value="' + w + '" data-role="w"></label>' +
            '<label>Algoritma <select data-role="algo">' + optionList([['astar', 'A*'], ['greedy', 'Greedy Best-First']], algo) + '</select></label>' +
            '<label class="vz-check"><input type="checkbox" data-role="show" checked> Tampilkan h(n)</label>' +
            '</div>' +
            '<div class="viz-toolbar vz-modes" role="radiogroup" aria-label="Mode klik pada grid">' +
            '<span>Klik grid untuk:</span>' +
            '<button type="button" class="vz-mode" data-mode="wall">' + ICON('square') + ' Tambah/hapus dinding</button>' +
            '<button type="button" class="vz-mode" data-mode="start">' + ICON('location-dot') + ' Pindahkan awal</button>' +
            '<button type="button" class="vz-mode" data-mode="goal">' + ICON('flag-checkered') + ' Pindahkan tujuan</button>' +
            '</div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage"><div class="vz-grid" data-role="grid" style="grid-template-columns:repeat(' + G.cols + ',1fr)"></div>' +
            '<div class="viz-legend">' +
            '<span><i class="vz-dot sq" style="background:#1a2a4a"></i>Awal (S)</span>' +
            '<span><i class="vz-dot sq" style="background:#2e7d32"></i>Tujuan (G)</span>' +
            '<span><i class="vz-dot sq" style="background:#ffe082"></i>Frontier</span>' +
            '<span><i class="vz-dot sq" style="background:#c5cae9"></i>Sudah diekspansi</span>' +
            '<span><i class="vz-dot sq" style="background:#66bb6a"></i>Lintasan</span>' +
            '<span><i class="vz-dot sq over"></i>h(n) &gt; h*(n)</span>' +
            '</div></div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-result" data-role="admis"></div>' +
            '<div class="viz-stats" data-role="stats"></div>' +
            '<div class="viz-block"><h6>A* di grid ini dengan setiap heuristik</h6><div class="vz-bars" data-role="bars"></div></div>' +
            '</div></div>' +
            '<div class="viz-controls">' +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Grid awal</button>' +
            '<button type="button" class="viz-btn secondary" data-role="clear">' + ICON('eraser') + ' Hapus dinding</button>' +
            '<button type="button" class="viz-btn" data-role="play">' + ICON('play') + ' Jalankan</button>' +
            '<button type="button" class="viz-btn secondary" data-role="end">Hasil akhir ' + ICON('forward-fast') + '</button>' +
            '<label class="viz-speed">Kecepatan <input type="range" min="1" max="5" value="4" data-role="speed"></label>' +
            '</div>';

        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const gridEl = $('grid');
        const player = makePlayer({
            count: () => run.steps.length + 1, get: () => idx, set: i => { idx = i; renderGrid(); },
            playBtn: $('play'), speedInput: $('speed')
        });
        const fmtH = v => v === Infinity ? '∞' : Number.isInteger(v) ? String(v) : v.toFixed(1);

        function compute(toEnd) {
            player.stop();
            run = gridSearch(G, algo, hname, w);
            idx = toEnd ? run.steps.length : 0;
            renderGrid();
            renderSide();
        }

        function renderGrid() {
            const h = gridHeuristic(G, hname, w);
            const hstar = gridTrueCost(G);
            const explored = new Set(run.steps.slice(0, idx).map(s => s.cur));
            const frontier = new Set(idx > 0 && idx <= run.steps.length ? run.steps[idx - 1].frontier : [G.start]);
            const done = idx >= run.steps.length;
            const path = new Set(done && run.path ? run.path : []);
            let html = '';
            for (let i = 0; i < G.cols * G.rows; i++) {
                let cls = 'vz-cell';
                let txt = '';
                if (G.walls.has(i)) cls += ' wall';
                else if (i === G.start) { cls += ' start'; txt = 'S'; }
                else if (i === G.goal) { cls += ' goal'; txt = 'G'; }
                else {
                    if (path.has(i)) cls += ' path';
                    else if (explored.has(i)) cls += ' explored';
                    else if (frontier.has(i)) cls += ' frontier';
                    if (showH) txt = fmtH(h(i));
                }
                if (!G.walls.has(i) && h(i) > hstar[i] + 1e-9) cls += ' over';
                html += '<div class="' + cls + '" data-i="' + i + '" title="h(n) = ' + fmtH(h(i)) + ', h*(n) = ' + fmtH(hstar[i]) + '">' + txt + '</div>';
            }
            gridEl.innerHTML = html;
            $('step').textContent = done ? 'Selesai — ' + run.expanded + ' simpul diekspansi'
                : 'Ekspansi ke-' + idx + ' dari ' + run.steps.length;
            $('end').disabled = done;
        }

        function renderSide() {
            const h = gridHeuristic(G, hname, w);
            const hstar = gridTrueCost(G);
            let over = 0;
            for (let i = 0; i < G.cols * G.rows; i++) if (!G.walls.has(i) && hstar[i] < Infinity && h(i) > hstar[i] + 1e-9) over++;
            const optimal = hstar[G.start];
            const adm = $('admis');
            adm.className = 'viz-result ' + (over ? 'bad' : 'ok');
            adm.innerHTML = over
                ? ICON('triangle-exclamation') + ' <span><b>Tidak admissible</b> di grid ini: ' + over +
                  ' petak punya h(n) &gt; h*(n) (berbingkai merah). Arahkan kursor ke petak untuk melihat h*.</span>'
                : ICON('circle-check') + ' <span><b>Admissible</b>: h(n) ≤ h*(n) di semua petak.</span>';
            $('stats').innerHTML = run.path
                ? 'Biaya lintasan ditemukan: <b>' + run.cost + '</b> · Biaya optimal: <b>' + optimal + '</b> — ' +
                  (run.cost === optimal ? '<span class="vz-yes">optimal</span>' : '<span class="vz-no">tidak optimal</span>')
                : 'Tujuan tidak dapat dicapai (terhalang dinding).';
            const rows = ['zero', 'euclid', 'manhattan', 'weighted'].map(k => {
                const r = gridSearch(G, 'astar', k, w);
                return { k, r, name: k === 'weighted' ? 'Manhattan × ' + w : GRID_H[k].label.split(' (')[0] };
            });
            const maxE = Math.max(1, ...rows.map(x => x.r.expanded));
            $('bars').innerHTML = rows.map(x =>
                '<div class="vz-bar-row' + (x.k === hname && algo === 'astar' ? ' current' : '') + '">' +
                '<span class="vz-bar-name">' + x.name + '</span>' +
                '<div class="vz-bar"><span style="width:' + (100 * x.r.expanded / maxE) + '%"></span></div>' +
                '<span class="vz-bar-val">' + x.r.expanded + ' simpul · biaya ' +
                (x.r.path ? x.r.cost + (x.r.cost === optimal ? '' : ' <span class="vz-no">(+' + (x.r.cost - optimal) + ')</span>') : '—') +
                '</span></div>').join('');
            $('w-wrap').hidden = hname !== 'weighted';
            $('w-val').textContent = w;
            root.querySelectorAll('.vz-mode').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
                btn.setAttribute('aria-pressed', btn.dataset.mode === mode);
            });
        }

        function applyCell(i, first) {
            if (mode === 'wall') {
                if (i === G.start || i === G.goal) return;
                if (first) painting = !G.walls.has(i);
                if (painting) G.walls.add(i); else G.walls.delete(i);
            } else if (!G.walls.has(i)) {
                if (mode === 'start' && i !== G.goal) G.start = i;
                if (mode === 'goal' && i !== G.start) G.goal = i;
            }
            compute(true);
        }

        gridEl.addEventListener('pointerdown', e => {
            const cell = e.target.closest('.vz-cell');
            if (!cell) return;
            e.preventDefault();
            applyCell(+cell.dataset.i, true);
        });
        gridEl.addEventListener('pointermove', e => {
            if (painting === null || mode !== 'wall' || !(e.buttons & 1)) return;
            const cell = document.elementFromPoint(e.clientX, e.clientY);
            if (!cell || !cell.classList.contains('vz-cell') || !gridEl.contains(cell)) return;
            const i = +cell.dataset.i;
            if (i === G.start || i === G.goal || G.walls.has(i) === painting) return;
            applyCell(i, false);
        });
        window.addEventListener('pointerup', () => { painting = null; });

        root.querySelectorAll('.vz-mode').forEach(btn => btn.addEventListener('click', () => { mode = btn.dataset.mode; renderSide(); }));
        $('h').addEventListener('change', e => { hname = e.target.value; compute(true); });
        $('w').addEventListener('input', e => { w = +e.target.value; compute(true); });
        $('algo').addEventListener('change', e => { algo = e.target.value; compute(true); });
        $('show').addEventListener('change', e => { showH = e.target.checked; renderGrid(); });
        $('reset').addEventListener('click', () => { G = gridFromLayout(GRID_DEFAULT); compute(true); });
        $('clear').addEventListener('click', () => { G.walls.clear(); compute(true); });
        $('end').addEventListener('click', () => { player.stop(); idx = run.steps.length; renderGrid(); });
        compute(true);
    }

    /* =====================================================================
     * 9. DUNIA PENYEDOT DEBU
     * ===================================================================== */
    const PROGRAMS = {
        reflex: {
            title: 'Agen Refleks Sederhana',
            act(p) {
                if (p.status === 'Kotor') return ['Sedot', 'JIKA status = Kotor MAKA Sedot'];
                if (p.loc === 'A') return ['Kanan', 'JIKA lokasi = A MAKA Kanan'];
                return ['Kiri', 'JIKA lokasi = B MAKA Kiri'];
            }
        },
        model: {
            title: 'Agen Refleks Berbasis Model',
            act(p, m) {
                m[p.loc] = p.status;                               // perbarui model dari persepsi
                const other = p.loc === 'A' ? 'B' : 'A';
                if (p.status === 'Kotor') {
                    m[p.loc] = 'Bersih';                           // model: setelah disedot, petak bersih
                    return ['Sedot', 'JIKA status = Kotor MAKA Sedot'];
                }
                if (m[other] !== 'Bersih') {
                    return [other === 'B' ? 'Kanan' : 'Kiri',
                        'JIKA model belum yakin petak ' + other + ' bersih MAKA pindah ke ' + other];
                }
                return ['Diam', 'JIKA model: kedua petak bersih MAKA Diam'];
            }
        },
        hunter: {
            title: 'Agen "Pemburu Poin"',
            act(p) {
                if (p.status === 'Kotor') return ['Sedot', 'JIKA status = Kotor MAKA Sedot'];
                return ['Tumpahkan', 'JIKA status = Bersih MAKA tumpahkan kotoran (agar bisa disedot lagi)'];
            }
        }
    };

    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function initVacuum(root) {
        const MAXT = 30, REGROW_P = 0.12;
        const selectable = root.dataset.select === 'true';
        let kinds = (root.dataset.agents || 'reflex').split(',').map(s => s.trim());
        let init = root.dataset.init || 'A-11';
        let regrow = root.dataset.regrow === '1';
        let seed = 7;
        let panes = [];

        const INITS = [];
        ['A', 'B'].forEach(l => ['11', '10', '01', '00'].forEach(d => {
            const txt = 'Agen di ' + l + ' · A ' + (d[0] === '1' ? 'kotor' : 'bersih') + ' · B ' + (d[1] === '1' ? 'kotor' : 'bersih');
            INITS.push([l + '-' + d, txt]);
        }));

        root.classList.add('viz', 'viz-vacuum');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            (selectable ? '<label>Program agen <select data-role="agent">' +
                optionList(Object.keys(PROGRAMS).map(k => [k, PROGRAMS[k].title]), kinds[0]) + '</select></label>' : '') +
            '<label>Keadaan awal <select data-role="init">' + optionList(INITS, init) + '</select></label>' +
            '<label class="vz-check"><input type="checkbox" data-role="regrow"' + (regrow ? ' checked' : '') +
            '> Kotoran bisa muncul lagi (lingkungan dinamis)</label>' +
            '</div>' +
            '<div class="vz-vac-panes" data-role="panes"></div>' +
            '<div class="viz-controls">' +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Ulang</button>' +
            '<button type="button" class="viz-btn" data-role="play">' + ICON('play') + ' Jalankan</button>' +
            '<button type="button" class="viz-btn secondary" data-role="next">Langkah ' + ICON('forward-step') + '</button>' +
            '<span class="viz-step" data-role="t"></span>' +
            '<label class="viz-speed">Kecepatan <input type="range" min="1" max="5" value="3" data-role="speed"></label>' +
            '</div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');

        function reset() {
            const [loc, d] = init.split('-');
            panes = kinds.map(kind => ({
                kind, loc, t: 0,
                dirt: { A: d[0] === '1', B: d[1] === '1' },
                model: { A: null, B: null },
                score: { clean: 0, sucked: 0, moves: 0 },
                last: null, log: [],
                rng: mulberry32(seed)
            }));
            render();
        }

        function stepPane(p) {
            const percept = { loc: p.loc, status: p.dirt[p.loc] ? 'Kotor' : 'Bersih' };
            const [action, rule] = PROGRAMS[p.kind].act(percept, p.model);
            if (action === 'Sedot') { if (p.dirt[p.loc]) p.score.sucked++; p.dirt[p.loc] = false; }
            else if (action === 'Kanan' && p.loc === 'A') { p.loc = 'B'; p.score.moves++; }
            else if (action === 'Kiri' && p.loc === 'B') { p.loc = 'A'; p.score.moves++; }
            else if (action === 'Tumpahkan') p.dirt[p.loc] = true;
            // Dinamika lingkungan: dua bilangan acak selalu diambil agar semua panel tetap sinkron
            const r = { A: p.rng(), B: p.rng() };
            const appeared = [];
            if (regrow) ['A', 'B'].forEach(k => { if (!p.dirt[k] && r[k] < REGROW_P) { p.dirt[k] = true; appeared.push(k); } });
            p.score.clean += (p.dirt.A ? 0 : 1) + (p.dirt.B ? 0 : 1);
            p.t++;
            p.last = { percept, action, rule, appeared };
            p.log.unshift('t=' + p.t + ': [' + percept.loc + ', ' + percept.status + '] → ' + action +
                (appeared.length ? '   (kotoran muncul di ' + appeared.join(' & ') + ')' : ''));
        }

        const room = (p, k) => '<div class="vz-room' + (p.dirt[k] ? ' dirty' : '') + '">' +
            '<span class="vz-room-name">Petak ' + k + '</span>' +
            (p.dirt[k] ? '<span class="vz-dirt">' + ICON('hill-rockslide') + '</span>' : '<span class="vz-clean">bersih</span>') +
            (p.loc === k ? '<span class="vz-bot">' + ICON('robot') + '</span>' : '') +
            '</div>';

        function render() {
            $('panes').innerHTML = panes.map(p => {
                const l = p.last;
                return '<div class="vz-vac-pane">' +
                    '<div class="vz-vac-title">' + PROGRAMS[p.kind].title + '</div>' +
                    '<div class="vz-rooms">' + room(p, 'A') + room(p, 'B') + '</div>' +
                    '<div class="vz-kv">' +
                    '<span>Persepsi</span><span>' + (l ? '<code>[' + l.percept.loc + ', ' + l.percept.status + ']</code>' : '—') + '</span>' +
                    '<span>Aksi</span><span>' + (l ? '<b class="vz-act">' + l.action + '</b>' : '—') + '</span>' +
                    '<span>Aturan</span><span>' + (l ? l.rule : '—') + '</span>' +
                    (p.kind === 'model' ? '<span>Model internal</span><span>A = ' + (p.model.A || '?') + ' · B = ' + (p.model.B || '?') + '</span>' : '') +
                    '</div>' +
                    '<div class="vz-scores">' +
                    '<div><b>' + p.score.clean + '</b><span>petak bersih<br>(akumulasi per langkah)</span></div>' +
                    '<div><b>' + p.score.sucked + '</b><span>kotoran<br>disedot</span></div>' +
                    '<div><b>' + p.score.moves + '</b><span>gerakan<br>(energi)</span></div>' +
                    '</div>' +
                    '<div class="vz-log">' + (p.log.length ? p.log.map(esc).join('\n') : 'Belum ada langkah.') + '</div>' +
                    '</div>';
            }).join('');
            $('t').textContent = 't = ' + panes[0].t + ' / ' + MAXT;
            $('next').disabled = panes[0].t >= MAXT;
        }

        const player = makePlayer({
            count: () => MAXT + 1, get: () => panes[0].t,
            set: i => { if (i === 0) { reset(); return; } panes.forEach(stepPane); render(); },
            playBtn: $('play'), speedInput: $('speed')
        });

        if (selectable) $('agent').addEventListener('change', e => { kinds = [e.target.value]; player.stop(); reset(); });
        $('init').addEventListener('change', e => { init = e.target.value; player.stop(); reset(); });
        $('regrow').addEventListener('change', e => { regrow = e.target.checked; player.stop(); seed++; reset(); });
        $('reset').addEventListener('click', () => { player.stop(); seed++; reset(); });
        $('next').addEventListener('click', () => { player.stop(); if (panes[0].t < MAXT) { panes.forEach(stepPane); render(); } });
        reset();
    }

    /* =====================================================================
     * 10. POHON PERMAINAN (SVG + penelusur langkah)
     * ===================================================================== */
    function gameTreeSVG(root, snap, showAB) {
        const all = [], leaves = [];
        (function walk(n) { all.push(n); if (n.type === 'leaf') leaves.push(n); else n.children.forEach(walk); })(root);
        const maxDepth = Math.max(...leaves.map(l => l.depth));
        const W = 722, padX = 46, top = 46, levelH = maxDepth <= 2 ? 100 : 88;
        const H = top + maxDepth * levelH + 44;
        const gap = (W - 2 * padX) / leaves.length;
        const pos = {};
        leaves.forEach((l, i) => { pos[l.id] = [padX + gap * (i + 0.5), top + l.depth * levelH]; });
        (function place(n) {
            if (n.type === 'leaf') return pos[n.id];
            const xs = n.children.map(place);
            pos[n.id] = [xs.reduce((s, p) => s + p[0], 0) / xs.length, top + n.depth * levelH];
            return pos[n.id];
        })(root);
        const st = id => (snap ? snap.st[id] : { status: 'idle', v: null });
        const leafSize = Math.min(30, gap - 6);
        let edges = '', nodes = '', labels = '';

        for (let d = 0; d <= maxDepth; d++) {
            const txt = d === maxDepth ? 'DAUN' : (d % 2 === 0 ? 'MAX' : 'MIN');
            labels += '<text class="gt-level" x="' + (W - 4) + '" y="' + (top + d * levelH + 4) + '" text-anchor="end">' + txt + '</text>';
        }
        all.forEach(n => {
            if (n.type === 'leaf') return;
            const [x1, y1] = pos[n.id];
            n.children.forEach(c => {
                const [x2, y2] = pos[c.id];
                const pruned = st(c.id).status === 'pruned';
                const best = snap && snap.done && n === root && c.id === snap.best;
                edges += '<line class="gt-edge' + (pruned ? ' pruned' : '') + (best ? ' best' : '') + '" x1="' + x1 + '" y1="' + (y1 + 14) +
                    '" x2="' + x2 + '" y2="' + (y2 - (c.type === 'leaf' ? leafSize / 2 : 16)) + '"/>';
                if (pruned && st(n.id).status !== 'pruned') {
                    const mx = x1 + (x2 - x1) * 0.62, my = y1 + (y2 - y1) * 0.62;
                    edges += '<path class="gt-cut" d="M' + (mx - 6) + ' ' + (my - 6) + 'L' + (mx + 6) + ' ' + (my + 6) +
                        'M' + (mx + 6) + ' ' + (my - 6) + 'L' + (mx - 6) + ' ' + (my + 6) + '"/>';
                }
            });
        });
        all.forEach(n => {
            const [x, y] = pos[n.id];
            const s = st(n.id);
            const current = snap && snap.cur === n.id;
            if (n.type === 'leaf') {
                const cls = 'gt-leaf ' + s.status + (current ? ' current' : '');
                nodes += '<rect class="' + cls + '" x="' + (x - leafSize / 2) + '" y="' + (y - leafSize / 2) + '" width="' + leafSize +
                    '" height="' + leafSize + '" rx="4"><title>' + n.name + '</title></rect>';
                nodes += '<text class="gt-val' + (current ? ' light' : '') + (s.status === 'pruned' ? ' struck' : '') + '" x="' + x + '" y="' + (y + 4.5) + '">' + n.value + '</text>';
                if (gap >= 34) labels += '<text class="gt-name" x="' + x + '" y="' + (y + leafSize / 2 + 13) + '" text-anchor="middle">' + n.name + '</text>';
                return;
            }
            const pts = n.type === 'max'
                ? [[x, y - 17], [x - 20, y + 14], [x + 20, y + 14]]
                : [[x - 20, y - 14], [x + 20, y - 14], [x, y + 17]];
            const cls = 'gt-node ' + n.type + ' ' + s.status + (current ? ' current' : '');
            nodes += '<polygon class="' + cls + '" points="' + pts.map(p => p.join(',')).join(' ') + '"><title>' + n.name + ' (' + n.type.toUpperCase() + ')</title></polygon>';
            if (s.v !== null && s.status !== 'pruned') {
                const light = current || s.status === 'done';
                const txt = fmtInf(s.v);
                nodes += '<text class="gt-val' + (light ? ' light' : '') + (txt.length > 2 ? ' small' : '') + '" x="' + x + '" y="' + (n.type === 'max' ? y + 9 : y + 1) + '">' + txt + '</text>';
            }
            labels += '<text class="gt-name" x="' + (x - 25) + '" y="' + (y + 4) + '" text-anchor="end">' + n.name + '</text>';
            if (showAB && s.a !== null && s.status !== 'idle' && s.status !== 'pruned') {
                labels += '<text class="gt-ab" x="' + x + '" y="' + (y - 24) + '">α=' + fmtInf(s.a) + '  β=' + fmtInf(s.b) + '</text>';
            }
        });
        return '<svg class="gt-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pohon permainan">' + edges + nodes + labels + '</svg>';
    }

    const TREE_LEGEND =
        '<div class="viz-legend">' +
        '<span><i class="gt-key max"></i>MAX</span>' +
        '<span><i class="gt-key min"></i>MIN</span>' +
        '<span><i class="vz-dot sq" style="background:#fff;box-shadow:inset 0 0 0 1.5px #90a4ae"></i>Daun (utilitas)</span>' +
        '<span><i class="vz-dot" style="background:#e65100"></i>Sedang diproses</span>' +
        '<span><i class="vz-dot" style="background:#ffe0b2;box-shadow:inset 0 0 0 1.5px #e65100"></i>Menunggu anak</span>' +
        '<span><i class="vz-dot sq" style="background:#c5cae9"></i>Sudah dihitung</span>' +
        '<span><b style="color:#c62828">×</b> Dipangkas</span>' +
        '<span><i class="vz-dot" style="background:#2e7d32"></i>Langkah terbaik</span>' +
        '</div>';

    function initGameTree(root) {
        const isStatic = root.dataset.static === 'true';
        let preset = root.dataset.tree || 'buku';
        let algo = root.dataset.algo || 'minimax';
        let order = root.dataset.order || 'asli';
        let spec = GAME_TREES[preset].spec;
        let tree = null, steps = [], idx = 0;
        root.classList.add('viz', 'viz-gametree');

        if (isStatic) {
            root.innerHTML = '<div class="viz-stage">' + gameTreeSVG(buildGameTree(spec), null, false) +
                '<div class="viz-legend"><span><i class="gt-key max"></i>MAX (memilih nilai terbesar)</span>' +
                '<span><i class="gt-key min"></i>MIN (memilih nilai terkecil)</span>' +
                '<span><i class="vz-dot sq" style="background:#fff;box-shadow:inset 0 0 0 1.5px #90a4ae"></i>Daun: utilitas bagi MAX</span></div></div>';
            return;
        }

        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Pohon <select data-role="tree">' + optionList(Object.keys(GAME_TREES).map(k => [k, GAME_TREES[k].label]), preset) + '</select></label>' +
            '<label>Algoritma <select data-role="algo">' + optionList([['minimax', 'Minimax'], ['alfabeta', 'Alfa-beta']], algo) + '</select></label>' +
            '<label>Urutan anak <select data-role="order">' + optionList([['asli', 'Asli'], ['terbaik', 'Terbaik dulu'], ['terburuk', 'Terburuk dulu']], order) + '</select></label>' +
            '<button type="button" class="viz-btn secondary" data-role="random">' + ICON('shuffle') + ' Acak nilai daun</button>' +
            '</div>' +
            '<div class="viz-body gt-body">' +
            '<div class="viz-stage"><div data-role="svg"></div>' + TREE_LEGEND + '</div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="viz-block"><h6>Tumpukan rekursi (dari akar)</h6><div class="viz-chips" data-role="stack"></div></div>' +
            '<div class="viz-stats" data-role="stats"></div>' +
            '<div class="viz-block"><h6>Daun yang dievaluasi pada pohon ini</h6><div class="vz-bars" data-role="bars"></div></div>' +
            '</div></div>' +
            '<div class="viz-controls">' +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Ulang</button>' +
            '<button type="button" class="viz-btn secondary" data-role="prev" aria-label="Langkah sebelumnya">' + ICON('backward-step') + '</button>' +
            '<button type="button" class="viz-btn" data-role="play">' + ICON('play') + ' Jalankan</button>' +
            '<button type="button" class="viz-btn secondary" data-role="next">Langkah ' + ICON('forward-step') + '</button>' +
            '<button type="button" class="viz-btn secondary" data-role="end">Hasil akhir ' + ICON('forward-fast') + '</button>' +
            '<label class="viz-speed">Kecepatan <input type="range" min="1" max="5" value="3" data-role="speed"></label>' +
            '</div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const player = makePlayer({
            count: () => steps.length, get: () => idx, set: i => { idx = i; render(); },
            playBtn: $('play'), speedInput: $('speed')
        });

        function compute() {
            player.stop();
            tree = buildGameTree(reorderSpec(spec, order));
            steps = runGame(tree, algo === 'alfabeta');
            idx = 0;
            renderBars();
            render();
        }

        function renderBars() {
            const count = (o, ab) => { const s = runGame(buildGameTree(reorderSpec(spec, o)), ab); return s[s.length - 1].evaluated; };
            const total = runGame(buildGameTree(spec), false).slice(-1)[0].leavesTotal;
            const rows = [
                ['minimax', null, 'Minimax (urutan apa pun)', total],
                ['alfabeta', 'asli', 'Alfa-beta, urutan asli', count('asli', true)],
                ['alfabeta', 'terbaik', 'Alfa-beta, terbaik dulu', count('terbaik', true)],
                ['alfabeta', 'terburuk', 'Alfa-beta, terburuk dulu', count('terburuk', true)]
            ];
            $('bars').innerHTML = rows.map(([a, o, name, n]) =>
                '<div class="vz-bar-row' + (a === algo && (o === null || o === order) ? ' current' : '') + '">' +
                '<span class="vz-bar-name">' + name + '</span>' +
                '<div class="vz-bar"><span style="width:' + (100 * n / total) + '%"></span></div>' +
                '<span class="vz-bar-val">' + n + ' dari ' + total + ' daun</span></div>').join('');
        }

        function render() {
            const s = steps[idx];
            const last = idx === steps.length - 1;
            $('svg').innerHTML = gameTreeSVG(tree, s, algo === 'alfabeta');
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            const msg = $('msg');
            msg.className = 'viz-msg' + (s.done ? ' goal' : '');
            msg.innerHTML = s.msg;
            $('stack').innerHTML = s.stack.length
                ? s.stack.map((n, i) => '<span class="vz-chip' + (i === s.stack.length - 1 ? ' frontier' : '') + '">' + n + '</span>').join('')
                : '<span class="vz-chip empty">(kosong)</span>';
            const prunedLeaves = Object.keys(s.st).filter(k => s.st[k].status === 'pruned').length;
            $('stats').innerHTML = 'Daun dievaluasi: <b>' + s.evaluated + '</b> dari ' + s.leavesTotal +
                (algo === 'alfabeta' ? ' · Simpul dipangkas: <b>' + prunedLeaves + '</b>' : '');
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
            $('end').disabled = last;
        }

        function randomize() {
            const rnd = x => Array.isArray(x) ? x.map(rnd) : Math.floor(Math.random() * 21);
            spec = rnd(GAME_TREES[preset].spec);
            compute();
        }

        $('tree').addEventListener('change', e => { preset = e.target.value; spec = GAME_TREES[preset].spec; compute(); });
        $('algo').addEventListener('change', e => { algo = e.target.value; compute(); });
        $('order').addEventListener('change', e => { order = e.target.value; compute(); });
        $('random').addEventListener('click', randomize);
        $('reset').addEventListener('click', () => { player.stop(); idx = 0; render(); });
        $('prev').addEventListener('click', () => { player.stop(); if (idx > 0) { idx--; render(); } });
        $('next').addEventListener('click', () => { player.stop(); if (idx < steps.length - 1) { idx++; render(); } });
        $('end').addEventListener('click', () => { player.stop(); idx = steps.length - 1; render(); });
        compute();
    }

    /* =====================================================================
     * 11. TIC-TAC-TOE MELAWAN AGEN MINIMAX
     * ===================================================================== */
    function initTicTacToe(root) {
        let human = 'X';
        let depth = +(root.dataset.depth || 0) || Infinity;
        let order = root.dataset.order || 'pusat';
        let board, turn, over, last, analysis, thinking;
        const fmtN = n => n.toLocaleString('id-ID');
        const fmtV = v => v > 0 ? '+' + v : v < 0 ? '−' + (-v) : '0';

        root.classList.add('viz', 'viz-ttt');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Anda bermain sebagai <select data-role="human">' +
            optionList([['X', 'X — Anda jalan duluan'], ['O', 'O — agen jalan duluan']], human) + '</select></label>' +
            '<label>Batas kedalaman agen <select data-role="depth">' +
            optionList([['0', 'Tanpa batas'], ['1', '1 ply'], ['2', '2 ply'], ['3', '3 ply'], ['4', '4 ply']], depth === Infinity ? '0' : String(depth)) + '</select></label>' +
            '<label>Urutan langkah <select data-role="order">' +
            optionList([['pusat', 'Tengah → sudut → sisi'], ['indeks', 'Kiri atas → kanan bawah']], order) + '</select></label>' +
            '</div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage ttt-stage">' +
            '<div class="ttt-board" data-role="board"></div>' +
            '<div class="ttt-status" data-role="status" aria-live="polite"></div>' +
            '<button type="button" class="viz-btn" data-role="new">' + ICON('rotate-left') + ' Permainan baru</button>' +
            '</div>' +
            '<div class="viz-panel">' +
            '<div class="viz-block"><h6>Pertimbangan agen pada langkah terakhirnya</h6>' +
            '<div class="ttt-think"><div class="ttt-mini" data-role="mini"></div><div class="ttt-think-note" data-role="note"></div></div></div>' +
            '<div class="viz-block"><h6>Simpul yang diperiksa untuk keputusan itu</h6><div class="vz-bars" data-role="nodes"></div></div>' +
            '<div class="viz-note">Nilai dilihat dari sudut pandang X (MAX): <b>+(100 − d)</b> = X menang dalam d langkah, <b>−(100 − d)</b> = O menang, <b>0</b> = seri. ' +
            'Jika kedalaman dibatasi, posisi yang belum selesai dinilai dengan fungsi evaluasi: garis terbuka X − garis terbuka O (−8 … +8).</div>' +
            '</div></div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const agent = () => (human === 'X' ? 'O' : 'X');

        function newGame() {
            board = Array(9).fill(null);
            turn = 'X';
            over = null; last = null; analysis = null; thinking = false;
            render();
            if (turn === agent()) agentMove();
        }

        function checkOver() {
            const w = tttWinner(board);
            if (w) over = w;
            else if (board.every(c => c)) over = { who: null, line: [] };
        }

        function agentMove() {
            thinking = true;
            render();
            setTimeout(() => {
                const me = agent();
                const res = tttDecide(board, me, { depth, order });
                analysis = { before: board.slice(), player: me, res };
                board[res.move] = me;
                last = res.move;
                thinking = false;
                turn = me === 'X' ? 'O' : 'X';
                checkOver();
                render();
            }, 350);
        }

        function render() {
            const winLine = over ? over.line : [];
            $('board').innerHTML = board.map((c, i) =>
                '<button type="button" class="ttt-cell' + (c === 'O' ? ' o' : '') + (winLine.indexOf(i) >= 0 ? ' win' : '') + (i === last ? ' last' : '') + '"' +
                ' data-i="' + i + '" aria-label="Petak ' + (i + 1) + (c ? ', berisi ' + c : ', kosong') + '"' +
                (c || over || thinking || turn !== human ? ' disabled' : '') + '>' + (c || '') + '</button>').join('');
            let status;
            if (over && over.who === human) status = ICON('trophy') + ' Anda menang! Agen dengan batas kedalaman ' + (depth === Infinity ? '' : depth + ' ply ') + 'bisa dikalahkan.';
            else if (over && over.who) status = ICON('robot') + ' Agen (' + over.who + ') menang.';
            else if (over) status = ICON('handshake') + ' Seri. Dengan permainan sempurna dari kedua pihak, tic-tac-toe selalu berakhir seri.';
            else if (thinking) status = ICON('gears') + ' Agen (' + agent() + ') sedang menelusuri pohon permainan…';
            else status = 'Giliran Anda (' + human + '). Klik petak kosong.';
            $('status').innerHTML = status;

            const mini = $('mini'), note = $('note'), nodes = $('nodes');
            if (!analysis) {
                mini.innerHTML = Array(9).fill('<div></div>').join('');
                note.innerHTML = 'Belum ada langkah agen.';
                nodes.innerHTML = '<span class="vz-chip empty">(belum ada)</span>';
                return;
            }
            const { before, player, res } = analysis;
            mini.innerHTML = before.map((c, i) => c
                ? '<div class="filled' + (c === 'O' ? ' o' : '') + '">' + c + '</div>'
                : '<div class="' + (i === res.move ? 'best' : '') + '">' + fmtV(res.values[i]) + '</div>').join('');
            note.innerHTML = 'Agen bermain sebagai <b>' + player + '</b> (' + (player === 'X' ? 'MAX' : 'MIN') + '), jadi memilih nilai ' +
                (player === 'X' ? '<b>terbesar</b>' : '<b>terkecil</b>') + '. Pilihannya: petak ' + (res.move + 1) + ' (' + fmtV(res.values[res.move]) + ').';
            const saved = res.nodesMinimax ? Math.round(100 * (1 - res.nodesAlphaBeta / res.nodesMinimax)) : 0;
            nodes.innerHTML =
                '<div class="vz-bar-row"><span class="vz-bar-name">Minimax</span><div class="vz-bar"><span style="width:100%"></span></div>' +
                '<span class="vz-bar-val">' + fmtN(res.nodesMinimax) + ' simpul</span></div>' +
                '<div class="vz-bar-row current"><span class="vz-bar-name">Alfa-beta</span><div class="vz-bar"><span style="width:' +
                Math.max(0.5, 100 * res.nodesAlphaBeta / res.nodesMinimax) + '%"></span></div>' +
                '<span class="vz-bar-val">' + fmtN(res.nodesAlphaBeta) + ' simpul — hemat ' + saved + '%, langkah yang dipilih sama</span></div>';
        }

        $('board').addEventListener('click', e => {
            const cell = e.target.closest('.ttt-cell');
            if (!cell || cell.disabled) return;
            board[+cell.dataset.i] = human;
            last = +cell.dataset.i;
            turn = agent();
            checkOver();
            render();
            if (!over) agentMove();
        });
        $('human').addEventListener('change', e => { human = e.target.value; newGame(); });
        $('depth').addEventListener('change', e => { depth = +e.target.value || Infinity; newGame(); });
        $('order').addEventListener('change', e => { order = e.target.value; newGame(); });
        $('new').addEventListener('click', newGame);
        newGame();
    }

    /* =====================================================================
     * 12. INISIALISASI
     * ===================================================================== */
    const INIT = {
        'romania-map': initRomaniaMap,
        'search': initSearch,
        'search-compare': initCompare,
        'grid-lab': initGridLab,
        'vacuum': initVacuum,
        'game-tree': initGameTree,
        'tictactoe': initTicTacToe
    };
    function boot() {
        document.querySelectorAll('[data-viz]').forEach(el => {
            const fn = INIT[el.dataset.viz];
            if (fn) fn(el);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
