const CACHE_KEY = "monitoring_hasil";

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
  await upstashFetch("/pipeline", {
    method: "POST",
    body: JSON.stringify([
      ["SET", key, JSON.stringify(value), "EX", ex]
    ]),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      return res.json({ fromCache: true, ...cached });
    }

    // Tidak ada cache — kembalikan data kosong tanpa melakukan pengecekan.
    // Pengecekan hanya dilakukan oleh GitHub Action (terjadwal) atau dari halaman admin.
    return res.json({
      fromCache: false,
      noData: true,
      hasil: [],
      waktuCek: null,
      nextCek: null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
