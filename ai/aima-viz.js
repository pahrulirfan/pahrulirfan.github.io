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
 *   data-viz="state-space"     penjelajah ruang keadaan (data-problem="vacuum" | "jug" | "river" | "puzzle")
 *   data-viz="sg-graph"        graf latihan S–G: GBFS, A*, simple/steepest HC (data-algo, data-algos)
 *   data-viz="puzzle-tree"     pohon 8-puzzle langkah demi langkah (data-cases="h1,h2,h3" | data-case="astar" | "sthc")
 *   data-viz="puzzle-lab"      8-puzzle yang bisa dimainkan, nilai h₁ h₂ h₃ h* langsung terlihat
 *   data-viz="hill-land"       lanskap hill climbing satu dimensi (data-mode, data-start)
 *   data-viz="sld-line"        kasus jalur terpendek: jarak garis lurus vs jarak jalan (data-goal)
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
     * 3c. MESIN PENCARIAN HEURISTIK — graf latihan S–G, 8-puzzle, lanskap HC
     *     (materi lama "04. AI_B_2022_Heuristik": hlm. 19–25, 34, 38–39, 44–56)
     * ===================================================================== */
    // Graf latihan S–G. Posisi diukur dari gambar halaman 34 (piksel).
    const SG = {
        pos: {
            S: [1255, 410], B: [1338, 410], D: [1406, 410], E: [1536, 410], G: [1723, 410],
            C: [1456, 262], H: [1515, 315], I: [1668, 315], A: [1210, 485], F: [1579, 492], J: [1680, 492]
        },
        h: { S: 20, A: 21, B: 15, C: 8, D: 14, E: 5, F: 4, G: 0, H: 6, I: 3, J: 2 },
        edges: [
            ['S', 'B', 8], ['B', 'D', 2], ['D', 'E', 12], ['E', 'G', 8], ['S', 'C', 12],
            ['C', 'H', 4], ['D', 'H', 5], ['H', 'I', 6], ['I', 'G', 6], ['E', 'I', 6],
            ['S', 'A', 4], ['E', 'F', 6], ['F', 'J', 6], ['J', 'G', 2], ['A', 'G', 22]
        ],
        start: 'S', goal: 'G'
    };
    SG.adj = {};
    SG.edges.forEach(([a, b, c]) => {
        (SG.adj[a] = SG.adj[a] || {})[b] = c;
        (SG.adj[b] = SG.adj[b] || {})[a] = c;
    });
    SG.neighbors = (n, order) => {
        const ns = Object.keys(SG.adj[n]).sort();
        return order === 'desc' ? ns.reverse() : ns;
    };
    SG.cost = path => path.slice(1).reduce((s, n, i) => s + SG.adj[path[i]][n], 0);

    const SG_ALGOS = {
        greedy:   'Greedy Best First Search — f(n) = h(n)',
        astar:    'A* — f(n) = g(n) + h(n)',
        simple:   'Simple Hill Climbing',
        steepest: 'Steepest-Ascent Hill Climbing'
    };

    function sgRun(algo, order) {
        const h = SG.h, start = SG.start, goal = SG.goal;
        const steps = [];
        const b = s => '<b>' + s + '</b>';
        const pathTo = (parent, n) => { const p = []; for (; n; n = parent[n]) p.unshift(n); return p; };

        /* ---------- Hill climbing: hanya satu keadaan sekarang, tanpa Open ---------- */
        if (algo === 'simple' || algo === 'steepest') {
            const path = [start];
            const snap = (kind, msg, tried, extra) => steps.push(Object.assign({
                kind, msg, current: path[path.length - 1], path: path.slice(), tried: tried || [],
                open: [], closed: []
            }, extra || {}));
            snap('init', 'Mulai dari keadaan awal ' + b(start) + ' (h = ' + h[start] + '). Hill climbing hanya ' +
                'mengingat <em>satu</em> keadaan sekarang: tidak ada Open dan tidak ada Closed.');
            for (let guard = 0; guard < 20; guard++) {
                const cur = path[path.length - 1];
                const ns = SG.neighbors(cur, order);
                let next = null;
                const tried = [];
                if (algo === 'simple') {
                    for (const m of ns) {
                        const ok = h[m] < h[cur];
                        tried.push({ n: m, ok, pick: ok });
                        if (ok) { next = m; break; }
                    }
                } else {
                    ns.forEach(m => tried.push({ n: m, ok: h[m] < h[cur], pick: false }));
                    next = ns.reduce((a, m) => (h[m] < h[a] ? m : a), ns[0]);
                    if (h[next] < h[cur]) tried.find(t => t.n === next).pick = true;
                    else next = null;
                }
                const list = tried.map(t => b(t.n) + ' (h=' + h[t.n] + (t.pick ? ', dipilih' : t.ok ? '' : ', tidak lebih baik') + ')').join(', ');
                if (!next) {
                    snap('fail', 'Dari ' + b(cur) + ' (h = ' + h[cur] + ') ' +
                        (algo === 'simple' ? 'semua operator sudah dicoba: ' : 'semua suksesor dinilai: ') + list +
                        '. Tidak ada yang lebih baik, jadi pencarian <em>berhenti</em> di optimum lokal.', tried, { found: false });
                    return steps;
                }
                path.push(next);
                const how = algo === 'simple'
                    ? 'Coba operator satu per satu (' + (order === 'desc' ? 'urutan Z→A' : 'urutan abjad') + '): ' + list +
                      '. Tetangga <em>pertama</em> yang lebih baik langsung diambil'
                        + (tried.length < ns.length ? ', sisanya tidak diperiksa' : '') + '.'
                    : 'Nilai <em>semua</em> suksesor: ' + list + '. Ambil yang terbaik (h terkecil).';
                if (next === goal) {
                    snap('goal', 'Dari ' + b(cur) + ' (h = ' + h[cur] + '). ' + how + ' ' + b(goal) +
                        ' adalah tujuan, proses berhenti.', tried, { found: true, cost: SG.cost(path) });
                    return steps;
                }
                snap('move', 'Dari ' + b(cur) + ' (h = ' + h[cur] + '). ' + how + ' Keadaan sekarang menjadi ' +
                    b(next) + ' (h = ' + h[next] + ').', tried);
            }
            return steps;
        }

        /* ---------- GBFS & A*: daftar Open diurutkan ulang setiap langkah ---------- */
        const astar = algo === 'astar';
        const g = { [start]: 0 }, parent = { [start]: null };
        let open = [start];
        const closed = [];
        const f = n => astar ? g[n] + h[n] : h[n];
        const fTxt = n => astar ? 'f = ' + g[n] + ' + ' + h[n] + ' = ' + f(n) : 'h = ' + h[n];
        const snap = (kind, current, msg, extra) => steps.push(Object.assign({
            kind, current, msg,
            open: open.map(n => ({ n, g: g[n], h: h[n], f: f(n) })),
            closed: closed.slice(),
            tree: Object.keys(parent).filter(n => parent[n]).map(n => [parent[n], n])
        }, extra || {}));
        snap('init', null, 'Open = [' + b(start) + '], Closed = [ ]. Open selalu diurutkan menurut ' +
            (astar ? 'f(n) = g(n) + h(n)' : 'h(n)') + ', kepalanya yang terkecil.');
        let no = 0;
        while (open.length) {
            const n = open.shift();
            no++;
            if (n === goal) {
                const path = pathTo(parent, n);
                snap('goal', n, 'Ambil kepala Open: ' + b(n) + ' (' + fTxt(n) + '). Ini tujuan, proses berhenti. ' +
                    'Uji tujuan dilakukan saat simpul <em>diambil</em> dari Open, bukan saat dibangkitkan.',
                    { found: true, path, cost: g[n] });
                return steps;
            }
            closed.push(n);
            const added = [], updated = [], reopened = [], skipped = [];
            for (const m of SG.neighbors(n)) {
                const g2 = g[n] + SG.adj[n][m];
                if (astar) {
                    if (g[m] === undefined || g2 < g[m]) {
                        const old = g[m];
                        g[m] = g2;
                        parent[m] = n;
                        const ci = closed.indexOf(m);
                        if (ci >= 0) { closed.splice(ci, 1); reopened.push(b(m) + ': g ' + old + ' → ' + g2); }
                        else if (open.includes(m)) updated.push(b(m) + ': g ' + old + ' → ' + g2);
                        else added.push(b(m) + ' (' + fTxt(m) + ')');
                        if (!open.includes(m)) open.push(m);
                    } else skipped.push(m);
                } else if (!closed.includes(m) && !open.includes(m)) {
                    g[m] = g2;
                    parent[m] = n;
                    open.push(m);
                    added.push(b(m) + ' (h = ' + h[m] + ')');
                } else skipped.push(m);
            }
            open.sort((x, y) => f(x) - f(y));
            snap('expand', n, 'Langkah ' + no + ': ambil kepala Open ' + b(n) + ' (' + fTxt(n) + '), pindahkan ke Closed, lalu bangkitkan anaknya. ' +
                (added.length ? 'Masuk Open: ' + added.join(', ') + '. ' : '') +
                (updated.length ? 'Diperbarui karena lintasan lebih murah: ' + updated.join('; ') + '. ' : '') +
                (reopened.length ? '<em>Dibuka kembali</em> dari Closed karena lintasan lebih murah: ' + reopened.join('; ') + '. ' : '') +
                (skipped.length ? 'Dilewati (sudah di Open/Closed' + (astar ? ' dengan g sama atau lebih murah' : '') + '): ' + skipped.map(b).join(', ') + '. ' : '') +
                'Open diurutkan ulang.', { reopened: reopened.length > 0 });
        }
        snap('fail', null, 'Open kosong: tujuan tidak ditemukan.', { found: false });
        return steps;
    }

    // Jalur termurah S→G (Dijkstra kecil) sebagai pembanding hasil.
    function sgOptimal() {
        const dist = { [SG.start]: 0 }, done = new Set();
        const nodes = Object.keys(SG.adj);
        while (done.size < nodes.length) {
            let u = null;
            nodes.forEach(n => { if (!done.has(n) && dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n; });
            if (u === null) break;
            done.add(u);
            Object.keys(SG.adj[u]).forEach(v => {
                const d = dist[u] + SG.adj[u][v];
                if (dist[v] === undefined || d < dist[v]) dist[v] = d;
            });
        }
        return dist[SG.goal];
    }

    /* ---------- 8-puzzle ---------- */
    const PZ_DIR = { kiri: [0, -1], kanan: [0, 1], atas: [-1, 0], bawah: [1, 0] };
    function pzMove(s, dir) {
        const i = s.indexOf(0), r = Math.floor(i / 3), c = i % 3;
        const r2 = r + PZ_DIR[dir][0], c2 = c + PZ_DIR[dir][1];
        if (r2 < 0 || r2 > 2 || c2 < 0 || c2 > 2) return null;
        const t = s.slice(), j = r2 * 3 + c2;
        t[i] = t[j]; t[j] = 0;
        return t;
    }
    const PZ_H = {
        benar:     { label: 'h₁ = banyak ubin di posisi benar', best: 'max', f: (s, g) => s.filter((v, i) => v && v === g[i]).length },
        salah:     { label: 'h₂ = banyak ubin di posisi salah', best: 'min', f: (s, g) => s.filter((v, i) => v && v !== g[i]).length },
        manhattan: { label: 'h₃ = total gerakan (jarak Manhattan)', best: 'min', f: (s, g) => s.reduce((t, v, i) => {
            if (!v) return t;
            const j = g.indexOf(v);
            return t + Math.abs(Math.floor(i / 3) - Math.floor(j / 3)) + Math.abs(i % 3 - j % 3);
        }, 0) },
        salahBlank: { label: 'h = banyak posisi salah (blank ikut dihitung)', best: 'min', f: (s, g) => s.filter((v, i) => v !== g[i]).length }
    };
    const PZ_A = [1, 2, 3, 7, 8, 4, 6, 0, 5], PZ_A_GOAL = [1, 2, 3, 8, 0, 4, 7, 6, 5];
    const PZ_B_GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    const PZ_CASES = {
        h1:    { mode: 'hc', hName: 'h₁', start: PZ_A, goal: PZ_A_GOAL, h: 'benar', dirs: ['kiri', 'kanan', 'atas', 'bawah'], showAll: true },
        h2:    { mode: 'hc', hName: 'h₂', start: PZ_A, goal: PZ_A_GOAL, h: 'salah', dirs: ['kiri', 'kanan', 'atas', 'bawah'], showAll: true },
        h3:    { mode: 'hc', hName: 'h₃', start: PZ_A, goal: PZ_A_GOAL, h: 'manhattan', dirs: ['kiri', 'kanan', 'atas', 'bawah'], showAll: true },
        astar: { mode: 'astar', start: [1, 2, 0, 4, 5, 3, 7, 8, 6], goal: PZ_B_GOAL, h: 'salahBlank', dirs: ['bawah', 'kiri', 'atas', 'kanan'] },
        sthc:  { mode: 'hc', start: [1, 2, 3, 4, 8, 0, 7, 6, 5], goal: PZ_B_GOAL, h: 'manhattan', dirs: ['atas', 'kiri', 'bawah', 'kanan'], showAll: false }
    };
    const pzKey = s => s.join('');
    const pzTxt = s => '{' + s.map(v => v || '_').join(',') + '}';

    // Menghasilkan rekaman langkah berisi pohon yang tumbuh sedikit demi sedikit.
    function pzRun(caseName) {
        const C = PZ_CASES[caseName], H = PZ_H[C.h];
        const hv = s => H.f(s, C.goal);
        const better = (a, b) => (H.best === 'max' ? a > b : a < b);
        const isGoal = s => pzKey(s) === pzKey(C.goal);
        const nodes = [];
        const add = (state, parent, move, status) => {
            const n = { id: nodes.length, state, parent, move, status: status || 'normal',
                g: parent === null ? 0 : nodes[parent].g + 1, children: [] };
            n.h = state ? hv(state) : null;
            n.f = n.h === null ? null : n.g + n.h;
            nodes.push(n);
            if (parent !== null) nodes[parent].children.push(n.id);
            return n;
        };
        const steps = [];
        steps.nodes = nodes;   // pohon akhir; setiap langkah hanya menampilkan simpul id < count
        const snap = (kind, msg, extra) => steps.push(Object.assign({
            kind, msg, count: nodes.length,
            marks: nodes.map(n => ({ status: n.status, chosen: !!n.chosen, current: !!n.current, open: !!n.open }))
        }, extra || {}));
        const clearCur = () => nodes.forEach(n => { n.current = false; });
        const b = s => '<b>' + s + '</b>';
        const valTxt = n => C.mode === 'astar' ? 'f = ' + n.g + ' + ' + n.h + ' = ' + n.f : (C.hName || 'h') + ' = ' + n.h;
        const root = add(C.start.slice(), null, null);
        root.current = true;

        if (C.mode === 'hc') {
            const seen = new Set([pzKey(root.state)]);
            snap('init', 'Keadaan awal: ' + valTxt(root) + '. Tujuan: ' + (C.hName || 'h') + ' ' +
                (H.best === 'max' ? '= 8 (makin besar makin baik).' : '= 0 (makin kecil makin baik).'));
            let cur = root;
            for (let guard = 0; guard < 12 && !isGoal(cur.state); guard++) {
                const kids = [];
                C.dirs.forEach(d => {
                    const t = pzMove(cur.state, d);
                    if (!t) { if (C.showAll) kids.push(add(null, cur.id, d, 'invalid')); return; }
                    if (seen.has(pzKey(t))) { if (C.showAll) kids.push(add(t, cur.id, d, 'back')); return; }
                    kids.push(add(t, cur.id, d));
                });
                clearCur(); cur.current = true;
                const cands = kids.filter(k => k.status === 'normal');
                const desc = kids.map(k => k.status === 'invalid' ? b(k.move) + ': tidak valid (keluar papan)'
                    : k.status === 'back' ? b(k.move) + ': kembali ke keadaan sebelumnya (' + valTxt(k) + '), diabaikan'
                    : b(k.move) + ': ' + valTxt(k)).join('; ');
                snap('expand', 'Bangkitkan semua anak dari simpul yang disorot. ' + desc + '.');
                let best = null;
                cands.forEach(k => { if (!best || better(k.h, best.h)) best = k; });
                if (!best || !better(best.h, cur.h)) {
                    snap('fail', 'Tidak ada anak yang lebih baik dari ' + valTxt(cur) + '. Hill climbing terjebak.', { found: false });
                    return steps;
                }
                best.chosen = true;
                clearCur(); best.current = true;
                seen.add(pzKey(best.state));
                cur = best;
                snap(isGoal(best.state) ? 'goal' : 'choose', 'Pilih anak ' + b(best.move) + ' karena nilainya paling ' +
                    (H.best === 'max' ? 'besar' : 'kecil') + ' (' + valTxt(best) + ').' +
                    (isGoal(best.state) ? ' Keadaan ini sama dengan tujuan, proses berhenti.' : ''),
                    isGoal(best.state) ? { found: true, depth: best.g } : null);
            }
            return steps;
        }

        // A*: Open berisi simpul daun yang belum diekspansi, diurutkan menurut f.
        const closed = new Set();
        root.open = true;
        const openList = () => nodes.filter(n => n.open).sort((x, y) => x.f - y.f || x.id - y.id);
        const openTxt = () => openList().map(n => pzTxt(n.state) + ' f=' + n.f).join(', ');
        snap('init', 'Open = [awal, ' + valTxt(root) + ']. g(n) = kedalaman simpul, h(n) = banyak posisi yang masih salah.',
            { open: openTxt() });
        for (let guard = 0; guard < 12; guard++) {
            const n = openList()[0];
            n.open = false;
            clearCur(); n.current = true;
            if (isGoal(n.state)) {
                n.chosen = true;
                snap('goal', 'Ambil simpul Open dengan f terkecil: ' + pzTxt(n.state) + ' (' + valTxt(n) +
                    '). Ini tujuan, proses berhenti. Solusinya ' + n.g + ' gerakan.', { found: true, depth: n.g, open: openTxt() });
                return steps;
            }
            closed.add(pzKey(n.state));
            n.chosen = true;
            const desc = [];
            C.dirs.forEach(d => {
                const t = pzMove(n.state, d);
                if (!t) return;
                if (closed.has(pzKey(t))) {
                    const k = add(t, n.id, d, 'back');
                    desc.push(b(d) + ': sama dengan simpul di Closed (' + valTxt(k) + '), tidak dimasukkan ke Open');
                    return;
                }
                const k = add(t, n.id, d);
                k.open = true;
                desc.push(b(d) + ': ' + valTxt(k));
            });
            snap('expand', 'Ambil simpul Open dengan f terkecil (' + valTxt(n) + '), pindahkan ke Closed, lalu geser blank ke setiap arah yang mungkin. ' +
                desc.join('; ') + '.', { open: openTxt() });
        }
        return steps;
    }

    /* ---------- Lanskap hill climbing satu dimensi ---------- */
    // Nilai fungsi objektif di x = 0..60. Ada shoulder, maksimum global, maksimum lokal,
    // dan dataran ("flat" local maximum), seperti gambar halaman 44.
    const LAND = (() => {
        const v = [];
        const seg = (x0, x1, y0, y1) => { for (let x = x0; x <= x1; x++) v[x] = Math.round(y0 + (y1 - y0) * (x - x0) / Math.max(1, x1 - x0)); };
        seg(0, 8, 8, 32);      // naik
        seg(9, 13, 32, 32);    // shoulder (datar, lalu naik lagi)
        seg(14, 20, 38, 92);   // naik ke maksimum global
        seg(21, 30, 84, 22);   // turun
        seg(31, 36, 28, 58);   // naik ke maksimum lokal
        seg(37, 42, 52, 30);   // turun
        seg(43, 45, 36, 46);   // naik
        seg(46, 50, 46, 46);   // dataran di puncak ("flat" local maximum)
        seg(51, 60, 40, 6);    // turun
        return v;
    })();

    function landRun(x0, mode) {
        const v = LAND, N = v.length, steps = [];
        const gmax = Math.max.apply(null, v);
        const trail = [x0];
        const classify = x => {
            if (v[x] === gmax) return ['global', 'maksimum global'];
            const flatL = x > 0 && v[x - 1] === v[x], flatR = x < N - 1 && v[x + 1] === v[x];
            if (flatL || flatR) {
                // cari ujung dataran: bila di salah satu ujung masih ada tanjakan, ini shoulder
                let l = x, r = x;
                while (l > 0 && v[l - 1] === v[x]) l--;
                while (r < N - 1 && v[r + 1] === v[x]) r++;
                const up = (l > 0 && v[l - 1] > v[x]) || (r < N - 1 && v[r + 1] > v[x]);
                return up ? ['shoulder', 'shoulder (dataran yang sebenarnya masih bisa naik)'] : ['flat', 'dataran di puncak ("flat" local maximum)'];
            }
            return ['local', 'maksimum lokal'];
        };
        steps.push({ x: x0, trail: trail.slice(), kind: 'init', msg: 'Keadaan awal x = ' + x0 + ', nilai f = ' + v[x0] + '. Tetangga hanya dua: satu langkah ke kiri dan satu langkah ke kanan.' });
        let x = x0;
        for (let guard = 0; guard < 80; guard++) {
            const L = x > 0 ? x - 1 : null, R = x < N - 1 ? x + 1 : null;
            const txt = n => n === null ? '—' : 'f(' + n + ') = ' + v[n];
            let nx = null, how;
            if (mode === 'simple') {
                // operator dicoba berurutan: kiri dulu, baru kanan
                if (L !== null && v[L] > v[x]) { nx = L; how = 'Coba kiri: ' + txt(L) + ' lebih baik, langsung diambil (kanan tidak diperiksa).'; }
                else if (R !== null && v[R] > v[x]) { nx = R; how = 'Coba kiri: ' + txt(L) + ' tidak lebih baik. Coba kanan: ' + txt(R) + ' lebih baik, diambil.'; }
                else how = 'Kiri ' + txt(L) + ', kanan ' + txt(R) + ': tidak ada yang lebih baik dari f = ' + v[x] + '.';
            } else {
                const cands = [L, R].filter(n => n !== null && v[n] > v[x]);
                if (cands.length) nx = cands.reduce((a, n) => (v[n] > v[a] ? n : a));
                how = 'Nilai semua tetangga: kiri ' + txt(L) + ', kanan ' + txt(R) + '. ' +
                    (nx === null ? 'Tidak ada yang lebih baik dari f = ' + v[x] + '.' : 'Ambil yang terbaik: x = ' + nx + '.');
            }
            if (nx === null) {
                const [cls, name] = classify(x);
                steps.push({ x, trail: trail.slice(), kind: cls === 'global' ? 'goal' : 'fail', stop: cls,
                    msg: how + ' Hill climbing <b>berhenti</b> di ' + name + ', f = ' + v[x] + '.' +
                        (cls === 'global' ? '' : ' Puncak tertinggi (f = ' + gmax + ') tidak tercapai.') });
                return steps;
            }
            x = nx;
            trail.push(x);
            steps.push({ x, trail: trail.slice(), kind: 'move', msg: how + ' Pindah ke x = ' + x + ' (f = ' + v[x] + ').' });
        }
        return steps;
    }

    /* =====================================================================
     * Ekspor untuk pengujian di Node.js
     * ===================================================================== */
    const core = {
        ROMANIA, ALGOS, runSearch, shortestCost,
        GRID_H, GRID_DEFAULT, gridFromLayout, gridSearch, gridTrueCost, gridHeuristic,
        GAME_TREES, specValue, reorderSpec, buildGameTree, runGame,
        tttWinner, tttOpenLines, tttDecide,
        SG, sgRun, sgOptimal, PZ_CASES, PZ_H, pzMove, pzRun, LAND, landRun
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
     * 12. PENJELAJAH RUANG KEADAAN
     *     Pengguna menerapkan aksi satu per satu — ACTIONS(s) lalu RESULT(s, a) —
     *     dan melihat posisinya pada graf ruang keadaan. Tombol BFS menampilkan
     *     solusi terpendek. Ember air diadaptasi dari kelas PourProblem, 8-puzzle
     *     dari EightPuzzle (aima-python); graf penyedot debu mengikuti Gambar 3.2 AIMA.
     * ===================================================================== */
    const DIRT = { '1': 'kotor', '0': 'bersih' };
    const RIVER_IDX = { K: 0, S: 1, Y: 2, P: 3 };   // kunci keadaan = (kambing, serigala, sayuran, perahu)
    const RIVER_NAME = { P: 'petani + perahu', S: 'serigala', K: 'kambing', Y: 'sayuran' };
    const riverBank = (k, side) => 'PSKY'.split('').filter(c => k[RIVER_IDX[c]] === side).join('');
    function riverDanger(k) {
        if (k[0] !== k[3] && k[0] === k[1]) return 'kambing dimakan serigala';
        if (k[0] !== k[3] && k[0] === k[2]) return 'sayuran dimakan kambing';
        return null;
    }
    const ssBoard = (k, cls) => '<div class="ss-board' + (cls ? ' ' + cls : '') + '">' +
        k.split('').map(c => c === '0' ? '<span class="blank"></span>' : '<span>' + c + '</span>').join('') + '</div>';
    const ssBox = (x, y, w, h, rx) => '<rect class="box" x="' + (x - w / 2) + '" y="' + (y - h / 2) +
        '" width="' + w + '" height="' + h + '" rx="' + rx + '"/>';

    function jugActions(k) {
        const [x, y] = k.split(',').map(Number);
        const K = (a, b) => a + ',' + b;
        const dAB = Math.min(x, 3 - y), dBA = Math.min(y, 4 - x);
        return [
            x < 4 ? { name: 'Isi A', to: K(4, y), note: 'kaidah 1' } : { name: 'Isi A', why: 'A sudah penuh' },
            y < 3 ? { name: 'Isi B', to: K(x, 3), note: 'kaidah 2' } : { name: 'Isi B', why: 'B sudah penuh' },
            x > 0 ? { name: 'Kosongkan A', to: K(0, y), note: 'kaidah 3' } : { name: 'Kosongkan A', why: 'A sudah kosong' },
            y > 0 ? { name: 'Kosongkan B', to: K(x, 0), note: 'kaidah 4' } : { name: 'Kosongkan B', why: 'B sudah kosong' },
            dAB > 0 ? { name: 'Tuang A→B', to: K(x - dAB, y + dAB), note: x + y > 3 ? 'kaidah 6' : 'kaidah 8' }
                : { name: 'Tuang A→B', why: x === 0 ? 'A kosong' : 'B sudah penuh' },
            dBA > 0 ? { name: 'Tuang B→A', to: K(x + dBA, y - dBA), note: x + y > 4 ? 'kaidah 5' : 'kaidah 7' }
                : { name: 'Tuang B→A', why: y === 0 ? 'B kosong' : 'A sudah penuh' }
        ];
    }

    function riverActions(k) {
        const p = k[3], flip = p === '0' ? '1' : '0';
        return [['Menyeberang sendiri', null], ['Bawa serigala', 'S'], ['Bawa kambing', 'K'], ['Bawa sayuran', 'Y']]
            .map(([name, item]) => {
                if (item && k[RIVER_IDX[item]] !== p) return { name, why: RIVER_NAME[item] + ' tidak di tepi petani' };
                const t = k.split('');
                t[3] = flip;
                if (item) t[RIVER_IDX[item]] = flip;
                const to = t.join(''), bad = riverDanger(to);
                return bad ? { name, why: 'tidak aman: ' + bad, bad: to } : { name, to };
            });
    }

    function puzzleActions(k) {
        const i = k.indexOf('0'), r = Math.floor(i / 3), c = i % 3;
        return [['Atas', -1, 0, 'baris atas'], ['Bawah', 1, 0, 'baris bawah'], ['Kiri', 0, -1, 'kolom kiri'], ['Kanan', 0, 1, 'kolom kanan']]
            .map(([name, dr, dc, edge]) => {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr > 2 || nc < 0 || nc > 2) return { name, why: 'ubin kosong sudah di ' + edge };
                const j = nr * 3 + nc, t = k.split('');
                t[i] = t[j];
                t[j] = '0';
                return { name, to: t.join(''), note: 'ubin ' + k[j] + ' bergeser' };
            });
    }

    function vacNode(k, x, y, w, h) {
        let s = ssBox(x, y, w, h, 6);
        ['A', 'B'].forEach((r, i) => {
            const rx = x - 38 + i * 39, ry = y - 16;
            s += '<rect class="ss-room" x="' + rx + '" y="' + ry + '" width="37" height="32" rx="3"/>' +
                '<text class="ss-room-name" x="' + (rx + 3) + '" y="' + (ry + 9) + '">' + r + '</text>';
            if (k[i + 1] === '1') {
                s += [[24, 19], [30, 24], [22, 26], [30, 15]].map(([dx, dy]) =>
                    '<circle class="ss-dirt" cx="' + (rx + dx) + '" cy="' + (ry + dy) + '" r="2.4"/>').join('');
            }
            if (k[0] === r) s += '<circle class="ss-bot" cx="' + (rx + 12) + '" cy="' + (ry + 20) + '" r="6.5"/>';
        });
        return s;
    }

    function riverNode(k, x, y, w, h) {
        return ssBox(x, y, w, h, 6) +
            '<rect class="ss-water" x="' + (x - 3) + '" y="' + (y - h / 2 + 3) + '" width="6" height="' + (h - 6) + '"/>' +
            '<text class="ss-lbl ss-bank" x="' + (x - 7) + '" y="' + (y + 4.5) + '" text-anchor="end">' + riverBank(k, '0') + '</text>' +
            '<text class="ss-lbl ss-bank" x="' + (x + 7) + '" y="' + (y + 4.5) + '" text-anchor="start">' + riverBank(k, '1') + '</text>';
    }

    const SS_PROBLEMS = {
        vacuum: {
            initial: 'A11',
            initials: ['A11', 'B11', 'A10', 'B10', 'A01', 'B01', 'A00', 'B00'].map(k =>
                [k, '(' + k[0] + ',' + k[1] + ',' + k[2] + ') — robot di ' + k[0] + ', A ' + DIRT[k[1]] + ', B ' + DIRT[k[2]]]),
            label: k => '(' + k[0] + ',' + k[1] + ',' + k[2] + ')',
            describe: k => 'Robot di petak <b>' + k[0] + '</b>; petak A <b>' + DIRT[k[1]] + '</b>, petak B <b>' + DIRT[k[2]] + '</b>.',
            actions: k => [
                { name: 'Kiri', to: 'A' + k.slice(1) },
                { name: 'Kanan', to: 'B' + k.slice(1) },
                { name: 'Hisap', to: k[0] === 'A' ? 'A0' + k[2] : 'B' + k[1] + '0' }
            ],
            isGoal: k => k[1] === '0' && k[2] === '0',
            goalText: 'semua petak bersih',
            space: '8 kombinasi (2 lokasi × 2 × 2)',
            graph: {
                w: 560, h: 310, nw: 84, nh: 44, rx: 6, edges: 'all',
                all: ['A11', 'B11', 'A01', 'B01', 'A10', 'B10', 'B00', 'A00'],
                pos: {
                    A11: [210, 62], B11: [350, 62], A01: [70, 167], B01: [210, 167],
                    A10: [350, 167], B10: [490, 167], B00: [210, 272], A00: [350, 272]
                },
                loopSide: { B00: 'left', A00: 'right' },
                short: { Kiri: 'Ki', Kanan: 'Ka', Hisap: 'H' },
                node: vacNode,
                legend: '<span>Ki = Kiri · Ka = Kanan · H = Hisap · kotak kiri = petak A, kanan = petak B · titik cokelat = kotoran</span>'
            }
        },
        jug: {
            initial: '0,0',
            label: k => '(' + k + ')',
            describe: k => {
                const [x, y] = k.split(',');
                return 'Ember A (4 L) berisi <b>' + x + ' L</b>; ember B (3 L) berisi <b>' + y + ' L</b>.';
            },
            actions: jugActions,
            isGoal: k => k[0] === '2',
            goalText: 'ember A berisi tepat 2 liter',
            space: '20 kombinasi (x = 0–4, y = 0–3)',
            graph: {
                w: 545, h: 285, nw: 62, nh: 30, rx: 15, edges: 'local', curve: true,
                all: (() => {
                    const a = [];
                    for (let y = 0; y <= 3; y++) for (let x = 0; x <= 4; x++) a.push(x + ',' + y);
                    return a;
                })(),
                pos: k => { const [x, y] = k.split(',').map(Number); return [95 + x * 100, 60 + y * 60]; },
                short: { 'Kosongkan A': 'Kos. A', 'Kosongkan B': 'Kos. B', 'Tuang A→B': 'A→B', 'Tuang B→A': 'B→A' },
                decor: () => {
                    let s = '<rect class="ss-goalzone" x="255" y="36" width="80" height="228" rx="10"/>' +
                        '<text class="ss-axis goal" x="295" y="279" text-anchor="middle">tujuan: x = 2</text>';
                    for (let x = 0; x <= 4; x++) s += '<text class="ss-axis" x="' + (95 + x * 100) + '" y="24" text-anchor="middle">x = ' + x + '</text>';
                    for (let y = 0; y <= 3; y++) s += '<text class="ss-axis" x="30" y="' + (64 + y * 60) + '" text-anchor="middle">y = ' + y + '</text>';
                    return s;
                },
                legend: '<span>Kolom = isi ember A (x), baris = isi ember B (y) · panah oranye = aksi yang tersedia</span>'
            }
        },
        river: {
            initial: '0000',
            label: k => '(' + k.split('').join(',') + ')',
            describe: k => {
                const bank = side => riverBank(k, side).split('').map(c => RIVER_NAME[c]).join(', ') || '(kosong)';
                return 'Tepi asal: <b>' + bank('0') + '</b>.<br>Tepi seberang: <b>' + bank('1') + '</b>.';
            },
            actions: riverActions,
            isGoal: k => k === '1111',
            goalText: 'semuanya sudah di tepi seberang',
            space: '16 kombinasi (2⁴)',
            graph: {
                w: 590, h: 290, nw: 86, nh: 34, rx: 6, edges: 'all',
                pos: {
                    '0000': [55, 45], '1001': [175, 45], '1000': [295, 45], '1101': [415, 45], '0100': [535, 45],
                    '1011': [295, 150], '0010': [415, 150], '0111': [535, 150], '0110': [535, 255], '1111': [415, 255]
                },
                short: { 'Menyeberang sendiri': '—', 'Bawa serigala': 'S', 'Bawa kambing': 'K', 'Bawa sayuran': 'Y' },
                node: riverNode,
                legend: '<span>Garis biru di tengah kotak = sungai; kiri = tepi asal, kanan = tepi seberang · P = petani (+ perahu), S = serigala, K = kambing, Y = sayuran · label panah = yang dibawa (— = sendiri)</span>'
            }
        },
        puzzle: {
            initial: '312605748',
            initials: [
                ['312605748', 'Mudah — 4 langkah dari tujuan'],
                ['632705418', 'Sedang — 10 langkah dari tujuan'],
                ['724506831', 'Gambar 3.3 AIMA — 26 langkah dari tujuan']
            ],
            label: k => k.replace('0', '_').replace(/(...)(...)(...)/, '$1/$2/$3'),
            describe: k => {
                const i = k.indexOf('0');
                return 'Ubin kosong berada di baris ' + (Math.floor(i / 3) + 1) + ', kolom ' + (i % 3 + 1) + '.';
            },
            actions: puzzleActions,
            isGoal: k => k === '012345678',
            goalText: 'susunan ubin sama dengan keadaan tujuan',
            space: '181.440 keadaan terjangkau (9!/2)',
            pathStyle: 'actions',
            mini: k => ssBoard(k, 'mini'),
            stage: k => '<div class="ss-puzzle">' +
                '<figure><figcaption>Keadaan saat ini</figcaption>' + ssBoard(k) + '</figure>' +
                '<figure><figcaption>Keadaan tujuan</figcaption>' + ssBoard('012345678', 'goal small') + '</figure>' +
                '</div><p class="viz-note">Setiap tombol aksi di sebelah kanan adalah satu panah yang keluar dari keadaan ini. ' +
                'Graf ruang keadaan 8-puzzle berisi 181.440 simpul sehingga tidak digambar. Algoritma pencarian cukup ' +
                'membangkitkan tetangga seperlunya lewat ACTIONS dan RESULT.</p>'
        }
    };

    function ssReach(P, start) {
        const seen = new Set([start]), q = [start];
        for (let h = 0; h < q.length; h++) {
            P.actions(q[h]).forEach(a => { if (a.to && !seen.has(a.to)) { seen.add(a.to); q.push(a.to); } });
        }
        return seen;
    }

    // BFS graf dengan uji tujuan saat simpul dibangkitkan (sama dengan pseudocode BFS di materi)
    function ssBFS(P, start) {
        if (P.isGoal(start)) return { path: [{ s: start, a: null }], generated: 1 };
        const parent = new Map([[start, null]]), q = [start];
        for (let h = 0; h < q.length; h++) {
            const s = q[h];
            for (const a of P.actions(s)) {
                if (!a.to || parent.has(a.to)) continue;
                parent.set(a.to, [s, a.name]);
                if (P.isGoal(a.to)) {
                    const path = [];
                    for (let k = a.to; k !== null;) {
                        const pr = parent.get(k);
                        path.unshift({ s: k, a: pr ? pr[1] : null });
                        k = pr ? pr[0] : null;
                    }
                    return { path, generated: parent.size };
                }
                q.push(a.to);
            }
        }
        return null;
    }

    // Titik di tepi kotak (pusat c, setengah ukuran hw × hh) searah vektor d, ditambah jarak 3px
    function ssClip(c, d, hw, hh) {
        const ax = Math.abs(d[0]), ay = Math.abs(d[1]), len = Math.hypot(d[0], d[1]) || 1;
        const s = Math.min(ax ? hw / ax : Infinity, ay ? hh / ay : Infinity);
        return [c[0] + d[0] * s + d[0] / len * 3, c[1] + d[1] * s + d[1] / len * 3];
    }

    // Sisi a→b sebagai kurva kuadrat (lurus bila bend = false). Kurva dibelokkan ke arah tengah kanvas.
    function ssEdge(G, a, b, bend) {
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        let nx = -dy / len, ny = dx / len;
        if (nx * (G.w / 2 - mx) + ny * (G.h / 2 - my) < 0) { nx = -nx; ny = -ny; }
        const off = bend ? Math.min(0.4 * len, 70) : 0;
        const c = [mx + nx * off, my + ny * off];
        const p0 = ssClip(a, [c[0] - a[0], c[1] - a[1]], G.nw / 2, G.nh / 2);
        const p2 = ssClip(b, [c[0] - b[0], c[1] - b[1]], G.nw / 2, G.nh / 2);
        const f = v => v.toFixed(1);
        return {
            d: 'M' + f(p0[0]) + ',' + f(p0[1]) + ' Q' + f(c[0]) + ',' + f(c[1]) + ' ' + f(p2[0]) + ',' + f(p2[1]),
            lx: 0.25 * p0[0] + 0.5 * c[0] + 0.25 * p2[0],
            ly: 0.25 * p0[1] + 0.5 * c[1] + 0.25 * p2[1],
            ox: dy / len, oy: -dx / len   // normal di sisi kiri arah a→b
        };
    }

    function ssLoop(G, p, side, text, marker) {
        const [x, y] = p, hw = G.nw / 2, hh = G.nh / 2;
        let d, lx, ly, anchor = 'middle';
        if (side === 'left' || side === 'right') {
            const sg = side === 'left' ? -1 : 1, X = x + sg * hw;
            d = 'M' + X + ',' + (y - 8) + ' C' + (X + sg * 30) + ',' + (y - 20) + ' ' + (X + sg * 30) + ',' + (y + 20) + ' ' + (X + sg * 2) + ',' + (y + 8);
            lx = X + sg * 28; ly = y; anchor = side === 'left' ? 'end' : 'start';
        } else {
            const Y = y - hh;
            d = 'M' + (x - 9) + ',' + Y + ' C' + (x - 22) + ',' + (Y - 30) + ' ' + (x + 22) + ',' + (Y - 30) + ' ' + (x + 9) + ',' + (Y - 2);
            lx = x; ly = Y - 30;
        }
        return '<path class="ss-edge" d="' + d + '" marker-end="' + marker + '"/>' +
            '<text class="ss-elbl" x="' + lx + '" y="' + (ly + 3.5) + '" text-anchor="' + anchor + '">' + esc(text) + '</text>';
    }

    function ssGraph(P, st, uid) {
        const G = P.graph;
        const pos = k => (typeof G.pos === 'function' ? G.pos(k) : G.pos[k]);
        const short = n => (G.short && G.short[n]) || n;
        const M = t => 'url(#' + uid + '-' + t + ')';
        const cur = st.hist[st.hist.length - 1].s;
        const onPath = new Set(st.hist.map(h => h.s));
        const next = new Map();
        P.actions(cur).forEach(a => { if (a.to && a.to !== cur && !next.has(a.to)) next.set(a.to, a.name); });
        const lbl = (x, y, t, cls) => '<text class="ss-elbl' + (cls ? ' ' + cls : '') + '" x="' + x.toFixed(1) +
            '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="middle">' + esc(t) + '</text>';
        let base = '', over = '', labels = '';

        if (G.edges === 'all') {
            const E = new Map(), selfLoop = {};
            st.reach.forEach(s => P.actions(s).forEach(a => {
                if (!a.to) return;
                if (a.to === s) (selfLoop[s] = selfLoop[s] || []).push(short(a.name));
                else if (!E.has(s + '>' + a.to)) E.set(s + '>' + a.to, short(a.name));
            }));
            const done = new Set();
            E.forEach((name, key) => {
                if (done.has(key)) return;
                const [s, t] = key.split('>');
                const back = E.get(t + '>' + s);
                done.add(key);
                if (back !== undefined) done.add(t + '>' + s);
                const e = ssEdge(G, pos(s), pos(t), false);
                base += '<path class="ss-edge" d="' + e.d + '" marker-end="' + M('b') + '"' +
                    (back !== undefined ? ' marker-start="' + M('b') + '"' : '') + '/>';
                if (back === undefined || back === name) labels += lbl(e.lx, e.ly, name);
                else labels += lbl(e.lx + e.ox * 9, e.ly + e.oy * 9, name) + lbl(e.lx - e.ox * 9, e.ly - e.oy * 9, back);
            });
            Object.keys(selfLoop).forEach(s => {
                base += ssLoop(G, pos(s), (G.loopSide && G.loopSide[s]) || 'top', selfLoop[s].join(', '), M('b'));
            });
        }
        for (let i = 1; i < st.hist.length; i++) {
            const a = st.hist[i - 1].s, b = st.hist[i].s;
            if (a !== b) over += '<path class="ss-edge path" d="' + ssEdge(G, pos(a), pos(b), G.curve).d + '" marker-end="' + M('p') + '"/>';
        }
        next.forEach((name, t) => {
            const e = ssEdge(G, pos(cur), pos(t), G.curve);
            over += '<path class="ss-edge out" d="' + e.d + '" marker-end="' + M('o') + '"/>';
            if (G.edges !== 'all') labels += lbl(e.lx, e.ly, short(name), 'out');
        });

        const nodes = (G.all || Array.from(st.reach)).map(k => {
            const [x, y] = pos(k);
            const cls = ['ss-node'];
            if (!st.reach.has(k)) cls.push('unreach');
            if (k === cur) cls.push('current'); else if (onPath.has(k)) cls.push('visited');
            if (next.has(k)) cls.push('next');
            const ring = (pad, c) => '<rect class="' + c + '" x="' + (x - G.nw / 2 - pad) + '" y="' + (y - G.nh / 2 - pad) +
                '" width="' + (G.nw + 2 * pad) + '" height="' + (G.nh + 2 * pad) + '" rx="' + (G.rx + pad) + '"/>';
            return '<g class="' + cls.join(' ') + '" data-k="' + k + '"><title>' + esc(P.label(k)) + '</title>' +
                (k === st.init ? ring(4, 'ss-ring-start') : '') +
                (P.isGoal(k) ? ring(k === st.init ? 8 : 4, 'ss-ring-goal') : '') +
                (G.node ? G.node(k, x, y, G.nw, G.nh)
                    : ssBox(x, y, G.nw, G.nh, G.rx) + '<text class="ss-lbl" x="' + x + '" y="' + (y + 4.5) + '" text-anchor="middle">' + esc(P.label(k)) + '</text>') +
                '</g>';
        }).join('');

        const mk = (t, color) => '<marker id="' + uid + '-' + t + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" ' +
            'markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0.5 L10,5 L0,9.5 z" fill="' + color + '"/></marker>';
        return '<svg class="ss-svg" viewBox="0 0 ' + G.w + ' ' + G.h + '" role="img" aria-label="Graf ruang keadaan">' +
            '<defs>' + mk('b', '#90a4ae') + mk('o', '#e65100') + mk('p', '#2e7d32') + '</defs>' +
            (G.decor ? G.decor() : '') + base + over + nodes + labels + '</svg>';
    }

    const ssLegend = G => '<div class="viz-legend">' +
        '<span><i class="vz-dot sq" style="background:#fff3e0;box-shadow:inset 0 0 0 2px #e65100"></i>Keadaan saat ini</span>' +
        '<span><i class="vz-dot sq" style="background:#e8eaf6;box-shadow:inset 0 0 0 2px #7986cb"></i>Sudah dilalui</span>' +
        '<span><i class="vz-line out"></i>Aksi yang tersedia</span>' +
        '<span><i class="vz-line"></i>Lintasan</span>' +
        '<span><i class="vz-ring sq"></i>Awal</span>' +
        '<span><i class="vz-ring goal sq"></i>Tujuan</span>' +
        (G.all ? '<span><i class="vz-dot sq" style="background:#fafafa;box-shadow:inset 0 0 0 1.5px #b0bec5"></i>Tidak terjangkau</span>' : '') +
        (G.legend || '') + '</div>';

    let ssUid = 0;
    function initStateSpace(root) {
        const P = SS_PROBLEMS[root.dataset.problem] || SS_PROBLEMS.vacuum;
        const uid = 'ss' + (++ssUid);
        const st = { init: root.dataset.init || P.initial, hist: [], reach: null, plan: null, planIdx: 0 };
        const bfsCache = {};
        const bfsFor = s => bfsCache[s] || (bfsCache[s] = ssBFS(P, s));

        root.classList.add('viz', 'viz-ss');
        root.innerHTML =
            (P.initials ? '<div class="viz-toolbar"><label>Keadaan awal <select data-role="init">' +
                optionList(P.initials, st.init) + '</select></label></div>' : '') +
            '<div class="viz-body">' +
            '<div class="viz-stage"><div data-role="stage"></div>' + (P.graph ? ssLegend(P.graph) : '') + '</div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="now"></span><span class="vz-tag goal" data-role="goal" hidden>Tujuan tercapai</span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="viz-block"><h6>ACTIONS(s) — aksi dari keadaan ini</h6><div class="ss-acts" data-role="acts"></div></div>' +
            '<div class="viz-block"><h6>Lintasan dari keadaan awal (klik untuk kembali)</h6><div class="ss-path" data-role="path"></div></div>' +
            '<div class="viz-stats" data-role="stats"></div>' +
            '<div class="viz-result" data-role="result" hidden></div>' +
            '</div></div>' +
            '<div class="viz-controls">' +
            '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Ulang</button>' +
            '<button type="button" class="viz-btn secondary" data-role="undo">' + ICON('backward-step') + ' Langkah sebelumnya</button>' +
            '<button type="button" class="viz-btn" data-role="step">Langkah berikutnya ' + ICON('forward-step') + '</button>' +
            '</div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const current = () => st.hist[st.hist.length - 1].s;
        function reset() {
            st.hist = [{ s: st.init, a: null }];
            st.plan = null;
            st.reach = P.graph ? ssReach(P, st.init) : null;
            render();
        }
        function apply(a) {
            st.hist.push({ s: a.to, a: a.name });
            render();
        }
        // Satu langkah berikutnya dari solusi terpendek (BFS) mulai keadaan saat ini. Rencana BFS
        // disimpan: bila keadaan saat ini ada di rencana (mis. setelah "sebelumnya"), rencana yang
        // sama diteruskan; jika pengguna menyimpang, BFS dihitung ulang dari keadaan saat ini.
        // Penjelasan disimpan di setiap langkah agar terbaca lagi saat pengguna mundur.
        function nextStep() {
            const cur = current();
            if (P.isGoal(cur)) return;
            let fresh = '';
            const k = st.plan ? st.plan.findIndex(p => p.s === cur) : -1;
            if (k >= 0 && k < st.plan.length - 1) st.planIdx = k;
            else {
                const r = ssBFS(P, cur);
                if (!r) return;
                st.plan = r.path;
                st.planIdx = 0;
                fresh = 'BFS dari <code>' + esc(P.label(cur)) + '</code> menemukan solusi <b>' + (r.path.length - 1) +
                    '</b> langkah setelah membangkitkan <b>' + r.generated.toLocaleString('id-ID') + '</b> keadaan.<br>';
            }
            const step = st.plan[++st.planIdx];
            const act = P.actions(cur).find(x => x.to === step.s && x.name === step.a);
            const left = st.plan.length - 1 - st.planIdx, n = st.hist.length;
            st.hist.push({
                s: step.s, a: step.a,
                note: fresh + '<b>Langkah ' + n + ' dari ' + (n + left) + ':</b> aksi <b>' + esc(step.a) + '</b>' +
                    (act && act.note ? ' (' + esc(act.note) + ')' : '') + ' mengubah <code>' + esc(P.label(cur)) +
                    '</code> menjadi <code>' + esc(P.label(step.s)) + '</code>. ' +
                    (left ? 'Masih ' + left + ' langkah lagi menuju tujuan.' : 'Tujuan tercapai.')
            });
            render();
        }

        function render() {
            const cur = current(), last = st.hist[st.hist.length - 1], goal = P.isGoal(cur);
            $('stage').innerHTML = P.graph ? ssGraph(P, st, uid) : P.stage(cur);
            $('now').innerHTML = 'Keadaan saat ini: <code>' + esc(P.label(cur)) + '</code>';
            $('goal').hidden = !goal;
            $('msg').className = 'viz-msg' + (goal ? ' goal' : '');
            $('msg').innerHTML = P.describe(cur) + '<br>' + (last.note ? last.note
                : last.a ? 'Aksi <b>' + esc(last.a) + '</b> menghasilkan keadaan ini: RESULT(s, a) = <code>' + esc(P.label(cur)) + '</code>.'
                : 'Pilih salah satu aksi di bawah' + (P.graph ? ', atau klik keadaan tetangga (bergaris putus-putus oranye) pada graf.' : '.'));
            $('acts').innerHTML = P.actions(cur).map((a, i) => {
                const res = a.to || a.bad;
                const tgt = res ? (P.mini ? P.mini(res) : '<code>' + esc(P.label(res)) + '</code>') : '';
                const note = a.to ? (a.to === cur ? 'keadaan tidak berubah' : (a.note || '')) : a.why;
                return '<button type="button" class="ss-act' + (a.bad ? ' bad' : '') + '" data-i="' + i + '"' + (a.to ? '' : ' disabled') + '>' +
                    '<b>' + esc(a.name) + '</b>' + (res ? '<span class="ss-to">→ ' + tgt + '</span>' : '') +
                    (note ? '<small>' + esc(note) + '</small>' : '') + '</button>';
            }).join('');
            $('path').innerHTML = st.hist.map((h, i) => {
                const txt = P.pathStyle === 'actions' ? (i ? h.a : 'awal') : P.label(h.s);
                const arrow = i && P.pathStyle !== 'actions' ? '<span class="ss-arrow">' + esc(h.a) + ' →</span>' : '';
                return arrow + '<button type="button" class="vz-chip ss-chip' + (i === st.hist.length - 1 ? ' cur' : '') +
                    '" data-i="' + i + '" title="Kembali ke langkah ' + i + '">' + esc(txt) + '</button>';
            }).join('');
            const n = st.hist.length - 1, uniq = new Set(st.hist.map(h => h.s)).size;
            $('stats').innerHTML = 'Biaya lintasan: <b>' + n + '</b> aksi · Keadaan berbeda yang dilalui: <b>' + uniq + '</b><br>' +
                (P.graph ? 'Terjangkau dari keadaan awal ini: <b>' + st.reach.size + '</b> keadaan, dari ' + P.space + '.'
                    : 'Ruang keadaan: ' + P.space + '.');
            const res = $('result');
            res.hidden = !goal;
            if (goal) {
                const m = bfsFor(st.init).path.length - 1, ok = n <= m;
                res.className = 'viz-result ' + (ok ? 'ok' : 'warn');
                res.innerHTML = ICON(ok ? 'circle-check' : 'triangle-exclamation') + ' <span>Uji tujuan terpenuhi: ' + P.goalText + '. ' +
                    (ok ? 'Lintasan ' + n + ' aksi ini termasuk solusi terpendek.'
                        : 'Lintasan Anda ' + n + ' aksi, padahal solusi terpendek hanya ' + m + ' aksi.') + '</span>';
            }
            $('undo').disabled = st.hist.length < 2;
            $('step').disabled = goal;
        }

        $('acts').addEventListener('click', e => {
            const b = e.target.closest('.ss-act');
            if (b && !b.disabled) apply(P.actions(current())[+b.dataset.i]);
        });
        $('stage').addEventListener('click', e => {
            const g = e.target.closest('[data-k]');
            if (!g) return;
            const cur = current(), a = P.actions(cur).find(x => x.to === g.dataset.k && x.to !== cur);
            if (a) apply(a);
        });
        $('path').addEventListener('click', e => {
            const b = e.target.closest('[data-i]');
            if (!b) return;
            st.hist = st.hist.slice(0, +b.dataset.i + 1);
            render();
        });
        $('reset').addEventListener('click', reset);
        $('undo').addEventListener('click', () => { if (st.hist.length > 1) { st.hist.pop(); render(); } });
        $('step').addEventListener('click', nextStep);
        if (P.initials) $('init').addEventListener('change', e => { st.init = e.target.value; reset(); });
        reset();
    }

    /* =====================================================================
     * 12b. PENCARIAN HEURISTIK — graf S–G, pohon 8-puzzle, lab 8-puzzle,
     *      lanskap hill climbing, dan jarak garis lurus
     * ===================================================================== */
    // Tombol langkah: sengaja tanpa "Jalankan" agar mahasiswa menelusuri satu per satu.
    const STEP_CONTROLS =
        '<div class="viz-controls">' +
        '<button type="button" class="viz-btn secondary" data-role="reset">' + ICON('rotate-left') + ' Ulang</button>' +
        '<button type="button" class="viz-btn secondary" data-role="prev">' + ICON('backward-step') + ' Langkah sebelumnya</button>' +
        '<button type="button" class="viz-btn" data-role="next">Langkah berikutnya ' + ICON('forward-step') + '</button>' +
        '</div>';
    function bindSteps($, get, set, count) {
        $('reset').addEventListener('click', () => set(0));
        $('prev').addEventListener('click', () => { if (get() > 0) set(get() - 1); });
        $('next').addEventListener('click', () => { if (get() < count() - 1) set(get() + 1); });
    }
    const chips = (arr, fn, cls) => arr.length
        ? arr.map(x => '<span class="vz-chip' + (cls ? ' ' + cls : '') + '">' + fn(x) + '</span>').join('')
        : '<span class="vz-chip empty">(kosong)</span>';

    /* ---------- Graf latihan S–G ---------- */
    const SGX = n => 58 + (SG.pos[n][0] - 1210) * 1.3;
    const SGY = n => 46 + (SG.pos[n][1] - 262) * 1.3;
    const SG_BOTTOM = 46 + (522 - 262) * 1.3;
    const SG_HOFF = { S: [-26, -26], B: [0, -31], D: [0, 38], E: [-30, -26], G: [32, -26], C: [-32, -16],
        H: [30, -22], I: [0, -31], A: [-32, -18], F: [0, -31], J: [0, -31] };

    function sgSVG(o) {
        // o: { status: {n: cls}, tree: [[a,b]], path: [..], ring: {n: cls} }
        const R = 16, key = (a, b) => (a < b ? a + b : b + a);
        const tree = new Set((o.tree || []).map(([a, b]) => key(a, b)));
        const path = new Set();
        (o.path || []).forEach((n, i, p) => { if (i) path.add(key(p[i - 1], n)); });
        let edges = '', labels = '', nodes = '';
        SG.edges.forEach(([a, b, c]) => {
            const k = key(a, b), cls = 'sg-edge' + (path.has(k) ? ' path' : tree.has(k) ? ' tree' : '');
            let d, lx, ly;
            if (k === 'AG') {
                const xk = SGX('G') + R + 26;
                d = 'M' + SGX('A') + ',' + (SGY('A') + R) + ' V' + SG_BOTTOM + ' H' + xk + ' V' + SGY('G') + ' H' + (SGX('G') + R);
                lx = (SGX('A') + xk) / 2; ly = SG_BOTTOM - 6;
            } else {
                const x1 = SGX(a), y1 = SGY(a), x2 = SGX(b), y2 = SGY(b);
                d = 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2;
                const L = Math.hypot(x2 - x1, y2 - y1);
                let nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
                if (ny > 0 || (Math.abs(ny) < 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
                lx = (x1 + x2) / 2 + nx * 11; ly = (y1 + y2) / 2 + ny * 11 + 4;
            }
            edges += '<path class="' + cls + '" d="' + d + '"/>';
            labels += '<text class="sg-cost" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle">' + c + '</text>';
        });
        Object.keys(SG.pos).forEach(n => {
            const x = SGX(n), y = SGY(n), cls = 'sg-node ' + ((o.status || {})[n] || '');
            const ring = (o.ring || {})[n];
            if (ring) nodes += '<circle class="sg-ring ' + ring + '" cx="' + x + '" cy="' + y + '" r="' + (R + 6) + '"/>';
            nodes += '<g class="' + cls + '">' + (n === 'S' || n === 'G'
                ? '<rect x="' + (x - R) + '" y="' + (y - R) + '" width="' + 2 * R + '" height="' + 2 * R + '" rx="3"/>'
                : '<circle cx="' + x + '" cy="' + y + '" r="' + R + '"/>') +
                '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle">' + n + '</text></g>';
            const [dx, dy] = SG_HOFF[n];
            labels += '<text class="sg-h" x="' + (x + dx) + '" y="' + (y + dy + 4) + '" text-anchor="middle">h=' + SG.h[n] + '</text>';
        });
        const sx = SGX('S') - R;
        return '<svg class="sg-svg" viewBox="0 0 780 400" role="img" aria-label="Graf latihan S sampai G dengan bobot sisi dan nilai h">' +
            '<defs><marker id="sg-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
            '<path d="M0,0 L10,5 L0,10 z" fill="#1a2a4a"/></marker></defs>' +
            edges + '<line x1="' + (sx - 34) + '" y1="' + SGY('S') + '" x2="' + (sx - 3) + '" y2="' + SGY('S') +
            '" stroke="#1a2a4a" stroke-width="2" marker-end="url(#sg-arr)"/>' + labels + nodes + '</svg>';
    }

    function initSgGraph(root) {
        const algos = (root.dataset.algos || 'greedy,astar,simple,steepest').split(',').map(s => s.trim());
        let algo = root.dataset.algo || algos[0], order = 'asc';
        let steps = [], idx = 0;
        const optimal = sgOptimal();
        root.classList.add('viz', 'viz-sg');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            (algos.length > 1 ? '<label>Metode <select data-role="algo">' + optionList(algos.map(a => [a, SG_ALGOS[a]]), algo) + '</select></label>'
                : '<label>Metode: ' + SG_ALGOS[algo] + '</label>') +
            '<label data-role="order-wrap">Urutan operator <select data-role="order">' +
            optionList([['asc', 'abjad (A → Z)'], ['desc', 'terbalik (Z → A)']], order) + '</select></label>' +
            '</div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage"><div data-role="graph"></div><div class="viz-legend" data-role="legend"></div></div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="viz-block"><h6 data-role="t1"></h6><div class="viz-chips" data-role="c1"></div></div>' +
            '<div class="viz-block"><h6 data-role="t2"></h6><div class="viz-chips" data-role="c2"></div></div>' +
            '<div class="viz-result" data-role="result" hidden></div>' +
            '</div></div>' + STEP_CONTROLS;
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const hc = () => algo === 'simple' || algo === 'steepest';

        function compute() {
            steps = sgRun(algo, order);
            idx = 0;
            $('order-wrap').hidden = algo !== 'simple';
            $('legend').innerHTML = hc()
                ? '<span><i class="vz-dot" style="background:#e65100"></i>Keadaan sekarang</span>' +
                  '<span><i class="vz-ring sg-ok"></i>Dicoba, dipilih</span>' +
                  '<span><i class="vz-ring sg-bad"></i>Dicoba, tidak lebih baik</span>' +
                  '<span><i class="vz-dot" style="background:#2e7d32"></i>Jalur yang dilalui</span>' +
                  '<span class="vz-h-key">h=… = jarak garis lurus ke G</span>'
                : '<span><i class="vz-dot" style="background:#f9a825"></i>Di Open</span>' +
                  '<span><i class="vz-dot" style="background:#e65100"></i>Sedang diambil</span>' +
                  '<span><i class="vz-dot" style="background:#7986cb"></i>Di Closed</span>' +
                  '<span><i class="vz-dot" style="background:#2e7d32"></i>Jalur solusi</span>' +
                  '<span class="vz-h-key">h=… = jarak garis lurus ke G</span>';
            render();
        }

        function render() {
            const s = steps[idx], last = idx === steps.length - 1;
            const status = {}, ring = {};
            if (hc()) {
                s.path.forEach(n => { status[n] = 'path'; });
                status[s.current] = s.kind === 'goal' ? 'path' : 'cur';
                s.tried.forEach(t => { ring[t.n] = t.pick ? 'sg-ok' : 'sg-bad'; });
                $('graph').innerHTML = sgSVG({ status, ring, path: s.path });
                $('t1').textContent = 'Keadaan sekarang';
                $('c1').innerHTML = chips([s.current], n => n + '<small>h=' + SG.h[n] + '</small>', 'cur');
                $('t2').textContent = 'Jalur yang sudah dilalui';
                $('c2').innerHTML = chips(s.path, n => n, 'path');
            } else {
                s.closed.forEach(n => { status[n] = 'closed'; });
                s.open.forEach(o => { status[o.n] = 'open'; });
                if (s.current) status[s.current] = 'cur';
                if (s.path) s.path.forEach(n => { status[n] = 'path'; });
                $('graph').innerHTML = sgSVG({ status, tree: s.tree, path: s.path });
                $('t1').textContent = 'Open — diurutkan menurut ' + (algo === 'astar' ? 'f(n) = g(n) + h(n)' : 'h(n)') + ', kepala di kiri';
                $('c1').innerHTML = chips(s.open, o => o.n + '<small>' + (algo === 'astar' ? 'f=' + o.g + '+' + o.h + '=' + o.f : 'h=' + o.h) + '</small>', 'frontier');
                $('t2').textContent = 'Closed — sudah diekspansi';
                $('c2').innerHTML = chips(s.closed, n => n);
            }
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            const msg = $('msg');
            msg.className = 'viz-msg' + (s.kind === 'goal' ? ' goal' : s.kind === 'fail' ? ' fail' : '');
            msg.innerHTML = s.msg;
            const res = $('result');
            res.hidden = !last;
            if (last) {
                const path = s.path;
                if (s.found) {
                    const cost = SG.cost(path), ok = cost === optimal;
                    res.className = 'viz-result ' + (ok ? 'ok' : 'warn');
                    res.innerHTML = ICON(ok ? 'circle-check' : 'triangle-exclamation') + ' <span>Jalur: <b>' + path.join(' → ') +
                        '</b><br>Biaya: <b>' + cost + '</b> — ' + (ok ? 'optimal.' : '<b>tidak optimal</b> (jalur termurah ' + optimal + ').') + '</span>';
                } else {
                    res.className = 'viz-result bad';
                    res.innerHTML = ICON('circle-xmark') + ' <span>Tujuan tidak tercapai.</span>';
                }
            }
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
        }

        if (algos.length > 1) $('algo').addEventListener('change', e => { algo = e.target.value; compute(); });
        $('order').addEventListener('change', e => { order = e.target.value; compute(); });
        bindSteps($, () => idx, i => { idx = i; render(); }, () => steps.length);
        compute();
    }

    /* ---------- Pohon 8-puzzle ---------- */
    const PZ_CASE_LABEL = {
        h1: 'h₁ = ubin di posisi benar (pilih terbesar)',
        h2: 'h₂ = ubin di posisi salah (pilih terkecil)',
        h3: 'h₃ = total gerakan / Manhattan (pilih terkecil)',
        astar: 'A*: f(n) = g(n) + h(n)',
        sthc: 'Steepest-Ascent HC, h = jarak Manhattan'
    };
    function pzBoardSVG(state, goal, x, y, cell, color, blankWrong) {
        let out = '';
        for (let i = 0; i < 9; i++) {
            const v = state[i], cx = x + (i % 3) * cell, cy = y + Math.floor(i / 3) * cell;
            const wrong = v ? v !== goal[i] : blankWrong && goal[i] !== 0;
            const cls = v ? 'pt-tile' + (color ? (wrong ? ' wrong' : ' right') : '') : 'pt-blank' + (color && wrong ? ' wrong' : '');
            out += '<rect class="' + cls + '" x="' + cx + '" y="' + cy + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" rx="2"/>';
            if (v) out += '<text class="pt-num" x="' + (cx + (cell - 2) / 2) + '" y="' + (cy + cell / 2 + 3) + '" text-anchor="middle">' + v + '</text>';
        }
        return out;
    }

    function initPuzzleTree(root) {
        const cases = (root.dataset.cases || root.dataset.case || 'h1').split(',').map(s => s.trim());
        let cname = cases[0], color = true, steps = [], idx = 0, nodes = [];
        root.classList.add('viz', 'viz-pt');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            (cases.length > 1 ? '<label>Fungsi heuristik <select data-role="case">' + optionList(cases.map(c => [c, PZ_CASE_LABEL[c]]), cname) + '</select></label>'
                : '<label>' + PZ_CASE_LABEL[cname] + '</label>') +
            '<label class="vz-check"><input type="checkbox" data-role="color" checked> Warnai ubin yang salah posisi</label>' +
            '</div>' +
            '<div class="viz-stage pt-stage"><div class="pt-scroll" data-role="tree"></div>' +
            '<div class="viz-legend">' +
            '<span><i class="vz-dot sq" style="background:#1565c0"></i>Ubin di posisi benar</span>' +
            '<span><i class="vz-dot sq" style="background:#c62828"></i>Ubin di posisi salah</span>' +
            '<span><i class="vz-dot sq" style="background:#fff;box-shadow:inset 0 0 0 2px #e65100"></i>Simpul yang sedang dibahas</span>' +
            '<span><i class="vz-line"></i>Langkah yang dipilih</span>' +
            '</div></div>' +
            '<div class="viz-panel pt-panel">' +
            '<div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="viz-block" data-role="open-wrap" hidden><h6>Open — diurutkan menurut f(n)</h6><div class="viz-chips" data-role="open"></div></div>' +
            '<div class="viz-result" data-role="result" hidden></div>' +
            '</div>' + STEP_CONTROLS;
        const $ = r => root.querySelector('[data-role="' + r + '"]');

        function compute() {
            steps = pzRun(cname);
            nodes = steps.nodes;   // posisi dihitung dari pohon akhir agar simpul tidak berpindah antarlangkah
            idx = 0;
            render();
        }

        function render() {
            const C = PZ_CASES[cname], s = steps[idx], last = idx === steps.length - 1;
            const cell = 17, bw = cell * 3, slot = 78, levelH = 118, top = 34, left = 12;
            // tata letak: daun berurutan, induk di tengah anak-anaknya
            let leaf = 0;
            const pos = {};
            (function place(id) {
                const n = nodes[id];
                if (!n.children.length) { pos[id] = [left + leaf * slot + slot / 2, top + n.g * levelH]; leaf++; return; }
                n.children.forEach(place);
                const xs = n.children.map(c => pos[c][0]);
                pos[id] = [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, top + n.g * levelH];
            })(0);
            const goalW = 100;
            const W = Math.max(left * 2 + leaf * slot + goalW, 360);
            const depth = Math.max.apply(null, nodes.map(n => n.g));
            const Hh = top + depth * levelH + bw + 48;
            const shift = goalW;   // sisakan ruang di kiri untuk papan tujuan
            let edges = '', body = '';
            const vis = id => id < s.count;
            nodes.forEach(n => {
                if (!vis(n.id) || n.parent === null) return;
                const [x1, y1] = pos[n.parent], [x2, y2] = pos[n.id];
                const m = s.marks[n.id];
                edges += '<line class="pt-edge' + (m.chosen ? ' chosen' : '') + '" x1="' + (x1 + shift) + '" y1="' + (y1 + bw + 25) +
                    '" x2="' + (x2 + shift) + '" y2="' + (y2 - 17) + '"/>';
            });
            nodes.forEach(n => {
                if (!vis(n.id)) return;
                const m = s.marks[n.id];
                const [cx, y] = pos[n.id], x = cx + shift - bw / 2;
                const isG = n.state && pzKey(n.state) === pzKey(C.goal);
                const cls = ['pt-node', m.status, m.current ? 'current' : '', m.chosen ? 'chosen' : '', m.open ? 'open' : '',
                    isG && (m.chosen || m.current) ? 'goal' : ''].join(' ');
                body += '<g class="' + cls + '">';
                if (n.move) body += '<text class="pt-move" x="' + (cx + shift) + '" y="' + (y - 6) + '" text-anchor="middle">' + n.move + '</text>';
                body += '<rect class="pt-frame" x="' + (x - 4) + '" y="' + (y - 1) + '" width="' + (bw + 6) + '" height="' + (bw + 6) + '" rx="5"/>';
                if (m.status === 'invalid') {
                    body += '<text class="pt-x" x="' + (cx + shift) + '" y="' + (y + bw / 2 + 8) + '" text-anchor="middle">×</text>' +
                        '<text class="pt-val" x="' + (cx + shift) + '" y="' + (y + bw + 18) + '" text-anchor="middle">tidak valid</text>';
                } else {
                    body += pzBoardSVG(n.state, C.goal, x + 1, y + 2, cell, color, C.h === 'salahBlank');
                    const v = C.mode === 'astar' ? 'f=' + n.g + '+' + n.h + '=' + (n.g + n.h) : (C.hName || 'h') + '=' + n.h;
                    body += '<text class="pt-val" x="' + (cx + shift) + '" y="' + (y + bw + 18) + '" text-anchor="middle">' + v + '</text>';
                    if (m.status === 'back') body += '<text class="pt-val" x="' + (cx + shift) + '" y="' + (y + bw + 31) + '" text-anchor="middle">(' +
                        (C.mode === 'astar' ? 'sudah di Closed' : 'kembali ke induk') + ')</text>';
                }
                body += '</g>';
            });
            const goalBox = '<text class="pt-move" x="' + (12 + bw / 2) + '" y="' + (top - 6) + '" text-anchor="middle">Tujuan</text>' +
                '<rect class="pt-goalframe" x="' + 8 + '" y="' + (top - 1) + '" width="' + (bw + 6) + '" height="' + (bw + 6) + '" rx="5"/>' +
                pzBoardSVG(C.goal, C.goal, 12, top + 2, cell, false, false);
            $('tree').innerHTML = '<svg class="pt-svg" width="' + (W + shift - goalW + 20) + '" height="' + Hh + '" viewBox="0 0 ' + (W + shift - goalW + 20) + ' ' + Hh + '">' +
                goalBox + edges + body + '</svg>';
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            const msg = $('msg');
            msg.className = 'viz-msg' + (s.kind === 'goal' ? ' goal' : s.kind === 'fail' ? ' fail' : '');
            msg.innerHTML = s.msg;
            $('open-wrap').hidden = C.mode !== 'astar';
            if (C.mode === 'astar') {
                const list = (s.open || '').split(', ').filter(Boolean);
                $('open').innerHTML = chips(list, t => t.replace(/ f=(\d+)/, '<small>f=$1</small>'), 'frontier');
            }
            const res = $('result');
            res.hidden = !last;
            if (last) {
                res.className = 'viz-result ' + (s.found ? 'ok' : 'bad');
                res.innerHTML = s.found ? ICON('circle-check') + ' <span>Tujuan tercapai dalam <b>' + s.depth + ' gerakan</b>.</span>'
                    : ICON('circle-xmark') + ' <span>Terjebak sebelum mencapai tujuan.</span>';
            }
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
        }

        if (cases.length > 1) $('case').addEventListener('change', e => { cname = e.target.value; compute(); });
        $('color').addEventListener('change', e => { color = e.target.checked; render(); });
        bindSteps($, () => idx, i => { idx = i; render(); }, () => steps.length);
        compute();
    }

    /* ---------- Lab 8-puzzle: geser ubin, lihat h berubah ---------- */
    const PZ_EXACT = {};
    function pzExact(goal) {
        // BFS dari tujuan ke seluruh 181.440 keadaan yang terjangkau; dihitung sekali per tujuan.
        const gk = pzKey(goal);
        if (PZ_EXACT[gk]) return PZ_EXACT[gk];
        const enc = s => s.reduce((a, v) => a * 9 + v, 0);
        const dist = new Map([[enc(goal), 0]]);
        let frontier = [goal];
        for (let d = 0; frontier.length; d++) {
            const next = [];
            frontier.forEach(s => ['kiri', 'kanan', 'atas', 'bawah'].forEach(dir => {
                const t = pzMove(s, dir);
                if (!t) return;
                const k = enc(t);
                if (!dist.has(k)) { dist.set(k, d + 1); next.push(t); }
            }));
            frontier = next;
        }
        PZ_EXACT[gk] = s => dist.get(enc(s));
        return PZ_EXACT[gk];
    }

    function initPuzzleLab(root) {
        const GOALS = { a: PZ_A_GOAL, b: PZ_B_GOAL };
        const STARTS = { a: PZ_A, b: [1, 2, 3, 4, 8, 0, 7, 6, 5] };
        let gname = 'a', state = STARTS.a.slice(), moves = 0;
        root.classList.add('viz', 'viz-pl');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Susunan tujuan <select data-role="goal">' + optionList([['a', '1 2 3 / 8 _ 4 / 7 6 5 (hlm. 18)'], ['b', '1 2 3 / 4 5 6 / 7 8 _ (hlm. 38)']], gname) + '</select></label>' +
            '<button type="button" class="viz-btn secondary" data-role="init">' + ICON('rotate-left') + ' Keadaan awal materi</button>' +
            '<button type="button" class="viz-btn secondary" data-role="shuffle">' + ICON('shuffle') + ' Acak</button>' +
            '</div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage pl-stage">' +
            '<div class="pl-boards"><figure><figcaption>Keadaan sekarang <small data-role="moves"></small></figcaption><div class="pl-board" data-role="board"></div></figure>' +
            '<figure><figcaption>Tujuan</figcaption><div class="ss-board small goal" data-role="goalboard"></div></figure></div>' +
            '<p class="viz-note">Klik ubin yang bersebelahan dengan kotak kosong untuk menggesernya. Ubin merah berada di posisi yang salah.</p>' +
            '</div>' +
            '<div class="viz-panel">' +
            '<div class="viz-block"><h6>Nilai heuristik keadaan sekarang</h6><div class="pl-hs" data-role="hs"></div></div>' +
            '<div class="viz-block"><h6>Anak (successor) dan nilainya</h6><div data-role="succ"></div></div>' +
            '<div class="viz-result" data-role="result" hidden></div>' +
            '</div></div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const HS = [['benar', 'h₁', 'ubin benar', 'max'], ['salah', 'h₂', 'ubin salah', 'min'], ['manhattan', 'h₃', 'Manhattan', 'min']];

        function render() {
            const goal = GOALS[gname], exact = pzExact(goal);
            $('board').innerHTML = state.map((v, i) => v
                ? '<button type="button" class="pl-tile' + (v !== goal[i] ? ' wrong' : '') + '" data-i="' + i + '">' + v + '</button>'
                : '<span class="pl-blank"></span>').join('');
            $('goalboard').innerHTML = goal.map(v => '<span' + (v ? '' : ' class="blank"') + '>' + (v || '') + '</span>').join('');
            $('moves').textContent = '(' + moves + ' gerakan)';
            const hstar = exact(state);
            $('hs').innerHTML = HS.map(([k, n, t]) => '<div><b>' + n + ' = ' + PZ_H[k].f(state, goal) + '</b><small>' + t + '</small></div>').join('') +
                '<div class="star"><b>h* = ' + hstar + '</b><small>gerakan minimum sebenarnya</small></div>';
            const succ = ['kiri', 'kanan', 'atas', 'bawah'].map(d => [d, pzMove(state, d)]).filter(x => x[1]);
            const best = HS.map(([k, , , dir]) => {
                const vals = succ.map(x => PZ_H[k].f(x[1], goal));
                return dir === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
            });
            $('succ').innerHTML = '<table class="pl-table"><thead><tr><th>Blank digeser</th><th>h₁</th><th>h₂</th><th>h₃</th><th>h*</th></tr></thead><tbody>' +
                succ.map(([d, t]) => '<tr><td>' + d + '</td>' + HS.map(([k], j) => {
                    const v = PZ_H[k].f(t, goal);
                    return '<td' + (v === best[j] ? ' class="best"' : '') + '>' + v + '</td>';
                }).join('') + '<td>' + exact(t) + '</td></tr>').join('') + '</tbody></table>' +
                '<p class="viz-note">Sel hijau = pilihan terbaik menurut heuristik itu (h₁ terbesar, h₂ dan h₃ terkecil). Bandingkan dengan kolom h*: heuristik yang admissible tidak pernah melebihi h*.</p>';
            const res = $('result');
            res.hidden = hstar !== 0;
            res.className = 'viz-result ok';
            res.innerHTML = ICON('circle-check') + ' <span>Tujuan tercapai dalam ' + moves + ' gerakan.</span>';
        }

        $('board').addEventListener('click', e => {
            const btn = e.target.closest('.pl-tile');
            if (!btn) return;
            const i = +btn.dataset.i, z = state.indexOf(0);
            if (Math.abs(i - z) === 3 || (Math.abs(i - z) === 1 && Math.floor(i / 3) === Math.floor(z / 3))) {
                state[z] = state[i]; state[i] = 0; moves++;
                render();
            }
        });
        $('goal').addEventListener('change', e => { gname = e.target.value; state = STARTS[gname].slice(); moves = 0; render(); });
        $('init').addEventListener('click', () => { state = STARTS[gname].slice(); moves = 0; render(); });
        $('shuffle').addEventListener('click', () => {
            state = GOALS[gname].slice();
            let prev = null;
            for (let k = 0; k < 24; k++) {
                const opts = ['kiri', 'kanan', 'atas', 'bawah'].map(d => pzMove(state, d)).filter(t => t && (!prev || pzKey(t) !== pzKey(prev)));
                prev = state;
                state = opts[Math.floor(Math.random() * opts.length)];
            }
            moves = 0;
            render();
        });
        render();
    }

    /* ---------- Lanskap hill climbing ---------- */
    function initHillLand(root) {
        let mode = root.dataset.mode || 'simple', x0 = +(root.dataset.start || 40), steps = [], idx = 0;
        const N = LAND.length, W = 640, Hh = 270, padL = 34, padB = 34, padT = 30;
        const X = x => padL + x * (W - padL - 14) / (N - 1);
        const Y = v => Hh - padB - v * (Hh - padB - padT) / 100;
        root.classList.add('viz', 'viz-land');
        root.innerHTML =
            '<div class="viz-toolbar">' +
            '<label>Metode <select data-role="mode">' + optionList([['simple', 'Simple HC (coba kiri dulu)'], ['steepest', 'Steepest-Ascent HC']], mode) + '</select></label>' +
            '<label>Posisi awal x <input type="range" min="0" max="' + (N - 1) + '" value="' + x0 + '" data-role="x0"> <b data-role="x0v"></b></label>' +
            '<button type="button" class="viz-btn secondary" data-role="rand">' + ICON('dice') + ' Posisi acak</button>' +
            '</div>' +
            '<div class="viz-body">' +
            '<div class="viz-stage"><div data-role="svg"></div>' +
            '<p class="viz-note">Klik pada kurva untuk memilih posisi awal. Sumbu tegak = nilai fungsi objektif (makin tinggi makin baik), sumbu datar = ruang keadaan.</p></div>' +
            '<div class="viz-panel">' +
            '<div class="viz-step"><span data-role="step"></span></div>' +
            '<div class="viz-msg" data-role="msg" aria-live="polite"></div>' +
            '<div class="viz-result" data-role="result" hidden></div>' +
            '</div></div>' + STEP_CONTROLS;
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        let pathD = '';
        LAND.forEach((v, x) => { pathD += (x ? ' L' : 'M') + X(x).toFixed(1) + ',' + Y(v).toFixed(1); });
        const area = pathD + ' L' + X(N - 1) + ',' + Y(0) + ' L' + X(0) + ',' + Y(0) + ' Z';
        const note = (x, v, t, cls, dy) => '<text class="land-lbl ' + (cls || '') + '" x="' + X(x) + '" y="' + (Y(v) - (dy || 10)) + '" text-anchor="middle">' + t + '</text>';
        const staticSvg = '<path class="land-area" d="' + area + '"/><path class="land-line" d="' + pathD + '"/>' +
            '<line class="land-axis" x1="' + padL + '" y1="' + Y(0) + '" x2="' + (W - 8) + '" y2="' + Y(0) + '"/>' +
            '<line class="land-axis" x1="' + padL + '" y1="' + Y(0) + '" x2="' + padL + '" y2="' + (padT - 12) + '"/>' +
            '<text class="land-ax" x="' + (padL + 4) + '" y="' + (padT - 16) + '">fungsi objektif</text>' +
            '<text class="land-ax" x="' + (W - 10) + '" y="' + (Y(0) + 22) + '" text-anchor="end">ruang keadaan →</text>' +
            note(20, 92, 'maksimum global', 'good', 34) + note(36, 58, 'maksimum lokal', 'bad', 34) +
            note(48, 46, '"flat" local maximum', 'bad', 34) + note(11, 32, 'shoulder', '', 34);

        function compute() {
            steps = landRun(x0, mode);
            idx = 0;
            $('x0').value = x0;
            $('x0v').textContent = x0;
            render();
        }
        function render() {
            const s = steps[idx], last = idx === steps.length - 1;
            const trail = s.trail.map(x => '<circle class="land-trail" cx="' + X(x) + '" cy="' + Y(LAND[x]) + '" r="3.5"/>').join('');
            const nb = [s.x - 1, s.x + 1].filter(x => x >= 0 && x < N).map(x =>
                '<circle class="land-nb" cx="' + X(x) + '" cy="' + Y(LAND[x]) + '" r="5"/>').join('');
            const cx = X(s.x), cy = Y(LAND[s.x]);
            $('svg').innerHTML = '<svg class="land-svg" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Lanskap ruang keadaan untuk hill climbing">' +
                staticSvg + '<circle class="land-start" cx="' + X(x0) + '" cy="' + Y(LAND[x0]) + '" r="8"/>' + trail + (last ? '' : nb) +
                '<g class="land-climber' + (s.kind === 'goal' ? ' goal' : s.kind === 'fail' ? ' stuck' : '') + '">' +
                '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - 26) + '"/>' +
                '<path d="M' + cx + ',' + (cy - 26) + ' l14,5 l-14,5 z"/><circle cx="' + cx + '" cy="' + cy + '" r="6"/></g>' +
                '<rect class="land-hit" x="0" y="0" width="' + W + '" height="' + Hh + '"/></svg>';
            $('step').textContent = 'Langkah ' + idx + ' dari ' + (steps.length - 1);
            const msg = $('msg');
            msg.className = 'viz-msg' + (s.kind === 'goal' ? ' goal' : s.kind === 'fail' ? ' fail' : '');
            msg.innerHTML = s.msg;
            const res = $('result');
            res.hidden = !last;
            if (last) {
                res.className = 'viz-result ' + (s.kind === 'goal' ? 'ok' : 'warn');
                res.innerHTML = ICON(s.kind === 'goal' ? 'circle-check' : 'triangle-exclamation') + ' <span>' +
                    (s.kind === 'goal' ? 'Beruntung: posisi awal ini berada di lereng puncak tertinggi.'
                        : 'Terjebak. Coba posisi awal lain, atau ganti metode, lalu bandingkan tempat berhentinya.') + '</span>';
            }
            $('prev').disabled = idx === 0;
            $('next').disabled = last;
        }
        $('mode').addEventListener('change', e => { mode = e.target.value; compute(); });
        $('x0').addEventListener('input', e => { x0 = +e.target.value; compute(); });
        $('rand').addEventListener('click', () => { x0 = Math.floor(Math.random() * N); compute(); });
        $('svg').addEventListener('click', e => {
            const svg = $('svg').querySelector('svg');
            const r = svg.getBoundingClientRect();
            const px = (e.clientX - r.left) * W / r.width;
            x0 = Math.max(0, Math.min(N - 1, Math.round((px - padL) * (N - 1) / (W - padL - 14))));
            compute();
        });
        bindSteps($, () => idx, i => { idx = i; render(); }, () => steps.length);
        compute();
    }

    /* ---------- Kasus jalur terpendek: jarak garis lurus vs jarak jalan ---------- */
    function initSldLine(root) {
        const PTS = { A: [20, 10], B: [35, 10], C: [55, 10], D: [65, 10] };
        const CHAIN = ['A', 'B', 'C', 'D'], ROAD = [16, 100, 10];
        let goal = root.dataset.goal || 'D';
        const W = 660, Hh = 300;
        const X = v => 40 + (v - 15) * (W - 60) / 56;
        const Y = v => Hh - 40 - (v - 7) * 18;
        root.classList.add('viz', 'viz-sld');
        root.innerHTML =
            '<div class="viz-toolbar"><label>Tujuan <select data-role="goal">' + optionList(CHAIN.map(c => [c, c + ' (' + PTS[c].join(',') + ')']), goal) + '</select></label></div>' +
            '<div class="viz-stage"><div data-role="svg"></div></div>' +
            '<div data-role="table"></div>';
        const $ = r => root.querySelector('[data-role="' + r + '"]');
        const roadDist = (a, b) => {
            let i = CHAIN.indexOf(a), j = CHAIN.indexOf(b);
            if (i > j) [i, j] = [j, i];
            return ROAD.slice(i, j).reduce((s, c) => s + c, 0);
        };
        function render() {
            let grid = '';
            for (let v = 16; v <= 70; v += 2) grid += '<line class="sld-grid" x1="' + X(v) + '" y1="' + Y(7) + '" x2="' + X(v) + '" y2="' + Y(19) + '"/>' +
                '<text class="sld-tick" x="' + X(v) + '" y="' + (Y(7) + 14) + '" text-anchor="middle">' + v + '</text>';
            for (let v = 7; v <= 19; v++) grid += '<line class="sld-grid" x1="' + X(15) + '" y1="' + Y(v) + '" x2="' + X(71) + '" y2="' + Y(v) + '"/>' +
                '<text class="sld-tick" x="' + (X(15) - 5) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + v + '</text>';
            const y10 = Y(10);
            const roads = '<path class="sld-road" d="M' + X(20) + ',' + y10 + ' Q' + X(27.5) + ',' + Y(13.6) + ' ' + X(35) + ',' + y10 + '"/>' +
                '<text class="sld-cost" x="' + X(27.5) + '" y="' + (Y(11.8) - 4) + '" text-anchor="middle">16</text>' +
                '<path class="sld-road" d="M' + X(35) + ',' + y10 + ' C' + X(33) + ',' + Y(20) + ' ' + X(42) + ',' + Y(19.5) + ' ' + X(55) + ',' + y10 + '"/>' +
                '<text class="sld-cost" x="' + X(39) + '" y="' + Y(17.8) + '" text-anchor="middle">100</text>' +
                '<line class="sld-road" x1="' + X(55) + '" y1="' + y10 + '" x2="' + X(65) + '" y2="' + y10 + '"/>' +
                '<text class="sld-cost" x="' + X(60) + '" y="' + (y10 - 7) + '" text-anchor="middle">10</text>';
            // garis ukur jarak lurus ke tujuan, disusun bertingkat di bawah sumbu y = 10
            let dims = '', k = 0;
            CHAIN.forEach(c => {
                if (c === goal) return;
                const yy = Y(9.2) + k * 14; k++;
                const d = Math.hypot(PTS[c][0] - PTS[goal][0], PTS[c][1] - PTS[goal][1]);
                dims += '<line class="sld-dim" x1="' + X(PTS[c][0]) + '" y1="' + yy + '" x2="' + X(PTS[goal][0]) + '" y2="' + yy + '"/>' +
                    '<text class="sld-dimtxt" x="' + ((X(PTS[c][0]) + X(PTS[goal][0])) / 2) + '" y="' + (yy - 2) + '" text-anchor="middle">h(' + c + ') = ' + d + '</text>';
            });
            let nodes = '';
            CHAIN.forEach(c => {
                nodes += '<circle class="sld-node' + (c === goal ? ' goal' : '') + '" cx="' + X(PTS[c][0]) + '" cy="' + y10 + '" r="11"/>' +
                    '<text class="sld-lbl" x="' + X(PTS[c][0]) + '" y="' + (y10 + 4) + '" text-anchor="middle">' + c + '</text>';
            });
            $('svg').innerHTML = '<svg class="sld-svg" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Empat kota pada garis y = 10 dengan jalan berkelok">' +
                grid + roads + dims + nodes + '</svg>';
            const [gx, gy] = PTS[goal];
            $('table').innerHTML = '<table class="sld-table"><thead><tr><th>Simpul</th><th>Koordinat</th><th>h = jarak garis lurus ke ' + goal + '</th><th>Jarak jalan sebenarnya</th><th>h ≤ jarak jalan?</th></tr></thead><tbody>' +
                CHAIN.map(c => {
                    const [x, y] = PTS[c], d = Math.hypot(x - gx, y - gy), r = roadDist(c, goal);
                    return '<tr><td><b>' + c + '</b></td><td>(' + x + ', ' + y + ')</td><td>√((' + gy + ' − ' + y + ')² + (' + gx + ' − ' + x + ')²) = <b>' + d + '</b></td>' +
                        '<td>' + r + '</td><td>' + (d <= r ? ICON('check') + ' ya' : ICON('xmark') + ' tidak') + '</td></tr>';
                }).join('') + '</tbody></table>';
        }
        $('goal').addEventListener('change', e => { goal = e.target.value; render(); });
        render();
    }

    /* =====================================================================
     * 13. INISIALISASI
     * ===================================================================== */
    const INIT = {
        'romania-map': initRomaniaMap,
        'search': initSearch,
        'search-compare': initCompare,
        'grid-lab': initGridLab,
        'vacuum': initVacuum,
        'game-tree': initGameTree,
        'tictactoe': initTicTacToe,
        'state-space': initStateSpace,
        'sg-graph': initSgGraph,
        'puzzle-tree': initPuzzleTree,
        'puzzle-lab': initPuzzleLab,
        'hill-land': initHillLand,
        'sld-line': initSldLine
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
