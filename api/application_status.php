<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
error_reporting(E_ALL);
ini_set('display_errors', 1);

$servername = "localhost";
$username   = "u780655614_achievemate";
$password   = "Jaztintampis@18";
$dbname     = "u780655614_achievemate";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection failed"]);
    exit();
}

$studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;
if (!$studentId) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Missing student_id"]);
    $conn->close();
    exit();
}

$stmt = $conn->prepare("SELECT Application_id, Student_id, Post_id, `Type`, File_name, GWA, `Rank`, `Status` FROM application WHERE Student_id = ? ORDER BY Application_id DESC");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to prepare query"]);
    $conn->close();
    exit();
}

$stmt->bind_param("i", $studentId);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
$conn->close();

echo json_encode(["success" => true, "data" => $rows], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
