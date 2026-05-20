/**
 * sync_journals.js
 * ─────────────────────────────────────────────────────────────
 * CARA PAKAI:
 *
 *   node sync_journals.js download          → download list dari KV → simpan ke master.csv
 *   node sync_journals.js upload            → push master.csv ke KV (replace semua)
 *   node sync_journals.js merge <file.csv>  → tambah jurnal baru dari file.csv ke KV
 *                                             (skip duplikat, update master.csv)
 *
 * FORMAT CSV: nama;url  (satu jurnal per baris, separator titik koma)
 * ─────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

// ── ENV ────────────────────────────────────────────────────────
const envFile = path.join(__dirname, '.env.local');
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const KV_URL   = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;
const MASTER   = path.join(__dirname, 'master.csv');
const KV_KEY   = 'monitoring_urls';

// ── KV HELPERS ─────────────────────────────────────────────────
async function kvGet(key) {
  const res  = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify([["SET", key, JSON.stringify(value)]])
  });
  return res.ok;
}

// ── CSV HELPERS ────────────────────────────────────────────────
function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(';');
    if (sep === -1) continue;
    const name = trimmed.slice(0, sep).trim();
    const url  = trimmed.slice(sep + 1).trim();
    if (name && url) result.push({ name, url });
  }
  return result;
}

function writeCsv(filePath, journals) {
  const content = journals.map(j => `${j.name};${j.url}`).join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

function normalizeUrl(u) {
  return u.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

// ── COMMANDS ───────────────────────────────────────────────────

// download: KV → master.csv
async function download() {
  console.log('⬇  Mengambil data dari KV...');
  const journals = await kvGet(KV_KEY);
  if (!journals) return console.log('❌ Tidak ada data di KV.');
  writeCsv(MASTER, journals);
  console.log(`✅ ${journals.length} jurnal disimpan ke master.csv`);
}

// upload: master.csv → KV (replace semua)
async function upload() {
  if (!fs.existsSync(MASTER)) return console.log('❌ master.csv tidak ditemukan. Jalankan download dulu.');
  const journals = parseCsv(MASTER);
  console.log(`⬆  Mengupload ${journals.length} jurnal ke KV...`);
  const ok = await kvSet(KV_KEY, journals);
  console.log(ok ? `✅ Berhasil. Total: ${journals.length} jurnal.` : '❌ Gagal upload.');
}

// merge: file.csv → tambah ke KV + update master.csv
async function merge(inputFile) {
  if (!inputFile || !fs.existsSync(inputFile)) {
    return console.log('❌ File tidak ditemukan:', inputFile);
  }

  console.log('⬇  Mengambil data existing dari KV...');
  const existing    = await kvGet(KV_KEY) ?? [];
  const existingSet = new Set(existing.map(j => normalizeUrl(j.url)));

  const incoming  = parseCsv(inputFile);
  const newOnes   = incoming.filter(j => !existingSet.has(normalizeUrl(j.url)));
  const duplikat  = incoming.filter(j =>  existingSet.has(normalizeUrl(j.url)));

  if (duplikat.length > 0) {
    console.log(`\n⚠  Dilewati (duplikat, ${duplikat.length}):`);
    duplikat.forEach(j => console.log(`   - ${j.name}`));
  }

  if (newOnes.length === 0) {
    console.log('\n✅ Tidak ada jurnal baru. Semua sudah ada di database.');
    return;
  }

  const merged = [...existing, ...newOnes];
  console.log(`\n⬆  Menambahkan ${newOnes.length} jurnal baru ke KV...`);
  const ok = await kvSet(KV_KEY, merged);

  if (ok) {
    writeCsv(MASTER, merged);
    console.log(`\n✅ Berhasil ditambahkan (${newOnes.length}):`);
    newOnes.forEach(j => console.log(`   + ${j.name} → ${j.url}`));
    console.log(`\nTotal di KV sekarang: ${merged.length} jurnal`);
    console.log('master.csv sudah diperbarui.');
  } else {
    console.log('❌ Gagal upload ke KV.');
  }
}

// ── MAIN ───────────────────────────────────────────────────────
const [,, cmd, arg] = process.argv;

if      (cmd === 'download') download();
else if (cmd === 'upload')   upload();
else if (cmd === 'merge')    merge(arg);
else {
  console.log(`
Penggunaan:
  node sync_journals.js download          → download dari KV ke master.csv
  node sync_journals.js upload            → push master.csv ke KV
  node sync_journals.js merge <file.csv>  → tambah jurnal baru dari CSV ke KV
  `);
}
