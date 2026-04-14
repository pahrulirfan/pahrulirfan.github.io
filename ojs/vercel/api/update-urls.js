async function kvSet(key, value) {
  await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
}

async function kvDel(key) {
  await fetch(`${process.env.KV_REST_API_URL}/del/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { secret, urls } = req.body;

  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls harus array dan tidak kosong" });
  }

  await kvSet("monitoring_urls", urls);
  await kvDel("monitoring_hasil"); // hapus cache lama

  return res.json({ ok: true, total: urls.length });
}
