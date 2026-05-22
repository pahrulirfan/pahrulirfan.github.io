// Endpoint publik untuk trigger pengecekan manual dari halaman index.
// Rate limit: 1x per 2 jam per IP.

const CACHE_KEY      = "monitoring_hasil";
const CACHE_DURATION = 60 * 60 * 25; // 25 jam — cache tidak hilang walau cron telat
const RL_WINDOW      = 60 * 60 * 2;  // 2 jam rate limit window per IP

const DEFAULT_JOURNALS = [
  { name: "Jurnal FE Unram",                                       url: "https://jurnal.fe.unram.ac.id/" },
  { name: "Journal of Engineering and Emerging Technology (JEET)", url: "https://jeet.unram.ac.id/index.php/rky" },
  { name: "Jurnal Teknologi Informasi",                            url: "https://jtika.if.unram.ac.id/index.php/JTIKA/" },
  { name: "Jurnal Begawe Teknologi Informasi",                     url: "https://begawe.unram.ac.id/index.php/JBTI" },
  { name: "Jurnal Distribusi FEB",                                 url: "https://distribusi.unram.ac.id/index.php/distribusi" },
  { name: "JCOSINE",                                               url: "https://jcosine.if.unram.ac.id/index.php/jcosine" },
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

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

async function checkRateLimit(ip) {
  const key  = `refresh_rl:${ip}`;
  const data = await kvGet(key);
  if (!data) return { blocked: false };
  if (Date.now() < data.until) {
    return { blocked: true, retryAfter: Math.ceil((data.until - Date.now()) / 1000) };
  }
  return { blocked: false };
}

async function setRateLimit(ip) {
  const key   = `refresh_rl:${ip}`;
  const until = Date.now() + RL_WINDOW * 1000;
  await kvSet(key, { until }, RL_WINDOW);
}

async function cekSatuJurnal(jurnal) {
  const { name, url } = jurnal;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
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

  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);

  if (rl.blocked) {
    res.setHeader("Retry-After", rl.retryAfter);
    return res.status(429).json({
      error: "Terlalu sering. Coba lagi dalam 2 jam.",
      retryAfter: rl.retryAfter,
    });
  }

  // Set rate limit sebelum mulai cek agar tidak bisa double-trigger
  await setRateLimit(ip);

  try {
    const journals = (await kvGet("monitoring_urls")) ?? DEFAULT_JOURNALS;

    const hasil = [];
    for (let i = 0; i < journals.length; i += 5) {
      const batch   = journals.slice(i, i + 5);
      const results = await Promise.all(batch.map(cekSatuJurnal));
      hasil.push(...results);
    }

    const waktuCek = new Date().toISOString();
    const nextCek  = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await kvSet(CACHE_KEY, { hasil, waktuCek, nextCek }, CACHE_DURATION);

    return res.json({
      ok: true,
      total: hasil.length,
      waktuCek,
      hasil,
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
