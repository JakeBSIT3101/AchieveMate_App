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

$srcode    = isset($_GET['srcode']) ? trim($_GET['srcode']) : null;
$studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : null;

// Resolve Campus_id, College_id, Program_id from SRCODE (preferred) or student_id (fallback)
$campusId = $collegeId = $programId = null;
if ($srcode) {
    $esc = $conn->real_escape_string($srcode);
    $sql = "SELECT sc.Student_id, sc.Campus_id, sc.College_id, sc.Program_id
            FROM student_manage sm
            INNER JOIN student_course sc ON sc.Student_id = sm.Student_id
            WHERE sm.SRCODE = '$esc'
            ORDER BY sc.StudentCourse_id DESC
            LIMIT 1";
    $res = $conn->query($sql);
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $studentId = intval($row['Student_id']);
        $campusId  = intval($row['Campus_id']);
        $collegeId = intval($row['College_id']);
        $programId = intval($row['Program_id']);
    } else {
        echo json_encode(["success" => false, "message" => "SRCODE not found or no course mapping"]);
        $conn->close();
        exit();
    }
} else if ($studentId) {
    $sql = "SELECT Campus_id, College_id, Program_id FROM student_course WHERE Student_id = $studentId ORDER BY StudentCourse_id DESC LIMIT 1";
    $res = $conn->query($sql);
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $campusId  = intval($row['Campus_id']);
        $collegeId = intval($row['College_id']);
        $programId = intval($row['Program_id']);
    } else {
        echo json_encode(["success" => false, "message" => "Student course not found for student_id"]);
        $conn->close();
        exit();
    }
} else {
    echo json_encode(["success" => false, "message" => "Missing srcode or student_id"]);
    $conn->close();
    exit();
}

// Helper to compose full name
function compose($u) {
    if (!$u) return '';
    $t = trim((string)($u['Title'] ?? '')); 
    $f = strtoupper((string)($u['First_name'] ?? ''));
    $mi = !empty($u['Middle_name']) ? strtoupper(substr((string)$u['Middle_name'], 0, 1)).'.' : '';
    $l = strtoupper((string)($u['Last_name'] ?? ''));
    return trim($t.' '.$f.' '.($mi ? $mi.' ' : '').$l);
}

// --- Program Chair: match Campus, College, Program; designation like Chairperson ---
$chairSql = "SELECT ud.Designation_id, ud.College_id, ud.User_id, d.designation_name, c.college_name
    FROM user_designation ud
    LEFT JOIN designation d ON ud.Designation_id = d.designation_id
    LEFT JOIN college c ON ud.College_id = c.college_id
    WHERE ud.Campus_id = $campusId AND ud.College_id = $collegeId AND ud.Program_id = $programId
    AND (d.designation_name LIKE '%Chairperson%')
    ORDER BY ud.UserDesignation_id DESC
    LIMIT 1";
$chairRes = $conn->query($chairSql);
$chair = $chairRes && $chairRes->num_rows > 0 ? $chairRes->fetch_assoc() : null;
$chairName = $chairDesignation = $chairCollege = 'N/A';
if ($chair) {
    $uid = intval($chair['User_id']);
    $userSql = "SELECT Title, First_name, Middle_name, Last_name FROM user_manage WHERE User_id = $uid LIMIT 1";
    $userRes = $conn->query($userSql);
    $user = $userRes && $userRes->num_rows > 0 ? $userRes->fetch_assoc() : null;
    $chairName = compose($user);
    $chairDesignation = $chair['designation_name'] ?? 'N/A';
    $chairCollege = $chair['college_name'] ?? 'N/A';
}

// --- Dean: match Campus, College only; designation like Dean ---
$deanSql = "SELECT ud.Designation_id, ud.College_id, ud.User_id, d.designation_name, c.college_name
    FROM user_designation ud
    LEFT JOIN designation d ON ud.Designation_id = d.designation_id
    LEFT JOIN college c ON ud.College_id = c.college_id
    WHERE ud.Campus_id = $campusId AND ud.College_id = $collegeId
    AND (d.designation_name LIKE '%Dean%')
    ORDER BY ud.UserDesignation_id DESC
    LIMIT 1";
$deanRes = $conn->query($deanSql);
$dean = $deanRes && $deanRes->num_rows > 0 ? $deanRes->fetch_assoc() : null;
$deanName = $deanDesignation = $deanCollege = 'N/A';
if ($dean) {
    $uid = intval($dean['User_id']);
    $userSql = "SELECT Title, First_name, Middle_name, Last_name FROM user_manage WHERE User_id = $uid LIMIT 1";
    $userRes = $conn->query($userSql);
    $user = $userRes && $userRes->num_rows > 0 ? $userRes->fetch_assoc() : null;
    $deanName = compose($user);
    $deanDesignation = $dean['designation_name'] ?? 'N/A';
    $deanCollege = $dean['college_name'] ?? 'N/A';
}

echo json_encode([
    'program_chair' => [
        'name' => $chairName,
        'designation' => $chairDesignation,
        'college' => $chairCollege,
    ],
    'dean' => [
        'name' => $deanName,
        'designation' => $deanDesignation,
        'college' => $deanCollege,
    ]
]);
$conn->close();
