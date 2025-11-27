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
$postId = isset($data['post_id']) ? intval($data['post_id']) : null;
if ($postId !== null && $postId <= 0) {
    $postId = null;
}
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

$postCheckStmt = null;
if ($postId) {
    $postCheckStmt = $conn->prepare("SELECT Post_id FROM post WHERE Post_id = ? LIMIT 1");
    if (!$postCheckStmt) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to prepare post validation"]);
        $conn->close();
        exit();
    }
    $postCheckStmt->bind_param("i", $postId);
    $postCheckStmt->execute();
    $postResult = $postCheckStmt->get_result();
    if (!$postResult || $postResult->num_rows === 0) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Linked announcement not found. Please refresh announcements and try again."
        ]);
        $postCheckStmt->close();
        $conn->close();
        exit();
    }
    $postCheckStmt->close();
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
    "INSERT INTO application (Student_id, Post_id, `Type`, File_name, File_data, GWA, `Rank`, `Status`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to prepare statement"]);
    $conn->close();
    exit();
}

$filePlaceholder = null;
$stmt->bind_param(
    "iissbsss",
    $studentId,
    $postId,
    $type,
    $fileName,
    $filePlaceholder,
    $gwa,
    $rank,
    $status
);
$stmt->send_long_data(4, $binaryPdf);

if ($stmt->execute()) {
    $applicationId = $conn->insert_id;
    $notificationInserted = false;
    $notificationError = null;
    error_log("[SUBMIT_APP] Inserted application_id={$applicationId} for student_id={$studentId}, post_id=" . ($postId ?? 'null'));

    // Optional: create a notification/assignment row for the post owner (user)
    if ($postId) {
        // Resolve UserDesignation_id from post
        $postStmt = $conn->prepare("SELECT UserDesignation_id FROM post WHERE Post_id = ? LIMIT 1");
        if ($postStmt) {
            $postStmt->bind_param("i", $postId);
            $postStmt->execute();
            $postRes = $postStmt->get_result();
            if ($postRes && $postRes->num_rows > 0) {
                $udRow = $postRes->fetch_assoc();
                $userDesignationId = isset($udRow['UserDesignation_id']) ? intval($udRow['UserDesignation_id']) : null;
                if ($userDesignationId) {
                    // Resolve User_id from user_designation
                    $udStmt = $conn->prepare("SELECT User_id FROM user_designation WHERE UserDesignation_id = ? LIMIT 1");
                    if ($udStmt) {
                        $udStmt->bind_param("i", $userDesignationId);
                        $udStmt->execute();
                        $udRes = $udStmt->get_result();
                        if ($udRes && $udRes->num_rows > 0) {
                            $udUserRow = $udRes->fetch_assoc();
                            $targetUserId = isset($udUserRow['User_id']) ? intval($udUserRow['User_id']) : null;

                            if ($targetUserId) {
                                // Pick an available notification table
                                $notifTable = null;
                                $candidates = [
                                    "application_notifications",
                                    "application_notification",
                                    "application_recipient",
                                ];
                                foreach ($candidates as $tbl) {
                                    $check = $conn->query("SHOW TABLES LIKE '$tbl'");
                                    if ($check && $check->num_rows > 0) {
                                        $notifTable = $tbl;
                                        break;
                                    }
                                }

                                if ($notifTable) {
                                    $notifStmt = $conn->prepare("INSERT INTO $notifTable (Application_id, User_id, is_read) VALUES (?, ?, 0)");
                                    if ($notifStmt) {
                                        $notifStmt->bind_param("ii", $applicationId, $targetUserId);
                                        if ($notifStmt->execute()) {
                                            $notificationInserted = true;
                                            error_log("[SUBMIT_APP] Notification insert ok in {$notifTable} -> application_id={$applicationId}, user_id={$targetUserId}, is_read=0");
                                        } else {
                                            $notificationError = $notifStmt->error;
                                            error_log("[SUBMIT_APP] Notification insert failed in {$notifTable}: {$notificationError}");
                                        }
                                        $notifStmt->close();
                                    } else {
                                        $notificationError = "Failed to prepare notification insert";
                                        error_log("[SUBMIT_APP] {$notificationError}");
                                    }
                                } else {
                                    $notificationError = "Notification table not found";
                                    error_log("[SUBMIT_APP] {$notificationError}");
                                }
                            }
                        }
                        $udStmt->close();
                    }
                }
            }
            $postStmt->close();
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Application stored successfully",
        "application_id" => $applicationId,
        "notification_inserted" => $notificationInserted,
        "notification_error" => $notificationError,
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
