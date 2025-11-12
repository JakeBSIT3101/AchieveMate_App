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

$collegeId = isset($_GET['college_id']) ? intval($_GET['college_id']) : null;
$campusId  = isset($_GET['campus_id'])  ? intval($_GET['campus_id'])  : null;
$programId = isset($_GET['program_id']) ? intval($_GET['program_id']) : null;
$majorId   = isset($_GET['major_id'])   ? intval($_GET['major_id'])   : null;

if (!$collegeId) {
    echo json_encode(["success" => false, "message" => "Missing college_id"]);
    exit();
}

function compose($u) {
    if (!$u) return '';
    $t = trim((string)($u['Title'] ?? ''));
    $f = strtoupper((string)($u['First_name'] ?? ''));
    $mi = $u['Middle_name'] ? strtoupper(substr((string)$u['Middle_name'], 0, 1)).'.' : '';
    $l = strtoupper((string)($u['Last_name'] ?? ''));
    return trim($t.' '.$f.' '.($mi ? $mi.' ' : '').$l);
}

$CHAIR_ID = 12;
$DEAN_ID = 10;

// Chair
$chairSql = "SELECT ud.*, um.Title, um.First_name, um.Middle_name, um.Last_name
    FROM user_designation ud
    LEFT JOIN user_manage um ON ud.User_id = um.User_id
    WHERE ud.Designation_id = $CHAIR_ID AND ud.College_id = $collegeId";
if ($campusId) $chairSql .= " AND ud.Campus_id = $campusId";
$chairSql .= " ORDER BY (CASE WHEN ud.Program_id = $programId THEN 0 ELSE 1 END), (CASE WHEN ud.Major_id = $majorId THEN 0 ELSE 1 END) LIMIT 1";
$chairRes = $conn->query($chairSql);
$chair = $chairRes && $chairRes->num_rows > 0 ? $chairRes->fetch_assoc() : null;

if (!$chair) {
    $chairSql2 = "SELECT ud.*, um.Title, um.First_name, um.Middle_name, um.Last_name
        FROM user_designation ud
        LEFT JOIN user_manage um ON ud.User_id = um.User_id
        WHERE ud.Designation_id = $CHAIR_ID AND ud.College_id = $collegeId
        ORDER BY ud.UserDesignation_id DESC LIMIT 1";
    $chairRes2 = $conn->query($chairSql2);
    $chair = $chairRes2 && $chairRes2->num_rows > 0 ? $chairRes2->fetch_assoc() : null;
}

$chairName     = compose($chair) ?: 'N/A';
$chairPosition = 'Department Chairperson, ITE Program';

// Dean
$deanSql = "SELECT ud.*, um.Title, um.First_name, um.Middle_name, um.Last_name
    FROM user_designation ud
    LEFT JOIN user_manage um ON ud.User_id = um.User_id
    WHERE ud.Designation_id = $DEAN_ID AND ud.College_id = $collegeId";
if ($campusId) $deanSql .= " AND ud.Campus_id = $campusId";
$deanSql .= " ORDER BY (CASE WHEN ud.Program_id IS NULL THEN 0 ELSE 1 END), (CASE WHEN ud.Major_id IS NULL THEN 0 ELSE 1 END) LIMIT 1";
$deanRes = $conn->query($deanSql);
$dean = $deanRes && $deanRes->num_rows > 0 ? $deanRes->fetch_assoc() : null;

if (!$dean) {
    $deanSql2 = "SELECT ud.*, um.Title, um.First_name, um.Middle_name, um.Last_name
        FROM user_designation ud
        LEFT JOIN user_manage um ON ud.User_id = um.User_id
        WHERE ud.Designation_id = $DEAN_ID AND ud.College_id = $collegeId
        ORDER BY ud.UserDesignation_id DESC LIMIT 1";
    $deanRes2 = $conn->query($deanSql2);
    $dean = $deanRes2 && $deanRes2->num_rows > 0 ? $deanRes2->fetch_assoc() : null;
}

$deanName     = compose($dean) ?: 'N/A';
$deanPosition = 'Dean, College';

echo json_encode([
    'chair_name'     => $chairName,
    'chair_position' => $chairPosition,
    'dean_name'      => $deanName,
    'dean_position'  => $deanPosition,
]);
$conn->close();
