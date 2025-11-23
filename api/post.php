<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *"); // helpful for RN
error_reporting(E_ALL);
ini_set('display_errors', 1);

// --- DB ---
$servername = "localhost";
$username   = "u780655614_achievemate";
$password   = "Jaztintampis@18";
$dbname     = "u780655614_achievemate";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(["error" => "Database connection failed", "details" => $conn->connect_error]);
  exit();
}

// --- URL bases (no trailing slash on $baseUrl) ---
$baseUrl     = "https://achievemate.website";
$storageBase = $baseUrl . "/storage/uploads/posts/";     // for file-based images
$streamUrl   = $baseUrl . "/api/post-image.php?id=";     // <-- FIXED: add /api/

$sql = "SELECT Post_id, Title, Announcement, Start_date, End_date, Academic_year, Semester, image
        FROM post
        ORDER BY Post_id DESC";
$res = $conn->query($sql);
if (!$res) {
  http_response_code(500);
  echo json_encode(["error" => "Query failed", "details" => $conn->error]);
  exit();
}

$out = [];
while ($r = $res->fetch_assoc()) {
  $img = $r['image'];
  unset($r['image']); // do not expose raw column

  // Default to streamer (covers BLOB/unknown)
  $imageUrl = $streamUrl . (int)$r['Post_id'];

  // If column looks like a path/filename with an image extension, prefer storage URL
  if (is_string($img) && preg_match('/\.(?:jpe?g|png|gif|webp|bmp|svg)$/i', $img)) {
    $fn = basename(trim($img));
    if ($fn !== '') {
      $imageUrl = $storageBase . $fn;
    }
  }

  $r['image_url'] = $imageUrl;
  $out[] = $r;
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
$conn->close();
