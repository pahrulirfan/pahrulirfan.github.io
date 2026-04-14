<!DOCTYPE html>
<html>
<head>
  <title>Monitoring OJS</title>
  <style>
    .ok { color: green; }
    .down { color: red; }
    .warn { color: orange; }
  </style>
</head>
<body>

<h2>Monitoring OJS</h2>

<textarea id="listUrl" rows="6" cols="50">
https://jurnal.fe.unram.ac.id/index.php/intour
https://jurnal.fe.unram.ac.id/
https://google.com
https://jeet.unram.ac.id/index.php/rky
https://jtika.if.unram.ac.id/index.php/JTIKA/
https://begawe.unram.ac.id/index.php/JBTI
https://journal.unram.ac.id/index.php/pendas/en
</textarea><br><br>

<select id="interval">
  <option value="60000">1 menit</option>
  <option value="300000">5 menit</option>
</select>

<button onclick="mulai()">Mulai</button>

<table border="1" cellpadding="8">
  <thead>
    <tr>
      <th>URL</th>
      <th>Status</th>
      <th>Waktu</th>
    </tr>
  </thead>
  <tbody id="hasil"></tbody>
</table>

<script>
let timer;

function mulai() {
  const interval = document.getElementById("interval").value;

  if (timer) clearInterval(timer);

  cek();
  timer = setInterval(cek, interval);
}

async function cek() {
  const urls = document.getElementById("listUrl").value.split("\n");
  const tbody = document.getElementById("hasil");

  tbody.innerHTML = "";

  for (let url of urls) {
    url = url.trim();
    if (!url) continue;

    const row = document.createElement("tr");

    const statusCell = document.createElement("td");
    statusCell.innerHTML = "⏳";

    row.innerHTML = `<td>${url}</td>`;
    row.appendChild(statusCell);

    const waktuCell = document.createElement("td");
    row.appendChild(waktuCell);

    tbody.appendChild(row);

    try {
      const res = await fetch("cek.php?url=" + encodeURIComponent(url));
      const data = await res.json();

      if (data.status == 200) {
        statusCell.innerHTML = "🟢 Lancar";
        statusCell.className = "ok";
      } else if (data.status == 404) {
        statusCell.innerHTML = "🔴 404";
        statusCell.className = "down";
      } else if (data.status == 500) {
        statusCell.innerHTML = "🟡 Server Error";
        statusCell.className = "warn";
      } else if (data.status == "DOWN") {
        statusCell.innerHTML = "🔴 Down";
        statusCell.className = "down";
      } else if (data.status == "EMPTY") {
        statusCell.innerHTML = "🟡 Halaman Kosong";
        statusCell.className = "warn";
      } else {
        statusCell.innerHTML = "⚠️ " + data.status;
        statusCell.className = "warn";
      }

    } catch (err) {
      statusCell.innerHTML = "🔴 Error";
      statusCell.className = "down";
    }

    waktuCell.innerHTML = new Date().toLocaleTimeString();
  }
}
</script>

</body>
</html>

