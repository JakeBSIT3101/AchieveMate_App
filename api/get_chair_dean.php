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
    echo json_encode(["success" => false, "message" => "DB connection failed"]);
    exit();
}

$studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;
if (!$studentId) {
    echo json_encode(["success" => false, "message" => "Missing student_id"]);
    exit();
}

// Get campus, college, program for the student
$scSql = "SELECT Campus_id, College_id, Program_id FROM student_course WHERE Student_id = $studentId LIMIT 1";
$scRes = $conn->query($scSql);
if (!$scRes || $scRes->num_rows === 0) {
    echo json_encode(["success" => false, "message" => "Student not found or no course info"]);
    exit();
}
$scRow = $scRes->fetch_assoc();
$campusId = intval($scRow['Campus_id']);
$collegeId = intval($scRow['College_id']);
$programId = intval($scRow['Program_id']);

// Helper to compose full name
function compose($u) {
    if (!$u) return '';
    $t = trim((string)($u['Title'] ?? ''));
    $f = strtoupper((string)($u['First_name'] ?? ''));
    $mi = $u['Middle_name'] ? strtoupper(substr((string)$u['Middle_name'], 0, 1)).'.' : '';
    $l = strtoupper((string)($u['Last_name'] ?? ''));
    return trim($t.' '.$f.' '.($mi ? $mi.' ' : '').$l);
}

// --- Program Chair ---
$chairSql = "SELECT ud.Designation_id, ud.College_id, ud.User_id, d.designation_name, c.college_name
    FROM user_designation ud
    LEFT JOIN designation d ON ud.Designation_id = d.designation_id
    LEFT JOIN college c ON ud.College_id = c.college_id
    WHERE ud.Campus_id = $campusId AND ud.College_id = $collegeId AND ud.Program_id = $programId
    AND (d.designation_name LIKE '%Chairperson%')
    LIMIT 1";
$chairRes = $conn->query($chairSql);
$chair = $chairRes && $chairRes->num_rows > 0 ? $chairRes->fetch_assoc() : null;
$chairName = $chairDesignation = $chairCollege = 'N/A';
if ($chair) {
    $userId = intval($chair['User_id']);
    $userSql = "SELECT Title, First_name, Middle_name, Last_name FROM user_manage WHERE User_id = $userId LIMIT 1";
    $userRes = $conn->query($userSql);
    $user = $userRes && $userRes->num_rows > 0 ? $userRes->fetch_assoc() : null;
    $chairName = compose($user);
    $chairDesignation = $chair['designation_name'] ?? 'N/A';
    $chairCollege = $chair['college_name'] ?? 'N/A';
}

// --- Dean ---
$deanSql = "SELECT ud.Designation_id, ud.College_id, ud.User_id, d.designation_name, c.college_name
    FROM user_designation ud
    LEFT JOIN designation d ON ud.Designation_id = d.designation_id
    LEFT JOIN college c ON ud.College_id = c.college_id
    WHERE ud.Campus_id = $campusId AND ud.College_id = $collegeId
    AND (d.designation_name LIKE '%Dean%')
    LIMIT 1";
$deanRes = $conn->query($deanSql);
$dean = $deanRes && $deanRes->num_rows > 0 ? $deanRes->fetch_assoc() : null;
$deanName = $deanDesignation = $deanCollege = 'N/A';
if ($dean) {
    $userId = intval($dean['User_id']);
    $userSql = "SELECT Title, First_name, Middle_name, Last_name FROM user_manage WHERE User_id = $userId LIMIT 1";
    $userRes = $conn->query($userSql);
    $user = $userRes && $userRes->num_rows > 0 ? $userRes->fetch_assoc() : null;
    $deanName = compose($user);
    $deanDesignation = $dean['designation_name'] ?? 'N/A';
    $deanCollege = $dean['college_name'] ?? 'N/A';
}

// Output JSON
echo json_encode([
    'program_chair' => [
        'name' => $chairName,
        'designation' => $chairDesignation,
        'college' => $chairCollege
    ],
    'dean' => [
        'name' => $deanName,
        'designation' => $deanDesignation,
        'college' => $deanCollege
    ]
]);
$conn->close();
