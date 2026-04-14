<?php
header("Content-Type: application/json");

$url = $_GET['url'] ?? '';

if (!$url) {
    echo json_encode(["status" => "invalid"]);
    exit;
}

$ch = curl_init($url);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_NOBODY, false); // ambil body untuk cek konten
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$body = curl_exec($ch);

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$size = curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);

if (curl_errno($ch)) {
    echo json_encode(["status" => "DOWN"]);
} elseif ($httpCode == 200 && $size < 100) {
    // HTTP 200 tapi body hampir kosong = kemungkinan halaman error
    echo json_encode(["status" => "EMPTY", "size" => $size]);
} else {
    echo json_encode(["status" => $httpCode]);
}

curl_close($ch);
