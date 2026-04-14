const CACHE_KEY = "monitoring_hasil";
const CACHE_DURATION = 60 * 60;
const MAX_NAME_LENGTH = 200;

const DEFAULT_JOURNALS = [
  { name: "Jurnal FE Unram", url: "https://jurnal.fe.unram.ac.id/" },
  { name: "Journal of Engineering and Emerging Technology (JEET)", url: "https://jeet.unram.ac.id/index.php/rky" },
  { name: "Jurnal Teknologi Informasi", url: "https://jtika.if.unram.ac.id/index.php/JTIKA/" },
  { name: "Jurnal Begawe Teknologi Informasi", url: "https://begawe.unram.ac.id/index.php/JBTI" },
  { name: "Jurnal Distribusi FEB", url: "https://distribusi.unram.ac.id/index.php/distribusi" },
  { name: "JCOSINE", url: "https://jcosine.if.unram.ac.id/index.php/jcosine"},
];

const upstashFetch = (path, options = {}) =>
  fetch(`${process.env.KV_REST_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

async function kvGet(key) {
  const res = await upstashFetch(`/get/${key}`);
  const data = await res.json();
  if (!data.result) return null;
  return JSON.parse(data.result);
}

async function kvSet(key, value, ex) {
  const cmd = ex
    ? ["SET", key, JSON.stringify(value), "EX", ex]
    : ["SET", key, JSON.stringify(value)];
  await upstashFetch("/pipeline", {
    method: "POST",
    body: JSON.stringify([cmd]),
  });
}

async function kvDel(key) {
  await upstashFetch("/pipeline", {
    method: "POST",
    body: JSON.stringify([["DEL", key]]),
  });
}

async function cekSatuJurnal(jurnal) {
  const { name, url } = jurnal;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    if (response.status === 200 && text.length < 100) {
      return { name, url, status: "warn", code: "EMPTY" };
    }
    const code = response.status;
    let status = "warn";
    if (code === 200) status = "ok";
    else if (code >= 400 || code === 0) status = "down";
    return { name, url, status, code };
  } catch {
    return { name, url, status: "down", code: "Error" };
  }
}

function isAuthorized(req) {
  return req.headers["x-admin-secret"] === process.env.ADMIN_SECRET;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!isAuthorized(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const action = req.query.action;

  if (action === "verify") {
    return res.json({ ok: true });
  }

  if (action === "get-urls") {
    const journals = await kvGet("monitoring_urls");
    return res.json({ journals: journals ?? DEFAULT_JOURNALS });
  }

  if (action === "set-urls" && req.method === "POST") {
    const { journals } = req.body;
    if (!Array.isArray(journals) || journals.length === 0) {
      return res.status(400).json({ error: "journals tidak valid" });
    }

    // Validasi & trim nama
    const cleaned = journals.map(j => ({
      name: (j.name ?? "").slice(0, MAX_NAME_LENGTH).trim(),
      url: (j.url ?? "").trim(),
    })).filter(j => j.url);

    await kvSet("monitoring_urls", cleaned);

    // Ambil cache lama
    const cached = await kvGet(CACHE_KEY);
    const hasilLama = cached?.hasil ?? [];

    const urlSudahDicek = new Set(hasilLama.map(h => h.url));
    const jurnalBaru = cleaned.filter(j => !urlSudahDicek.has(j.url));

    // Update nama di hasil lama jika berubah
    const namaMap = Object.fromEntries(cleaned.map(j => [j.url, j.name]));
    let hasilFinal = hasilLama
      .filter(h => cleaned.some(j => j.url === h.url))
      .map(h => ({ ...h, name: namaMap[h.url] ?? h.name }));

    if (jurnalBaru.length > 0) {
      const hasilBaru = [];
      for (let i = 0; i < jurnalBaru.length; i += 5) {
        const batch = jurnalBaru.slice(i, i + 5);
        const results = await Promise.all(batch.map(cekSatuJurnal));
        hasilBaru.push(...results);
      }
      hasilFinal = [...hasilFinal, ...hasilBaru];
    }

    hasilFinal.sort((a, b) =>
      cleaned.findIndex(j => j.url === a.url) - cleaned.findIndex(j => j.url === b.url)
    );

    const waktuCek = cached?.waktuCek ?? new Date().toISOString();
    const nextCek  = cached?.nextCek  ?? new Date(Date.now() + CACHE_DURATION * 1000).toISOString();

    await kvSet(CACHE_KEY, { hasil: hasilFinal, waktuCek, nextCek }, CACHE_DURATION);

    return res.json({ ok: true, total: cleaned.length, jurnalBaru: jurnalBaru.length });
  }

  if (action === "reset-cache" && req.method === "POST") {
    await kvDel(CACHE_KEY);
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Action tidak dikenal" });
}
