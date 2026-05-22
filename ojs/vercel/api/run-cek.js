const CACHE_KEY     = "monitoring_hasil";
const CACHE_DURATION = 60 * 60 * 2; // 2 jam

const DEFAULT_JOURNALS = [
  { name: "Jurnal FE Unram",                                    url: "https://jurnal.fe.unram.ac.id/" },
  { name: "Journal of Engineering and Emerging Technology (JEET)", url: "https://jeet.unram.ac.id/index.php/rky" },
  { name: "Jurnal Teknologi Informasi",                          url: "https://jtika.if.unram.ac.id/index.php/JTIKA/" },
  { name: "Jurnal Begawe Teknologi Informasi",                   url: "https://begawe.unram.ac.id/index.php/JBTI" },
  { name: "Jurnal Distribusi FEB",                               url: "https://distribusi.unram.ac.id/index.php/distribusi" },
  { name: "JCOSINE",                                             url: "https://jcosine.if.unram.ac.id/index.php/jcosine" },
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
  const res  = await upstashFetch(`/get/${key}`);
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
    const code   = response.status;
    const status = code === 200 ? "ok" : code >= 400 || code === 0 ? "down" : "warn";
    return { name, url, status, code };
  } catch {
    return { name, url, status: "down", code: "Error" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Autentikasi: bisa pakai CRON_SECRET (GitHub Action) atau ADMIN_SECRET (admin panel)
  const provided = req.headers["x-cron-secret"] ?? req.headers["x-admin-secret"] ?? "";

  const cronSecret  = process.env.CRON_SECRET  ?? "";
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  const validCron  = cronSecret  && provided === cronSecret;
  const validAdmin = adminSecret && provided === adminSecret;

  if (!validCron && !validAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    // Ambil daftar jurnal dari KV (atau pakai default)
    const journals = (await kvGet("monitoring_urls")) ?? DEFAULT_JOURNALS;

    // Cek semua jurnal secara paralel (batch 5)
    const hasil = [];
    for (let i = 0; i < journals.length; i += 5) {
      const batch   = journals.slice(i, i + 5);
      const results = await Promise.all(batch.map(cekSatuJurnal));
      hasil.push(...results);
    }

    const waktuCek = new Date().toISOString();
    const nextCek  = new Date(Date.now() + CACHE_DURATION * 1000).toISOString();

    await kvSet(CACHE_KEY, { hasil, waktuCek, nextCek }, CACHE_DURATION);

    return res.json({
      ok: true,
      total: hasil.length,
      waktuCek,
      nextCek,
      ringkasan: {
        ok:   hasil.filter(h => h.status === "ok").length,
        down: hasil.filter(h => h.status === "down").length,
        warn: hasil.filter(h => h.status === "warn").length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
