const CACHE_KEY = "monitoring_hasil";
const CACHE_DURATION = 60 * 60; // 1 jam dalam detik

const DEFAULT_JOURNALS = [
  { name: "Jurnal Internasional Pariwisata", url: "https://jurnal.fe.unram.ac.id/index.php/intour" },
  { name: "Jurnal FE Unram", url: "https://jurnal.fe.unram.ac.id/" },
  { name: "Jurnal Rekayasa Kebumian", url: "https://jeet.unram.ac.id/index.php/rky" },
  { name: "JTIKA", url: "https://jtika.if.unram.ac.id/index.php/JTIKA/" },
  { name: "Jurnal Bisnis dan Kewirausahaan", url: "https://begawe.unram.ac.id/index.php/JBTI" },
  { name: "Jurnal Pendidikan Dasar", url: "https://journal.unram.ac.id/index.php/pendas/en" },
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
  // data.result adalah string JSON
  return JSON.parse(data.result);
}

async function kvSet(key, value, ex) {
  // Format pipeline Upstash: POST /pipeline dengan array of commands
  await upstashFetch("/pipeline", {
    method: "POST",
    body: JSON.stringify([
      ["SET", key, JSON.stringify(value), "EX", ex]
    ]),
  });
}

async function cekSatuUrl(jurnal) {
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

async function cekSemuaUrl(journals) {
  const hasil = [];
  for (let i = 0; i < journals.length; i += 5) {
    const batch = journals.slice(i, i + 5);
    const results = await Promise.all(batch.map(cekSatuUrl));
    hasil.push(...results);
  }
  return hasil;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      return res.json({ fromCache: true, ...cached });
    }

    const savedUrls = await kvGet("monitoring_urls");
    const urls = savedUrls ?? DEFAULT_JOURNALS;

    const waktuCek = new Date().toISOString();
    const hasil = await cekSemuaUrl(urls);

    const data = {
      hasil,
      waktuCek,
      nextCek: new Date(Date.now() + CACHE_DURATION * 1000).toISOString(),
    };

    await kvSet(CACHE_KEY, data, CACHE_DURATION);

    return res.json({ fromCache: false, ...data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
