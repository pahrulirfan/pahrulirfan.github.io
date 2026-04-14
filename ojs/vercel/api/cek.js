export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ status: "invalid" });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();

    if (response.status === 200 && text.length < 100) {
      return res.json({ status: "EMPTY", size: text.length });
    }

    return res.json({ status: response.status });
  } catch (err) {
    return res.json({ status: "DOWN" });
  }
}
