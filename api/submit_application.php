<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    $conn->close();
    exit();
}

$rawBody = file_get_contents("php://input");
$data = json_decode($rawBody, true);
if (!$data || !is_array($data)) {
    $data = $_POST;
}

$studentId = isset($data['student_id']) ? intval($data['student_id']) : null;
$type = isset($data['type']) ? trim($data['type']) : "";
$fileName = isset($data['file_name']) ? trim($data['file_name']) : "";
$fileDataRaw = isset($data['file_data']) ? trim($data['file_data']) : "";
$gwa = isset($data['gwa']) ? trim((string)$data['gwa']) : "";
$rank = isset($data['rank']) ? trim((string)$data['rank']) : "";
$status = isset($data['status']) ? trim((string)$data['status']) : "for evaluation";

if (!$studentId || $type === "" || $fileName === "" || $fileDataRaw === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Missing required fields (student_id, type, file_name, file_data)"
    ]);
    $conn->close();
    exit();
}

$binaryPdf = base64_decode($fileDataRaw, true);
if ($binaryPdf === false) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid file_data payload"]);
    $conn->close();
    exit();
}

$dupStmt = $conn->prepare("SELECT Application_id FROM application WHERE Student_id = ? LIMIT 1");
if (!$dupStmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to prepare duplicate check"]);
    $conn->close();
    exit();
}
$dupStmt->bind_param("i", $studentId);
$dupStmt->execute();
$dupResult = $dupStmt->get_result();
if ($dupResult && $dupResult->num_rows > 0) {
    echo json_encode([
        "success" => false,
        "code" => "ALREADY_APPLIED",
        "message" => "You already applied for this application."
    ]);
    $dupStmt->close();
    $conn->close();
    exit();
}
$dupStmt->close();

$stmt = $conn->prepare(
    "INSERT INTO application (Student_id, `Type`, File_name, File_data, GWA, `Rank`, `Status`)
     VALUES (?, ?, ?, ?, ?, ?, ?)"
);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to prepare statement"]);
    $conn->close();
    exit();
}

$filePlaceholder = null;
$stmt->bind_param(
    "issbsss",
    $studentId,
    $type,
    $fileName,
    $filePlaceholder,
    $gwa,
    $rank,
    $status
);
$stmt->send_long_data(3, $binaryPdf);

if ($stmt->execute()) {
    echo json_encode([
        "success" => true,
        "message" => "Application stored successfully",
        "application_id" => $conn->insert_id
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to save application",
        "error" => $stmt->error
    ]);
}

$stmt->close();
$conn->close();
