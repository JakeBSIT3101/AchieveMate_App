import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../config/api";
import { Checkbox, Provider as PaperProvider, DataTable } from "react-native-paper";
import { OCR_SERVER_CONFIG } from "../config/serverConfig";
import { AntDesign, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import locationsData from "../assets/load_locations.json";
import zipCodes from "../assets/load_zipcode.json";
import DatePicker from "react-native-date-picker";
import Pdf from "react-native-pdf";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ACADEMIC_YEAR_LABELS = {
  6: "2022-2023",
  9: "2023-2024",
  17: "2024-2025",
  18: "2025-2026",
};

const getAcademicYearLabel = (id) => {
  if (!id && id !== 0) return "N/A";
  return ACADEMIC_YEAR_LABELS[id] || `AY #${id}`;
};

const PLACEHOLDER_COLOR = "#999";
const DEFAULT_REQUIRED_COURSES = 56;
const CONSENT_FORM_BASE_DIMENSIONS = { width: 612, height: 792 };
const CONSENT_FORM_FIELDS = {
  lastName: { x: 166, y: 140 },
  firstName: { x: 285, y: 140 },
  middleName: { x: 425, y: 140 },
  extensionName: { x: 530, y: 140 },
  college: { x: 125, y: 180 },
  program: { x: 125, y: 193 },
  majorOrTrack: { x: 125, y: 206 },
  scholarshipGrant: { x: 125, y: 222 },
  parent1Name: { x: 125, y: 240 },
  parent1Contact: { x: 478, y: 240 },
  parent2Name: { x: 125, y: 254 },
  parent2Contact: { x: 478, y: 254 },
  fullName: { x: 110, y: 350 },
};
const CONSENT_FORM_CHECKBOXES = {
  campusNasugbu: { x: 362, y: 100 },
  consentAgreement: { x: 45.5, y: 276.5 },
};
const formatDateMMDDYYYY = (date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const parseDateFromString = (str) => {
  if (!str) return null;
  const parts = str.split(/[/-]/).map((p) => parseInt(p, 10));
  if (parts.length === 3 && !parts.some((n) => isNaN(n))) {
    const [m, d, y] = parts;
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
};

const formatDateToApi = (value) => {
  const parsed = parseDateFromString(value);
  if (!parsed) return null;
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const yyyy = parsed.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const formatSemesterLabel = (semester) => {
  if (semester === null || semester === undefined) return "N/A";
  const raw = semester.toString().trim().toUpperCase();
  const map = {
    "1": "FIRST SEMESTER",
    "2": "SECOND SEMESTER",
    "3": "SUMMER",
    "FIRST": "FIRST SEMESTER",
    "FIRST SEMESTER": "FIRST SEMESTER",
    "SECOND": "SECOND SEMESTER",
    "SECOND SEMESTER": "SECOND SEMESTER",
    "SUMMER": "SUMMER",
    "MIDYEAR": "MIDYEAR",
    "MID-YEAR": "MIDYEAR",
  };
  return map[raw] || raw || "N/A";
};

// Normalize course titles from OCR by fixing spacing and common merges
const fixCourseTitle = (title) => {
  if (!title) return "";
  let cleaned = title.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2"); // add space before caps
  cleaned = cleaned.replace(/([a-zA-Z])(\d)/g, "$1 $2"); // add space before digits
  cleaned = cleaned.replace(/(\d)([a-zA-Z])/g, "$1 $2"); // add space after digits

  const replacements = {
    AnalyticsApplication: "Analytics Application",
    SocialIssues: "Social Issues",
    "Social Issues and Professional Practice": "Social Issues and Professional Practice",
    andProfessional: "and Professional",
    ProfessionalPractice: "Professional Practice",
    QualityAssurance: "Quality Assurance",
    InformationAssurance: "Information Assurance",
    andSecurity: "and Security",
    PlatformTechnologies: "Platform Technologies",
    CapstoneProject: "Capstone Project",
    "Capstone Project2": "Capstone Project 2",
    CapstoneProject2: "Capstone Project 2",
    "Capstone Project 2": "Capstone Project 2",
    Project2: "Project 2",
    AdvancedInformation: "Advanced Information",
    "Information Assurance and Security": "Information Assurance and Security",
    AdvancedInformationAssurance: "Advanced Information Assurance",
    "Advanced Information Assurance and Security": "Advanced Information Assurance and Security",
    SystemsQuality: "Systems Quality",
    SystemsQualityAssurance: "Systems Quality Assurance",
    "Systems QualityAssurance": "Systems Quality Assurance",
    "System Quality Assurance": "Systems Quality Assurance",
    DatabaseManagement: "Database Management",
    ManagementSystem: "Management System",
    ComputerNetworking: "Computer Networking",
    DataAnalysis: "Data Analysis",
    TeamSports: "Team Sports",
    EnvironmentalSciences: "Environmental Sciences",
  };

  Object.entries(replacements).forEach(([bad, good]) => {
    cleaned = cleaned.replace(new RegExp(bad, "gi"), good);
  });

  return cleaned.replace(/\s+/g, " ").trim();
};

const stripFeeStrings = (value = "") => {
  const stopWords = ["internet fee", "cultural fee"];
  let cleaned = value;
  stopWords.forEach((word) => {
    const idx = cleaned.toLowerCase().indexOf(word);
    if (idx >= 0) {
      cleaned = cleaned.slice(0, idx).trim();
    }
  });
  return cleaned.trim();
};

const parseCourseData = (ocrText) => {
  try {
    const lines = ocrText.split('\n');
    const courseData = {
      studentInfo: {},
      courses: [],
      semester: '',
      academicYear: '',
      totalUnits: 0,
      scholarship: ''
    };

    const normalizeScholarshipValue = (value) =>
      (value || "").replace(/\s+/g, " ").trim();
    const isScholarshipCandidate = (value) => {
      if (!value || !/[a-zA-Z]/.test(value)) return false;
      const keywords = /(program|scholar|grant|tuition|allowance|aid|free)/i;
      return keywords.test(value) || value.includes(":") || value.split(" ").length >= 3;
    };

    // Extract student information and semester/year
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Extract SR Code
      if (trimmedLine.includes('SR  Code:') || trimmedLine.includes('SR Code:')) {
        const srMatch = trimmedLine.match(/SR\s*Code:\s*(\S+)/);
        if (srMatch) courseData.studentInfo.srCode = srMatch[1];
      }
      
      // Extract Name and Program from the same line
      if (trimmedLine.includes('Name:') && trimmedLine.includes('Program:')) {
        const nameMatch = trimmedLine.match(/Name:\s*([A-Z,\s]+?)\s+Program:\s*(.+)/);
        if (nameMatch) {
          courseData.studentInfo.name = nameMatch[1].trim();
          courseData.studentInfo.program = nameMatch[2].trim();
        }
      }
      
      // Extract Semester and Academic Year (format: FIRST, 2025-2026)
      if (trimmedLine.match(/^(FIRST|SECOND|SUMMER),?\s*(\d{4}-\d{4})$/)) {
        const semesterMatch = trimmedLine.match(/^(FIRST|SECOND|SUMMER),?\s*(\d{4}-\d{4})$/);
        if (semesterMatch) {
          courseData.semester = semesterMatch[1];
          courseData.academicYear = semesterMatch[2];
        }
      }

      if (!courseData.scholarship && trimmedLine.toLowerCase().includes('scholarship/s')) {
        const after = trimmedLine.split(/Scholarship\/s:/i)[1] || '';
        const inlineValue = normalizeScholarshipValue(after);
        let detected = "";

        for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
          const nextLine = normalizeScholarshipValue(lines[j]);
          if (!nextLine) continue;
          if (isScholarshipCandidate(nextLine)) {
            detected = nextLine;
            break;
          }
          if (!detected && nextLine) {
            detected = nextLine;
          }
        }

        if (!detected && isScholarshipCandidate(inlineValue)) {
          detected = inlineValue;
        }

        if (!detected && inlineValue) {
          detected = inlineValue;
        }

        courseData.scholarship = stripFeeStrings(detected || inlineValue);
      }
    }

    // Extract course information - looking for specific pattern in this OCR format
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for course lines that start with course codes (BAT, CS, ENGG, IT, etc.)
      const courseMatch = line.match(/^([A-Z]{2,4}\s+\d{3,4})\s+(.+?)\s+(\d+)\s+\(([^)]+)\)/);
      if (courseMatch) {
        const [, code, title, units, section] = courseMatch;
        
        // Clean up and fix spacing in the title
        const cleanTitle = fixCourseTitle(title);
        
        courseData.courses.push({
          code: code.replace(/\s+/g, ' ').trim(),
          title: cleanTitle,
          units: parseInt(units),
          section: section.trim()
        });
        courseData.totalUnits += parseInt(units);
      }
    }

    return courseData;
  } catch (error) {
    console.error('Error parsing course data:', error);
    return null;
  }
};

const REQUIREMENT_ITEMS = [
  { key: "approvalSheet", label: "Approval Sheet", required: true },
  { key: "libraryCertificate", label: "Certificate of Library", required: true },
  { key: "barangayClearance", label: "Barangay Clearance", required: false },
  { key: "birthCertificate", label: "Birth Certificate", required: false },
];
const EDIT_REQUIREMENT_FIELDS = [
  { key: "approval_sheet", label: "Approval Sheet", dbKey: "Approval_Sheet" },
  { key: "certificate_library", label: "Library Clearance", dbKey: "Certificate_Library" },
  { key: "barangay_clearance", label: "Barangay Clearance", dbKey: "Barangay_Clearance" },
  { key: "birth_certificate", label: "Birth Certificate (PSA)", dbKey: "Birth_Certificate" },
  { key: "applicationform_grad", label: "Graduation Application Form", dbKey: "applicationform_grad" },
  { key: "reportofgrade_path", label: "Report of Grades (COG)", dbKey: "reportofgrade_path" },
];
const GRAD_DETAILS_ENDPOINT = `${BASE_URL}/insert_graduation_details.php`;
const GRAD_REQUIREMENTS_ENDPOINT = `${BASE_URL}/insert_graduation_requirements.php`;
const GET_MISSING_COURSES_ENDPOINT = `${BASE_URL}/get_missing_courses.php`;
const GET_GRADUATION_STATUS_ENDPOINT = `${BASE_URL}/get_graduation.php`;
const DELETE_GRADUATION_FORM_ENDPOINT = `${BASE_URL}/delete_form.php`;

const GraduationEvaluation = ({ studentId, courseData, onEvaluationChange }) => {
  const [evaluationData, setEvaluationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gradeRecords, setGradeRecords] = useState(null);
  const [missingCoursesList, setMissingCoursesList] = useState([]);

  const computeEvaluationData = useCallback(
    (gradesArray = [], programRequirements = []) => {
      if (!Array.isArray(gradesArray)) return;

      const courseMap = new Map();

      gradesArray.forEach((grade) => {
        const numericGrade = parseFloat(grade.grade);
        const code = (grade.course_code || "").trim();
        if (
          !code ||
          isNaN(numericGrade) ||
          numericGrade > 3.0 ||
          courseMap.has(code.toUpperCase())
        ) {
          return;
        }

        courseMap.set(code.toUpperCase(), {
          code,
          title: grade.course_title || "No title available",
          grade: grade.grade,
          semester: grade.semester,
          academicYear: grade.academic_year_id,
        });
      });

      const rawCorCourses = Array.isArray(courseData)
        ? courseData
        : Array.isArray(courseData?.courses)
        ? courseData.courses
        : [];

      const normalizedCorCourses = rawCorCourses
        .map((course) => {
          const code = (course.courseCode || course.code || "").trim();
          return {
            code,
            title: course.courseTitle || course.title || "No title available",
            grade: "N/A",
            semester: course.semester || course.semesterLabel || "Current",
            academicYear: course.academicYear || course.academicYearLabel || "Current",
          };
        })
        .filter((course) => !!course.code);

      const corCoursesCount = normalizedCorCourses.length;

      normalizedCorCourses.forEach((course) => {
        const normalizedCode = course.code.toUpperCase();
        if (!courseMap.has(normalizedCode)) {
          courseMap.set(normalizedCode, course);
        }
      });

      const normalizedCurriculum = Array.isArray(programRequirements)
        ? programRequirements
            .map((course) => {
              const code = (course.course_code || course.code || "").trim();
              return {
                code,
                title: course.course_title || course.title || "No title available",
                yearLevel: course.year_level || course.year || course.level || "",
                semester:
                  formatSemesterLabel(course.semester) ||
                  course.semester_label ||
                  course.term ||
                  "",
                track:
                  course.track ||
                  course.track_name ||
                  course.specialization ||
                  course.major ||
                  course.major_name ||
                  course.major_abbrev ||
                  "",
                units: Number(course.units || course.credit_units || 0),
              };
            })
            .filter((course) => !!course.code)
        : [];

      const completedCourses = Array.from(courseMap.values()).filter(
        (course) => course.grade !== "N/A"
      );
      const gradeHistoryCount = completedCourses.length;
      const totalTaken = gradeHistoryCount + corCoursesCount;
      const missingCourses = normalizedCurriculum.filter((course) => {
        const codeKey = course.code?.toUpperCase();
        if (!codeKey) return false;
        return !courseMap.has(codeKey);
      });
      const derivedTrack =
        normalizedCurriculum.find((course) => course.track)?.track || "Your Track";
      const totalRequired =
        missingCourses.length > 0
          ? totalTaken + missingCourses.length
          : DEFAULT_REQUIRED_COURSES;

      const nextEvaluation = {
        status: "GRADUATING",
        matchedCourses: totalTaken,
        totalRequired,
        completionPercentage: totalRequired
          ? Math.round((totalTaken / totalRequired) * 100)
          : Math.round((totalTaken / 56) * 100),
        track: derivedTrack,
        isEligible: totalTaken >= 50,
        isEligibleForHonors: false,
        courseSummary: {
          corCourses: corCoursesCount,
          gradeHistory: gradeHistoryCount,
          totalTaken,
        },
        completedCourses,
        missingCourses,
      };

      setEvaluationData(nextEvaluation);
      if (typeof onEvaluationChange === "function") {
        onEvaluationChange(nextEvaluation);
      }
    },
    [courseData, onEvaluationChange]
  );


  useEffect(() => {
    const fetchGrades = async () => {
      try {
        console.log("Fetching grades for student ID:", studentId);
        const response = await fetch(`${BASE_URL}/get_student_grade.php?student_id=${studentId}`, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        if (data.success && Array.isArray(data.grades)) {
          setGradeRecords(data.grades);
        } else {
          const errorMessage = data.message || "Failed to load graduation data";
          console.error("API Error:", errorMessage);
          setError(errorMessage);
        }
      } catch (err) {
        console.error("Network Error:", err);
        setError("Unable to connect to the server. Please check your internet connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    const fetchMissingCourses = async (id) => {
      try {
        const response = await fetch(`${GET_MISSING_COURSES_ENDPOINT}?student_id=${id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.missing_courses)) {
          setMissingCoursesList(data.missing_courses);
        } else {
          setMissingCoursesList([]);
        }
      } catch (err) {
        console.error("Missing courses fetch error:", err);
        setMissingCoursesList([]);
      }
    };

    if (studentId) {
      console.log("Initializing grade fetch for student ID:", studentId);
      setLoading(true);
      setError(null);
      setEvaluationData(null);
      setGradeRecords(null);
      fetchMissingCourses(studentId);
      fetchGrades();
    } else {
      console.error("No student ID provided");
      setError("Student ID is missing. Please try again.");
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!Array.isArray(gradeRecords)) return;
    computeEvaluationData(gradeRecords, missingCoursesList);
  }, [gradeRecords, missingCoursesList, computeEvaluationData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading graduation evaluation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!evaluationData) {
    return null;
  }

  // Use evaluationData instead of graduationData in the JSX

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Graduation Evaluation</Text>
      </View>
      
      <View style={styles.statusContainer}>
        <View style={styles.statusHeader}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{evaluationData.status}</Text>
          </View>
          <Text style={styles.statusSubtext}>
            Matched {evaluationData.matchedCourses} of {evaluationData.totalRequired} required courses ({evaluationData.completionPercentage}% complete) | 
            Track: {evaluationData.track}
          </Text>
        </View>
        
        <View style={styles.eligibilityContainer}>
          <View style={styles.eligibilityItem}>
            {evaluationData.isEligible ? (
              <AntDesign name="checkcircle" size={20} color="#4CAF50" />
            ) : (
              <MaterialIcons name="cancel" size={20} color="#f44336" />
            )}
            <Text style={styles.eligibilityText}>
              {evaluationData.isEligible 
                ? 'Eligible to Apply for Graduation' 
                : 'Not Eligible to Apply Yet'}
            </Text>
          </View>
          <View style={styles.eligibilityItem}>
            {evaluationData.isEligibleForHonors ? (
              <MaterialIcons name="stars" size={20} color="#FFC107" />
            ) : (
              <MaterialIcons name="warning" size={20} color="#FFC107" />
            )}
            <Text style={styles.eligibilityText}>
              {evaluationData.isEligibleForHonors 
                ? 'Eligible for Latin Honors' 
                : 'Not eligible for Latin Honors yet'}
            </Text>
        </View>
      </View>
      
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{evaluationData.courseSummary.corCourses}</Text>
            <Text style={styles.summaryLabel}>COR Courses</Text>
            <Text style={styles.summarySubtext}>Currently Enrolled</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{evaluationData.courseSummary.gradeHistory}</Text>
            <Text style={styles.summaryLabel}>Grade History</Text>
            <Text style={styles.summarySubtext}>Previously Taken</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{evaluationData.courseSummary.totalTaken}</Text>
            <Text style={styles.summaryLabel}>Total Taken</Text>
          <Text style={styles.summarySubtext}>All Courses</Text>
        </View>
      </View>

      <View style={styles.missingCoursesContainer}>
        <View style={styles.missingCourseHeader}>
          <MaterialIcons name="warning" size={20} color="#FFC107" />
          <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8 }]}>
            Missing Courses ({evaluationData.missingCourses.length})
          </Text>
        </View>
        {evaluationData.missingCourses.length > 0 ? (
          evaluationData.missingCourses.map((course) => (
            <View key={course.code} style={styles.missingCourseCard}>
              <View style={styles.missingCourseHeader}>
                <Text style={styles.missingCourseCode}>{course.code}</Text>
                <Text style={styles.missingCourseTitle}>{course.title}</Text>
              </View>
              <View style={styles.missingCourseDetails}>
                <Text style={styles.missingCourseDetail}>
                  Year Level: {course.yearLevel || "N/A"}
                </Text>
                <Text style={styles.missingCourseDetail}>
                  Semester: {course.semester || "N/A"}
                </Text>
                {course.track ? (
                  <Text style={styles.missingCourseDetail}>Track: {course.track}</Text>
                ) : null}
                <Text style={styles.missingCourseDetail}>
                  Units: {course.units || "N/A"}
                </Text>
                <Text style={[styles.missingCourseDetail, styles.missingCourseStatus]}>
                  Never Taken
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noMissingCourses}>
            All required courses are either completed or currently enrolled.
          </Text>
        )}
      </View>
    </View>
      
      <View style={styles.completedCoursesContainer}>
        <Text style={styles.sectionTitle}>Completed Courses</Text>
        <ScrollView style={styles.completedCoursesList}>
          {evaluationData.completedCourses.length > 0 ? (
            evaluationData.completedCourses.map((course, index) => (
              <View key={`${course.code}-${index}`} style={styles.completedCourseItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" style={styles.courseCheckIcon} />
                <Text style={styles.completedCourseCode}>{course.code}</Text>
                <Text style={styles.completedCourseTitle} numberOfLines={1} ellipsizeMode="tail">
                  {course.title}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noCoursesText}>No completed courses found.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const StatusIndicator = ({ value }) => (
  <Text
    style={[
      styles.statusIndicator,
      value ? styles.statusIndicatorYes : styles.statusIndicatorNo,
    ]}
  >
    {value ? "✔" : "X"}
  </Text>
);

const GraduationStatusSummary = ({
  data,
  studentInfo,
  onEdit,
  onDelete,
  onPrint,
  onDownload,
  onRefresh,
  honorEligible = false,
}) => {
  const formRow = data?.graduation_form || {};
  const requirementsRow = data?.graduation_requirements || {};

  const srCode =
    studentInfo?.srCode ||
    formRow.SRCode ||
    formRow.sr_code ||
    formRow.srCode ||
    "N/A";
  const name =
    studentInfo?.fullName ||
    formRow.fullName ||
    [formRow.surname, formRow.firstName, formRow.middleName]
      .filter(Boolean)
      .join(", ") ||
    "N/A";
  const statusLabel =
    formRow.remarks || requirementsRow.remarks || "PENDING EVALUATION";

  const honorValue =
    honorEligible &&
    (requirementsRow.honor_applicant ||
      formRow.honor_applicant ||
      (requirementsRow.remarks || "")
        .toString()
        .toUpperCase()
        .includes("HONOR"));

  const requirementColumns = [
    { label: "AppSheet", value: requirementsRow.Approval_Sheet },
    { label: "Lib Cert", value: requirementsRow.Certificate_Library },
    { label: "PSA", value: requirementsRow.birth_certificate || requirementsRow.Birth_Certificate },
    { label: "TOR/F137", value: requirementsRow.reportofgrade_path },
    {
      label: "Honor Applicant?",
      value: honorValue,
    },
  ];

  return (
    <ScrollView style={styles.statusScreen}>
      <View style={styles.statusHeaderCard}>
        <Text style={styles.statusHeaderTitle}>Graduation Status</Text>
        <Text style={styles.statusHeaderSubtitle}>
          Track your submitted graduation requirements.
        </Text>
        <TouchableOpacity style={styles.refreshBadge} onPress={onRefresh}>
          <Ionicons name="refresh" size={16} color="#1d4ed8" />
          <Text style={styles.refreshBadgeText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusSectionTitle}>
          Graduation Requirements Summary
        </Text>
        <View style={styles.statusTableWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statusTable}>
          <View style={[styles.statusRow, styles.statusRowHeader]}>
            <Text style={[styles.statusCell, styles.cellNumber]}>No.</Text>
            <Text style={[styles.statusCell, styles.cellSR]}>SR CODE</Text>
            <Text style={[styles.statusCell, styles.cellName]}>NAME</Text>
            <Text style={[styles.statusCell, styles.cellStatus]}>Graduation Status</Text>
            {requirementColumns.map((col) => (
              <Text key={col.label} style={[styles.statusCell, styles.cellRequirement]}>
                {col.label}
              </Text>
            ))}
            <Text style={[styles.statusCell, styles.cellActions]}>Action</Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={[styles.statusCell, styles.cellNumber]}>1</Text>
            <Text style={[styles.statusCell, styles.cellSR]}>{srCode}</Text>
            <Text style={[styles.statusCell, styles.cellName]}>{name}</Text>
            <Text style={[styles.statusCell, styles.cellStatus]}>
              {statusLabel}
            </Text>
            {requirementColumns.map((col) => (
              <View key={col.label} style={[styles.statusCell, styles.cellRequirement]}>
                <StatusIndicator value={!!col.value} />
              </View>
            ))}
            <View style={[styles.statusCell, styles.cellActions]}>
              <TouchableOpacity style={styles.tableActionButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                <Text style={styles.tableActionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tableActionButton, styles.tableActionDanger]}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
                <Text style={[styles.tableActionText, { color: "#dc2626" }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusLegendRow}>
            <Text style={styles.legendItem}>
              <Text style={{ color: "#16a34a", fontWeight: "700" }}>✔</Text> submitted / cleared
            </Text>
            <Text style={styles.legendItem}>
              <Text style={{ color: "#dc2626", fontWeight: "700" }}>X</Text> not yet submitted / not
              cleared
            </Text>
          </View>
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.applicationDetailsCard}>
        <Text style={styles.applicationDetailsTitle}>Application Details</Text>
        <View style={styles.applicationInfoRow}>
          <View style={styles.applicationInfoItem}>
            <Text style={styles.applicationInfoLabel}>Application Date</Text>
            <Text style={styles.applicationInfoValue}>
              {formRow.application_date || formRow.created_at || "N/A"}
            </Text>
          </View>
          <View style={styles.applicationInfoItem}>
            <Text style={styles.applicationInfoLabel}>Last Updated</Text>
            <Text style={styles.applicationInfoValue}>
              {requirementsRow.updated_at || formRow.updated_at || "N/A"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statusActions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onPrint}>
          <Ionicons name="print-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Print Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDownload}>
          <Ionicons name="download-outline" size={18} color="#1d4ed8" />
          <Text style={styles.secondaryButtonText}>Download Documents</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default function ApplicationForGraduation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [coe, setCoe] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [courseData, setCourseData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [step1Consent, setStep1Consent] = useState(false);
  const [gradeReport, setGradeReport] = useState(null);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeError, setGradeError] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [loginId, setLoginId] = useState(null);
  const hasFetchedGradesRef = useRef(false);
  const [corFile, setCorFile] = useState(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [studentInfo, setStudentInfo] = useState({ srCode: "", fullName: "", program: "" });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState(null);
  const [pickerOptions, setPickerOptions] = useState([]);
  const [prefilledKeys, setPrefilledKeys] = useState([]);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [tempBirthDate, setTempBirthDate] = useState(new Date());
  const [birthPickerKey, setBirthPickerKey] = useState(0);
  const [pdfUri, setPdfUri] = useState(null);

  const getFieldStateStyle = useCallback((value) => {
    const hasValue =
      value !== null &&
      value !== undefined &&
      String(value).trim().length > 0;
    return hasValue ? styles.inputFilled : styles.inputEmpty;
  }, []);
  const [consentPdfUri, setConsentPdfUri] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [savingGradDetails, setSavingGradDetails] = useState(false);
  const [savingRequirements, setSavingRequirements] = useState(false);
  const [graduationFormId, setGraduationFormId] = useState(null);
  const [evaluationSummary, setEvaluationSummary] = useState(null);
  const [showLatinHonorsModal, setShowLatinHonorsModal] = useState(false);
  const [requirements, setRequirements] = useState(() => {
    const initial = {};
    REQUIREMENT_ITEMS.forEach((item) => {
      initial[item.key] = { fileName: "", uri: "", toFollow: false };
    });
    return initial;
  });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [graduationStatusData, setGraduationStatusData] = useState(null);
  const [editRequirementsVisible, setEditRequirementsVisible] = useState(false);
  const [editRequirementsSaving, setEditRequirementsSaving] = useState(false);
  const buildEmptyEditRequirementState = () => ({
    approval_sheet: { fileName: "", uri: "" },
    certificate_library: { fileName: "", uri: "" },
    barangay_clearance: { fileName: "", uri: "" },
    birth_certificate: { fileName: "", uri: "" },
    applicationform_grad: { fileName: "", uri: "" },
    reportofgrade_path: { fileName: "", uri: "" },
    remarks: "",
  });

  const [editRequirementsForm, setEditRequirementsForm] = useState(
    buildEmptyEditRequirementState()
  );
  const shouldAutoGraduate = useMemo(() => {
    const missing = evaluationSummary?.missingCourses;
    if (!Array.isArray(missing) || missing.length === 0) return false;
    return missing.every((course) => {
      const yearText = (course.yearLevel || course.year_level || "").toUpperCase();
      const semesterText = (course.semester || "").toUpperCase();
      return yearText.includes("FOURTH") && semesterText.includes("SECOND");
    });
  }, [evaluationSummary]);

  const latinHonorsEvaluation = useMemo(() => {
    const gwaNum = parseFloat(latinHonorsGwa?.gwa ?? "NaN");
    const lowestNum = parseFloat(lowestGradeValue);
    if (isNaN(gwaNum) || isNaN(lowestNum)) {
      return { eligible: false, tier: null, outstandingEligible: false };
    }

    if (gwaNum <= 1.25 && lowestNum <= 1.75) {
      return { eligible: true, tier: "Summa Cum Laude", outstandingEligible: false };
    }
    if (gwaNum <= 1.5 && lowestNum <= 2.0) {
      return { eligible: true, tier: "Magna Cum Laude", outstandingEligible: false };
    }
    if (gwaNum <= 1.75 && lowestNum <= 2.5) {
      return { eligible: true, tier: "Cum Laude", outstandingEligible: false };
    }

    const outstandingEligible = gwaNum <= 1.99 && lowestNum <= 3.0;
    return { eligible: false, tier: outstandingEligible ? "Outstanding Award" : null, outstandingEligible };
  }, [latinHonorsGwa, lowestGradeValue]);

  const qualifiesForLatinHonors = latinHonorsEvaluation.eligible;

  const gradeStats = useMemo(() => {
    if (!Array.isArray(gradeReport) || gradeReport.length === 0) {
      return null;
    }

    const normalize = (value) => (value ? value.toString().trim().toUpperCase() : "");

    const passed = gradeReport.filter((item) => normalize(item.remarks) === "PASSED").length;
    const failed = gradeReport.filter((item) => normalize(item.remarks) === "FAIL").length;
    const pending = gradeReport.length - passed - failed;

    return {
      total: gradeReport.length,
      passed,
      failed,
      pending,
    };
  }, [gradeReport]);

  const groupedGrades = useMemo(() => {
    if (!Array.isArray(gradeReport) || gradeReport.length === 0) {
      return [];
    }

    const semesterWeights = {
      FIRST: 1,
      "FIRST SEMESTER": 1,
      SECOND: 2,
      "SECOND SEMESTER": 2,
      SUMMER: 3,
      MIDYEAR: 4,
      "MID-YEAR": 4,
    };

    const buckets = new Map();

    gradeReport.forEach((item) => {
      const academicYearId = item.academic_year_id ?? "N/A";
      const academicYearLabel = getAcademicYearLabel(item.academic_year_id);
      const semesterLabel = formatSemesterLabel(item.semester) || "N/A";
      const yearLevelLabel = item.year_level || item.display_year_level || null;
      const key = `${academicYearId}|${semesterLabel}|${yearLevelLabel || ""}`;

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          academicYearId,
          academicYearLabel,
          semesterLabel,
          yearLevelLabel,
          records: [],
          semesterWeight: semesterWeights[semesterLabel?.toUpperCase?.()] || 99,
        });
      }

      buckets.get(key).records.push(item);
    });

    const normalizeId = (value) => {
      const num = parseInt(value, 10);
      if (!isNaN(num)) return num;
      return Number.MAX_SAFE_INTEGER;
    };

    return Array.from(buckets.values()).sort((a, b) => {
      const diff = normalizeId(a.academicYearId) - normalizeId(b.academicYearId);
      if (diff !== 0) return diff;

      if (a.semesterWeight !== b.semesterWeight) {
        return a.semesterWeight - b.semesterWeight;
      }

      return (a.yearLevelLabel || "").localeCompare(b.yearLevelLabel || "");
    });
  }, [gradeReport]);

  const latinHonorsGwa = useMemo(() => {
    if (!Array.isArray(gradeReport) || gradeReport.length === 0) {
      return { gwa: "N/A", totalUnits: 0, count: 0 };
    }
    let totalUnits = 0;
    let weighted = 0;
    const filtered = gradeReport.filter((rec) => {
      const code = (rec.course_code || "").toUpperCase();
      return code !== "NSTP 111" && code !== "NSTP 121";
    });
    filtered.forEach((rec) => {
      const unitsNum = parseFloat(rec.credit_units || rec.units || 0);
      const gradeNum = parseFloat(rec.grade);
      if (!isNaN(unitsNum) && unitsNum > 0 && !isNaN(gradeNum)) {
        totalUnits += unitsNum;
        weighted += unitsNum * gradeNum;
      }
    });
    return {
      gwa: totalUnits > 0 ? (weighted / totalUnits).toFixed(4) : "N/A",
      totalUnits,
      count: filtered.length,
    };
  }, [gradeReport]);

  const overallGwa = useMemo(() => {
    if (!Array.isArray(gradeReport) || gradeReport.length === 0) {
      return { gwa: "N/A", totalUnits: 0, count: 0 };
    }
    let totalUnits = 0;
    let weighted = 0;
    gradeReport.forEach((rec) => {
      const unitsNum = parseFloat(rec.credit_units || rec.units || 0);
      const gradeNum = parseFloat(rec.grade);
      if (!isNaN(unitsNum) && unitsNum > 0 && !isNaN(gradeNum)) {
        totalUnits += unitsNum;
        weighted += unitsNum * gradeNum;
      }
    });
    return {
      gwa: totalUnits > 0 ? (weighted / totalUnits).toFixed(4) : "N/A",
      totalUnits,
      count: gradeReport.length,
    };
  }, [gradeReport]);

  const lowestGradeValue = useMemo(() => {
    if (!Array.isArray(gradeReport) || gradeReport.length === 0) return "N/A";
    let max = null;
    gradeReport.forEach((rec) => {
      const gradeNum = parseFloat(rec.grade);
      if (!isNaN(gradeNum)) {
        max = max === null ? gradeNum : Math.max(max, gradeNum);
      }
    });
    return max === null ? "N/A" : max.toFixed(2);
  }, [gradeReport]);

  const [form, setForm] = useState({
    surname: "",
    firstName: "",
    middleName: "",
    extensionName: "",
    srCode: "",
    birthDate: "",
    placeOfBirth: "",
    contactNumber: "",
    emailAddress: "",
    scholarshipGrant: "",
    parent1Name: "",
    parent1Contact: "",
    parent2Name: "",
    parent2Contact: "",
    region: "",
    province: "",
    city: "",
    barangay: "",
    zipCode: "",
    address: "",
    secondarySchool: "",
    secondaryYear: "",
    elementarySchool: "",
    elementaryYear: "",
    college: "",
    program: "",
    major: "",
    gradDecemberChecked: false,
    gradDecemberYear: "",
    gradMayChecked: false,
    gradMayYear: "",
    gradMidtermChecked: false,
    gradMidtermYear: "",
  });

  const studentFullName = useMemo(
    () =>
      [form.firstName, form.middleName, form.surname, form.extensionName]
        .filter(Boolean)
        .join(" "),
    [form.firstName, form.middleName, form.surname, form.extensionName]
  );

  const buildGradesPdf = useCallback(async () => { return { targetPath: null, viewerHtml: null }; }, []);

  const buildFilledApplicationPdf = useCallback(async (values) => {
    try {
      const asset = Asset.fromModule(
        require("../assets/ApplicationForGraduation_template.pdf")
      );
      await asset.downloadAsync();

      const existingPdfBytes = await fetch(asset.uri).then((res) =>
        res.arrayBuffer()
      );

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const page = pages[0];
      const { width, height } = page.getSize();

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;

      const draw = (text, x, y) => {
        if (!text) return;
        page.drawText(String(text), {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      };

      // ==== NORMALIZE NAME PARTS ====
      const surname = (values.surname || "").trim();
      const firstName = (values.firstName || "").trim();
      const middleName = (values.middleName || "").trim();

      // Extension: skip if empty or "N/A"
      const rawExt = values.extensionName ?? "";
      const trimmedExt = rawExt.toString().trim();
      const extensionName =
        trimmedExt && trimmedExt.toUpperCase() !== "N/A" ? trimmedExt : "";

      // Full name for signatures
      const fullName = [firstName, middleName, surname, extensionName]
        .filter(Boolean)
        .join(" ");

      // ======== FIELD MAPPING ========

      const nameRowY = height - 155;
      draw(surname, 80, nameRowY);       // SURNAME
      draw(firstName, 230, nameRowY);    // FIRST NAME
      draw(middleName, 370, nameRowY);   // MIDDLE NAME
      if (extensionName) {
        draw(extensionName, 520, nameRowY); // EXTENSION (only if valid)
      }

      const birthRowY = height - 178;
      draw(values.srCode, 110, birthRowY);       // SR CODE
      draw(values.birthDate, 270, birthRowY);    // BIRTHDATE
      draw(values.placeOfBirth, 460, birthRowY); // PLACE OF BIRTH

      const homeAddrY = height - 210;
      draw(values.address || "", 75, homeAddrY); // HOME ADDRESS

      draw(values.zipCode, 500, height - 196);        // ZIP
      draw(values.contactNumber, 465, height - 213);  // CONTACT
      draw(values.emailAddress, 435, height - 231);   // EMAIL

      draw(values.secondarySchool, 175, height - 260);
      draw(values.secondaryYear, width - 80, height - 260);

      draw(values.elementarySchool, 175, height - 285);
      draw(values.elementaryYear, width - 80, height - 285);

      draw(values.college, 168, height - 320);
      draw(values.program, 168, height - 335);
      draw(values.major, 168, height - 349);

      // ======== DATE OF GRADUATION (YEAR + CHECKBOX) ========
      const gradRowY = height - 302.8;     // text row
      const gradCheckY = height - 302;     // small offset to center "X" in the boxes

      // December
      if (values.gradDecemberChecked && values.gradDecemberYear) {
        draw(values.gradDecemberYear, 273, gradRowY);   // year text
        draw("X", 180, gradCheckY);                     // checkbox before "DECEMBER"
      }

      // May
      if (values.gradMayChecked && values.gradMayYear) {
        draw(values.gradMayYear, 394, gradRowY);        // year text
        draw("X", 338, gradCheckY);                     // checkbox before "MAY"
      }

      // Midterm
      if (values.gradMidtermChecked && values.gradMidtermYear) {
        draw(values.gradMidtermYear, 550, gradRowY);    // year text
        draw("X", 467, gradCheckY);                     // checkbox before "MIDTERM"
      }

      // ======== REQUESTED BY FIELD (AUTO FILL NAME) ========
      const requestedByName = values.requestedBy?.trim()
        ? values.requestedBy.trim()
        : fullName;

      // "Requested by:" line
      draw(requestedByName, 110, height - 411);

      // Optional target grad year (if you still want this)
      if (values.targetGradYear) {
        draw(values.targetGradYear, 150, height - 420);
      }

      // ======== DATA PRIVACY AGREEMENT ========

      // Checkbox (use "X" instead of ✓ to avoid WinAnsi error)
      draw("X", 32, height - 577);

      // Signature over printed name of student (DPA area)
      if (fullName) {
        draw(fullName, 55, height - 638);
      }

      // ======== SAVE TO FILE ========
      const pdfBase64 = await pdfDoc.saveAsBase64();
      const targetPath =
        FileSystem.documentDirectory + "ApplicationForGraduation_filled.pdf";

      await FileSystem.writeAsStringAsync(targetPath, pdfBase64, {
        encoding: FileSystem.EncodingType
          ? FileSystem.EncodingType.Base64
          : "base64",
      });

      return targetPath;
    } catch (e) {
      console.warn("buildFilledApplicationPdf error:", e);
      throw e;
    }
  }, []);

  const buildConsentFormPdf = useCallback(
    async (values = {}) => {
      try {
        const asset = Asset.fromModule(require("../assets/Consent_Form.pdf"));
        await asset.downloadAsync();
        const existingPdfBytes = await fetch(asset.uri).then((res) => res.arrayBuffer());

        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const page = pdfDoc.getPages()[0];
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 10;

        const scaleX = width / CONSENT_FORM_BASE_DIMENSIONS.width;
        const scaleY = height / CONSENT_FORM_BASE_DIMENSIONS.height;

        const toCoords = ({ x, y }) => ({
          x: x * scaleX,
          y: height - y * scaleY,
        });

        const drawText = (text, key, size = fontSize) => {
          if (!text || !CONSENT_FORM_FIELDS[key]) return;
          const coords = toCoords(CONSENT_FORM_FIELDS[key]);
          page.drawText(String(text), {
            x: coords.x,
            y: coords.y,
            size,
            font,
            color: rgb(0, 0, 0),
          });
        };

        const checkBox = (key) => {
          if (!CONSENT_FORM_CHECKBOXES[key]) return;
          const coords = toCoords(CONSENT_FORM_CHECKBOXES[key]);
          page.drawText("X", {
            x: coords.x,
            y: coords.y,
            size: 12,
            font,
            color: rgb(0, 0, 0),
          });
        };

        const middleInitial = values.middleName
          ? values.middleName.charAt(0) + "."
          : "";

        const fullName = `${values.firstName} ${middleInitial} ${values.lastName}`.trim();

        drawText(values.lastName, "lastName");
        drawText(values.firstName, "firstName");
        drawText(values.middleName, "middleName");
        drawText(values.extensionName, "extensionName");
        drawText(fullName, "fullName");

        drawText(values.college, "college");
        drawText(values.program, "program");
        drawText(values.majorOrTrack, "majorOrTrack");
        drawText(values.scholarshipGrant || "None", "scholarshipGrant");

        drawText(values.parent1Name, "parent1Name");
        drawText(values.parent1Contact, "parent1Contact");
        drawText(values.parent2Name, "parent2Name");
        drawText(values.parent2Contact, "parent2Contact");

        checkBox("campusNasugbu");
        checkBox("consentAgreement");

        const pdfBase64 = await pdfDoc.saveAsBase64();
        const targetPath = FileSystem.documentDirectory + "Consent_Form_filled.pdf";

        await FileSystem.writeAsStringAsync(targetPath, pdfBase64, {
          encoding: FileSystem.EncodingType
            ? FileSystem.EncodingType.Base64
            : "base64",
        });

        return targetPath;
      } catch (error) {
        console.warn("buildConsentFormPdf error:", error);
        throw error;
      }
    },
    []
  );

  const refreshConsentForm = useCallback(async () => {
    try {
      const consentPath = await buildConsentFormPdf({
        lastName: form.surname,
        firstName: form.firstName,
        middleName: form.middleName,
        extensionName: form.extensionName,
        college: form.college,
        program: form.program,
        majorOrTrack: form.major || evaluationSummary?.track || "",
        scholarshipGrant: form.scholarshipGrant || "None",
        parent1Name: form.parent1Name,
        parent1Contact: form.parent1Contact,
        parent2Name: form.parent2Name,
        parent2Contact: form.parent2Contact,
      });
      setConsentPdfUri(consentPath);
    } catch (error) {
      Alert.alert("Consent Form Error", "Unable to refresh the consent form.");
    }
  }, [
    buildConsentFormPdf,
    evaluationSummary?.track,
    form.college,
    form.extensionName,
    form.firstName,
    form.major,
    form.parent1Contact,
    form.parent1Name,
    form.parent2Contact,
    form.parent2Name,
    form.program,
    form.scholarshipGrant,
    form.surname,
  ]);

  const openApplicationTemplate = useCallback(async () => {
    try {
      const asset = Asset.fromModule(
        require("../assets/ApplicationForGraduation_template.pdf")
      );

      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;

      if (!uri) {
        throw new Error("PDF file path not found.");
      }

      // Just set the URI – viewer will show inline when this has a value
      setPdfUri(uri);

    } catch (error) {
      console.warn("Failed to open template:", error);
      Alert.alert("Error", "Unable to load the application form template.");
    }
  }, []);

  // Update steps array to reflect the new step 2
  const steps = [
    "Guidelines",
    "Graduation Evaluation",
    "Upload Grades",
    "Application Form",
    "Generate Form",
    "Requirements Upload",
    "Review",
  ];

  const STORAGE_KEY = "@app_grad_form_v1";

  useEffect(() => {
    (async () => {
      try {
        const sessionRaw = await AsyncStorage.getItem("session");
        if (!sessionRaw) return;

        const session = JSON.parse(sessionRaw);
        const resolvedId =
          session?.student_id ||
          session?.Student_id ||
          session?.login_id ||
          null;

        if (resolvedId) setStudentId(resolvedId);
        if (session?.login_id) setLoginId(session.login_id);
        if (session?.SRCODE || session?.srCode || session?.sr_code) {
        setStudentInfo((prev) => ({
          ...prev,
          srCode: session.SRCODE || session.srCode || session.sr_code,
        }));
      }
      } catch (error) {
        console.warn("Failed to resolve student ID:", error);
      }
    })();
  }, []);

  const loadGraduationStatus = useCallback(
    async (id) => {
      try {
        setStatusLoading(true);
        setStatusError(null);
        const response = await fetch(
          `${GET_GRADUATION_STATUS_ENDPOINT}?student_id=${encodeURIComponent(id)}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || "Unable to load graduation status.");
        }
        setGraduationStatusData(data);
      } catch (error) {
        console.warn("Graduation status error:", error);
        setStatusError(error.message || "Failed to load graduation status.");
        setGraduationStatusData(null);
      } finally {
        setStatusLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (studentId) {
      loadGraduationStatus(studentId);
    }
  }, [studentId, loadGraduationStatus]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Always reset location fields on load
          parsed.region = "";
          parsed.province = "";
          parsed.city = "";
          parsed.barangay = "";
          parsed.zipCode = "";
          // Clear birthdate to avoid stale selected date on refresh
          parsed.birthDate = "";
          setForm(parsed);
        }
      } catch (e) {
        console.warn("Failed to load saved form:", e);
      }
    })();
  }, []);

  const fetchStudentInfo = useCallback(
    async (login) => {
      if (!login) return;
      try {
        const response = await fetch(`${BASE_URL}/getuser.php?login_id=${encodeURIComponent(login)}`);
        const data = await response.json();
        if (!data.success) return;
        const student = data.student || {};

        const fullName = [student.First_name, student.Middle_name, student.Last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        setStudentId((prev) => prev || student.Student_id || null);
        setStudentInfo({
          srCode: student.SRCODE || "",
          fullName: fullName || "",
          program:
            student.Program_name ||
            student.Abbreviation ||
            form.program ||
            courseData?.studentInfo?.program ||
            "",
        });

        setForm((prev) => {
          const next = { ...prev };
          const newPrefilled = new Set(prefilledKeys);
          const setFromUser = (key, val, fallbackNA = false) => {
            const str = val !== null && val !== undefined ? val.toString().trim() : "";
            if (str) {
              next[key] = str;
              newPrefilled.add(key);
            } else if (fallbackNA) {
              next[key] = "N/A";
              newPrefilled.add(key);
            }
          };

          setFromUser("surname", student.Last_name, true);
          setFromUser("firstName", student.First_name, true);
          setFromUser("middleName", student.Middle_name, true);
          setFromUser("extensionName", student.Extension || student.Suffix, true);
          setFromUser("srCode", student.SRCODE);
          setFromUser("contactNumber", student.Contact);
          setFromUser("emailAddress", student.Email);

          const programName =
            student.Program_name ||
            student.program ||
            student.Abbreviation ||
            prev.program ||
            "";
          setFromUser("program", programName);

          const collegeName =
            student.College_name ||
            student.college ||
            student.College ||
            "";
          setFromUser("college", collegeName);

          const majorName =
            student.Major_name ||
            student.major ||
            student.Major ||
            "";
          setFromUser("major", majorName);

          setPrefilledKeys(Array.from(newPrefilled));
          return next;
        });
      } catch (error) {
        console.warn("Failed to fetch student info:", error);
      }
    },
    [form.program, courseData?.studentInfo?.program, prefilledKeys]
  );

  useEffect(() => {
    if (loginId) {
      fetchStudentInfo(loginId);
    }
  }, [loginId, fetchStudentInfo]);

  useEffect(() => {
    if (courseData?.scholarship) {
      setForm((prev) => {
        if (prev.scholarshipGrant === courseData.scholarship) return prev;
        return { ...prev, scholarshipGrant: courseData.scholarship };
      });
    }
  }, [courseData?.scholarship]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch (e) {
        console.warn("Failed to save form:", e);
      }
    })();
  }, [form]);

const fetchGradeReport = async (id, { fromRefresh = false } = {}) => {
    if (!id) return;

    if (!fromRefresh) {
      hasFetchedGradesRef.current = true;
    }

    setGradeLoading(true);
    setGradeError(null);

    try {
      const response = await fetch(
        `${BASE_URL}/get_student_grade.php?student_id=${encodeURIComponent(id)}`
      );

      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to load grades.");
      }

      const normalizedGrades = (data.grades || []).map((g) => ({
        ...g,
        course_title: g.course_title || g.course_name || g.subject_description || g.course_code || "Subject",
        course_name: g.course_title || g.course_name || g.subject_description || g.course_code || "Subject",
        credit_units: g.course_units || g.credit_units || g.units || g.unit || null,
      }));

      // Deduplicate by course code/title + academic year + semester to avoid duplicate rows
      const seen = new Set();
      const dedupedGrades = normalizedGrades.filter((g) => {
        const key = [
          g.course_code || "",
          g.course_title || "",
          g.academic_year_id || "",
          (g.semester || "").toString().trim().toUpperCase(),
          g.section || "",
        ].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setGradeReport(dedupedGrades);
    } catch (error) {
      if (!fromRefresh) {
        hasFetchedGradesRef.current = false;
      }
      setGradeError(error.message || "Unable to fetch grades.");
    } finally {
      setGradeLoading(false);
    }
  };

  const refreshApplicationData = useCallback(() => {
    if (!studentId) return;
    loadGraduationStatus(studentId);
    fetchGradeReport(studentId, { fromRefresh: true });
  }, [studentId, loadGraduationStatus]);

  // Support either array-of-regions structure or PSGC-style object structure
  const regionsArray = useMemo(() => {
    if (Array.isArray(locationsData)) {
      return locationsData;
    }
    if (locationsData && typeof locationsData === "object") {
      return Object.values(locationsData).map((r) => ({
        region_name: r.region_name,
        provinces: r.province_list,
      }));
    }
    return [];
  }, []);

  const getRegions = useCallback(() => {
    return regionsArray.map((r) => r.region_name).filter(Boolean);
  }, [regionsArray]);

  const getProvinces = useCallback(
    (regionName) => {
      if (!regionName) return [];
      const region = regionsArray.find(
        (r) => r.region_name?.toLowerCase() === regionName.toLowerCase()
      );
      if (!region) return [];

      if (Array.isArray(region.provinces)) {
        return region.provinces.map((p) => p.province_name).filter(Boolean);
      }
      if (region.provinces && typeof region.provinces === "object") {
        return Object.keys(region.provinces);
      }
      return [];
    },
    [regionsArray]
  );

  const getCities = useCallback(
    (regionName, provinceName) => {
      if (!regionName || !provinceName) return [];
      const region = regionsArray.find(
        (r) => r.region_name?.toLowerCase() === regionName.toLowerCase()
      );
      if (!region) return [];

      let province;
      if (Array.isArray(region.provinces)) {
        province = region.provinces.find(
          (p) => p.province_name?.toLowerCase() === provinceName.toLowerCase()
        );
        return province?.cities?.map((c) => c.city_name).filter(Boolean) || [];
      } else if (region.provinces && typeof region.provinces === "object") {
        province = region.provinces[provinceName] || region.provinces[provinceName.toUpperCase()];
        if (!province) return [];
        return Object.keys(province.municipality_list || {});
      }
      return [];
    },
    [regionsArray]
  );

  const getBarangays = useCallback(
    (regionName, provinceName, cityName) => {
      if (!regionName || !provinceName || !cityName) return [];
      const region = regionsArray.find(
        (r) => r.region_name?.toLowerCase() === regionName.toLowerCase()
      );
      if (!region) return [];

      if (Array.isArray(region.provinces)) {
        const province = region.provinces.find(
          (p) => p.province_name?.toLowerCase() === provinceName.toLowerCase()
        );
        const city = province?.cities?.find(
          (c) => c.city_name?.toLowerCase() === cityName.toLowerCase()
        );
        return city?.barangays?.filter(Boolean) || [];
      }

      if (region.provinces && typeof region.provinces === "object") {
        const province =
          region.provinces[provinceName] || region.provinces[provinceName.toUpperCase()];
        const muni =
          province?.municipality_list?.[cityName] ||
          province?.municipality_list?.[cityName.toUpperCase()];
        return muni?.barangay_list?.filter(Boolean) || [];
      }
      return [];
    },
    [regionsArray]
  );

  const normalizeStr = (s) =>
    (s || "")
      .toString()
      .replace(/^PH\s*-\s*/i, "")
      .replace(/[’`]/g, "'")
      .trim()
      .toUpperCase();

  const findZipCode = useCallback(
    (province, city, barangay) => {
      if (!zipCodes || !Array.isArray(zipCodes)) return "";
      const prov = normalizeStr(province);
      const cty = normalizeStr(city);
      const brgy = normalizeStr(barangay);

      const candidates = [];
      if (prov && cty && brgy) candidates.push(`${prov} ${cty} ${brgy}`);
      if (prov && cty) candidates.push(`${prov} ${cty}`);
      if (prov && brgy) candidates.push(`${prov} ${brgy}`);
      if (prov) candidates.push(prov);

      for (const cand of candidates) {
        const hit = zipCodes.find((z) => normalizeStr(z.area).includes(cand));
        if (hit?.zip) return hit.zip;
      }
      return "";
    },
    []
  );

  const showPicker = (type) => {
    let options = [];
    if (type === "region") {
      options = getRegions();
    } else if (type === "province") {
      options = getProvinces(form.region);
    } else if (type === "city") {
      options = getCities(form.region, form.province);
    } else if (type === "barangay") {
      options = getBarangays(form.region, form.province, form.city);
    }
    setPickerOptions(options);
    setPickerType(type);
    setPickerVisible(true);
  };

  const openBirthPicker = () => {
    const existing = parseDateFromString(form.birthDate);
    setTempBirthDate(existing || new Date());
    setBirthPickerKey((k) => k + 1); // force re-render to avoid stale spinner state
    setShowBirthPicker(true);
  };

  const confirmBirthdate = () => {
    if (tempBirthDate) {
      updateField("birthDate", formatDateMMDDYYYY(tempBirthDate));
    }
    setShowBirthPicker(false);
  };

  const cancelBirthdate = () => {
    setShowBirthPicker(false);
  };

    const generateApplicationForm = useCallback(async () => {
      try {
        // Build filled PDF gamit ang Step 4 form values
        const filledUri = await buildFilledApplicationPdf(form);

        // Set as source ng Step 5 viewer
        setPdfUri(filledUri);

        Alert.alert(
          "Success",
          "Your application form has been generated. Scroll down to view it."
        );
      } catch (e) {
        Alert.alert(
          "Error",
          "We couldn't generate the application form. Please try again."
        );
      }
    }, [buildFilledApplicationPdf, form]);

  const handleSelectOption = (value) => {
    if (!pickerType) return;
    if (pickerType === "region") {
      updateField("region", value);
      updateField("province", "");
      updateField("city", "");
      updateField("barangay", "");
      updateField("zipCode", "");
    } else if (pickerType === "province") {
      updateField("province", value);
      updateField("city", "");
      updateField("barangay", "");
      updateField("zipCode", "");
    } else if (pickerType === "city") {
      updateField("city", value);
      updateField("barangay", "");
      const zip = findZipCode(form.province, value, "");
      updateField("zipCode", zip || "");
    } else if (pickerType === "barangay") {
      updateField("barangay", value);
      const zip = findZipCode(form.province, form.city, value);
      updateField("zipCode", zip || "");
      const autoAddress = [value, form.city, form.province].filter(Boolean).join(", ");
      if (autoAddress) updateField("address", autoAddress);
    }
    setPickerVisible(false);
    setPickerType(null);
  };

  const handlePickCor = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.type === "cancel") return;
      const file = result.assets ? result.assets[0] : result;
      if (!file?.uri) {
        Alert.alert("Upload failed", "No file URI returned.");
        return;
      }
      setCorFile({ name: file.name || "COR.pdf", uri: file.uri });
      setCoe(file.uri);
      setOcrLoading(true);
      setOcrText("");
      setCourseData(null);

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "cor.pdf",
        type: "application/pdf",
      });

      const response = await fetch(
        OCR_SERVER_CONFIG.getEndpointURL(OCR_SERVER_CONFIG.ENDPOINTS.OCR_DIRECT),
        {
          method: "POST",
          body: formData,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const statusText = await response.text();
      if (!response.ok) {
        let msg = "";
        try {
          const parsed = JSON.parse(statusText);
          msg = parsed.error;
        } catch (_e) {
          msg = statusText;
        }
        throw new Error(msg || `COR OCR failed with status ${response.status}`);
      }

      let data = {};
      try {
        data = JSON.parse(statusText);
      } catch (_e) {
        data = {};
      }

      const text = data.full_text || data.raw_text || "";
      setOcrText(text);
      const parsedData = parseCourseData(text);
      if (parsedData) {
        setCourseData(parsedData);
        if (parsedData.scholarship) {
          setForm((prev) => ({ ...prev, scholarshipGrant: parsedData.scholarship }));
        }
      }
      Alert.alert("Uploaded", "COR uploaded and processed.");
    } catch (error) {
      Alert.alert("Upload failed", error.message || "Unable to process COR file.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRequirementUpload = async (key) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.type === "cancel") return;
      const file = result.assets ? result.assets[0] : result;
      if (!file?.uri) {
        Alert.alert("Upload failed", "No file URI returned.");
        return;
      }
      setRequirements((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          fileName: file.name || "document",
          uri: file.uri,
          toFollow: false,
        },
      }));
    } catch (error) {
      Alert.alert("Upload failed", "Unable to select file.");
    }
  };

  const toggleRequirementFollow = (key) => {
    setRequirements((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        toFollow: !prev[key]?.toFollow,
        ...(prev[key]?.toFollow
          ? {}
          : {
              fileName: "",
              uri: "",
            }),
      },
    }));
  };

  const renderRequirementCard = ({ key, label, required }) => {
    const data = requirements[key] || {};
    return (
      <View key={key} style={styles.requirementCard}>
        <View style={styles.requirementHeader}>
          <Text style={styles.requirementTitle}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
          <Text style={styles.requirementHint}>
            PDF or Image (JPG/PNG) {required ? "" : "(optional)"}
          </Text>
        </View>

        <View style={styles.requirementFileRow}>
          <TouchableOpacity
            style={styles.requirementUploadButton}
            onPress={() => handleRequirementUpload(key)}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            <Text style={styles.requirementUploadText}>Choose File</Text>
          </TouchableOpacity>
          <Text style={styles.requirementFileName}>
            {data.fileName || "No file chosen"}
          </Text>
        </View>

        <View style={styles.requirementFollowRow}>
          <Checkbox
            status={data.toFollow ? "checked" : "unchecked"}
            onPress={() => toggleRequirementFollow(key)}
            color="#DC143C"
          />
          <Text style={styles.requirementFollowText}>Mark as To Follow</Text>
        </View>
      </View>
    );
  };

  const saveGraduationDetails = useCallback(async () => {
    if (!studentId) {
      throw new Error("Student ID is missing.");
    }

    const derivedHomeAddress =
      form.address ||
      [form.barangay, form.city, form.province, form.region]
        .filter((part) => !!part)
        .join(", ");

    const payload = {
      student_id: Number(studentId),
      birthdate: formatDateToApi(form.birthDate),
      place_of_birth: form.placeOfBirth || null,
      home_address: derivedHomeAddress || null,
      zip_code: form.zipCode || null,
      secondary_school: form.secondarySchool || null,
      secondary_year: form.secondaryYear || null,
      elementary_school: form.elementarySchool || null,
      elementary_year: form.elementaryYear || null,
      scholarship_grant: form.scholarshipGrant || null,
      guardian_1: form.parent1Name || guardianName || null,
      guardian_1_contact: form.parent1Contact || guardianContact || null,
      guardian_2: form.parent2Name || null,
      guardian_2_contact: form.parent2Contact || null,
    };

    const response = await fetch(GRAD_DETAILS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      // ignore parse error; handled below
    }

    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Failed to save graduation details.");
    }

    if (data?.graduation_form_id) {
      setGraduationFormId(data.graduation_form_id);
    }

    return data;
  }, [
    studentId,
    form.address,
    form.barangay,
    form.birthDate,
    form.city,
    form.elementarySchool,
    form.elementaryYear,
    form.parent1Contact,
    form.parent1Name,
    form.parent2Contact,
    form.parent2Name,
    form.placeOfBirth,
    form.province,
    form.region,
    form.scholarshipGrant,
    form.secondarySchool,
    form.secondaryYear,
    form.zipCode,
    guardianContact,
    guardianName,
  ]);

  const saveGraduationRequirements = useCallback(async () => {
    let formId = graduationFormId;
    if (!formId) {
      const saved = await saveGraduationDetails();
      formId = saved?.graduation_form_id;
    }

    if (!formId) {
      throw new Error("Graduation Form ID is missing. Please complete Step 4 first.");
    }

    const resolveRequirementValue = (key) => {
      const data = requirements[key];
      if (!data || data.toFollow) return null;
      return data.uri || data.fileName || null;
    };

    const payload = {
      graduation_form_id: formId,
      approval_sheet: resolveRequirementValue("approvalSheet"),
      certificate_library: resolveRequirementValue("libraryCertificate"),
      barangay_clearance: resolveRequirementValue("barangayClearance"),
      birth_certificate: resolveRequirementValue("birthCertificate"),
      applicationform_grad: pdfUri || null,
      reportofgrade_path: null,
      remarks: shouldAutoGraduate ? "GRADUATING" : "Pending Review",
      status: "For Evaluation",
    };

    const response = await fetch(GRAD_REQUIREMENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      // ignore parse error
    }

    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Failed to save graduation requirements.");
    }

    return data;
  }, [graduationFormId, pdfUri, requirements, saveGraduationDetails, shouldAutoGraduate]);

  const handleSubmitApplication = () => {
    setShowLatinHonorsModal(true);
  };

  const handleLatinHonorsChoice = async (apply) => {
    setShowLatinHonorsModal(false);
    if (apply) {
      if (!latinHonorsEvaluation.eligible) {
        Alert.alert(
          "Not Eligible",
          latinHonorsEvaluation.outstandingEligible
            ? "You currently qualify for the Outstanding Award, but not for Latin Honors."
            : "You are not yet eligible for Latin Honors. Keep improving your grades."
        );
        return;
      }
      try {
        const consentPath = await buildConsentFormPdf({
          lastName: form.surname,
          firstName: form.firstName,
          middleName: form.middleName,
          extensionName: form.extensionName,
          college: form.college,
          program: form.program,
          majorOrTrack: form.major || evaluationSummary?.track || "",
          scholarshipGrant: form.scholarshipGrant || "None",
          parent1Name: form.parent1Name,
          parent1Contact: form.parent1Contact,
          parent2Name: form.parent2Name,
          parent2Contact: form.parent2Contact,
        });
        setConsentPdfUri(consentPath);
        setShowConsentModal(true);
        Alert.alert(
          "Submitted",
          `Your application and ${latinHonorsEvaluation.tier} consent form have been submitted.`
        );
      } catch (error) {
        Alert.alert(
          "Consent Form Error",
          "Unable to generate the consent form. Please try again."
        );
      }
    } else {
      Alert.alert("Submitted", "Your application has been submitted.");
    }
  };

  const nextStep = useCallback(async () => {
    if (currentStep === 4) {
      try {
        setSavingGradDetails(true);
        await saveGraduationDetails();
        setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
      } catch (error) {
        Alert.alert("Save failed", error.message || "Unable to save graduation details.");
      } finally {
        setSavingGradDetails(false);
      }
      return;
    }

    if (currentStep === 6) {
      try {
        setSavingRequirements(true);
        await saveGraduationRequirements();
        setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
      } catch (error) {
        Alert.alert("Save failed", error.message || "Unable to save requirements.");
      } finally {
        setSavingRequirements(false);
      }
      return;
    }

    setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
  }, [currentStep, saveGraduationDetails, saveGraduationRequirements, steps.length]);
  const prevStep = () =>
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleGrad = (key) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearFormStorage = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setForm({
        surname: "",
        firstName: "",
        middleName: "",
        extensionName: "",
        srCode: "",
        birthDate: "",
        placeOfBirth: "",
        homeAddress: "",
        zipCode: "",
        contactNumber: "",
        emailAddress: "",
        secondarySchool: "",
        secondaryYear: "",
        elementarySchool: "",
        elementaryYear: "",
        gradDecemberChecked: false,
        gradDecemberYear: "",
        gradMayChecked: false,
        gradMayYear: "",
        gradMidtermChecked: false,
        gradMidtermYear: "",
        college: "",
        program: "",
        major: "",
      });
      setCoe(null);
      setOcrText("");
      setCourseData(null);
      setGradeReport(null);
      setAttachments([]);
      setGuardianName("");
      setGuardianContact("");
      Alert.alert("Cleared", "Saved form cleared from local storage.");
    } catch (e) {
      console.warn("Failed to clear saved form:", e);
    }
  };

  const hasExistingApplication = graduationStatusData?.has_graduation_form;

  const handleStatusEdit = () => {
    const req = graduationStatusData?.graduation_requirements || {};
    const mapField = (dbKey) => {
      const value = req[dbKey] || req[dbKey?.toLowerCase?.()] || "";
      return { fileName: value || "", uri: "" };
    };
    setEditRequirementsForm({
      approval_sheet: mapField("Approval_Sheet"),
      certificate_library: mapField("Certificate_Library"),
      barangay_clearance: mapField("Barangay_Clearance"),
      birth_certificate: mapField("Birth_Certificate"),
      applicationform_grad: mapField("applicationform_grad"),
      reportofgrade_path: mapField("reportofgrade_path"),
      remarks: req.remarks || "",
    });
    setEditRequirementsVisible(true);
  };
  const handleStatusDelete = () => {
    if (!studentId) return;
    Alert.alert(
      "Delete Application",
      "Are you sure you want to delete your graduation application? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, delete",
          style: "destructive",
          onPress: async () => {
            try {
              setStatusLoading(true);
              const response = await fetch(
                `${DELETE_GRADUATION_FORM_ENDPOINT}?student_id=${encodeURIComponent(studentId)}`
              );
              const data = await response.json();
              if (!response.ok || !data?.success) {
                throw new Error(data?.message || "Failed to delete graduation form.");
              }
              Alert.alert("Deleted", "Your graduation form has been removed.");
              setGraduationStatusData(null);
              loadGraduationStatus(studentId);
            } catch (error) {
              Alert.alert("Delete failed", error.message || "Unable to delete application.");
            } finally {
              setStatusLoading(false);
            }
          },
        },
      ]
    );
  };
  const handleStatusPrint = () => {
    Alert.alert("Print Status", "Printing will be available soon.");
  };
  const handleStatusDownload = () => {
    Alert.alert("Download", "Download option will be available soon.");
  };
  const handleStatusRefresh = () => {
    if (studentId) {
      loadGraduationStatus(studentId);
    }
  };

  const handleEditRequirementPick = async (fieldKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.type === "cancel") return;
      const file = result.assets ? result.assets[0] : result;
      if (!file?.uri) {
        Alert.alert("Upload failed", "No file URI returned.");
        return;
      }
      setEditRequirementsForm((prev) => ({
        ...prev,
        [fieldKey]: {
          fileName: file.name || "document",
          uri: file.uri,
        },
      }));
    } catch (error) {
      Alert.alert("Upload failed", "Unable to select file.");
    }
  };

  const handleSaveRequirementsEdit = async () => {
    if (!graduationStatusData?.graduation_form_id) return;
    try {
      setEditRequirementsSaving(true);
      const resolveValue = (key) =>
        editRequirementsForm[key]?.uri || editRequirementsForm[key]?.fileName || null;

      const payload = {
        graduation_form_id: graduationStatusData.graduation_form_id,
        approval_sheet: resolveValue("approval_sheet"),
        certificate_library: resolveValue("certificate_library"),
        barangay_clearance: resolveValue("barangay_clearance"),
        birth_certificate: resolveValue("birth_certificate"),
        applicationform_grad: resolveValue("applicationform_grad"),
        reportofgrade_path: resolveValue("reportofgrade_path"),
        remarks: editRequirementsForm.remarks || null,
        status:
          graduationStatusData?.graduation_requirements?.status ||
          graduationStatusData?.graduation_form?.status ||
          "For Evaluation",
      };

      const response = await fetch(GRAD_REQUIREMENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update requirements.");
      }

      Alert.alert("Saved", "Graduation requirements updated.");
      setEditRequirementsVisible(false);
      loadGraduationStatus(studentId);
    } catch (error) {
      Alert.alert("Update failed", error.message || "Unable to update requirements.");
    } finally {
      setEditRequirementsSaving(false);
    }
  };

  if (statusLoading) {
    return (
      <PaperProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Checking graduation status...</Text>
        </View>
      </PaperProvider>
    );
  }

  if (statusError) {
    return (
      <PaperProvider>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{statusError}</Text>
          <TouchableOpacity style={[styles.primaryButton, { alignSelf: "center", marginTop: 12 }]} onPress={handleStatusRefresh}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </PaperProvider>
    );
  }

  const honorsBadgeText = qualifiesForLatinHonors
    ? `Congratulations!`
    : latinHonorsEvaluation.outstandingEligible
    ? `Great effort!`
    : `Heads up!`;
  const honorsHighlightText = qualifiesForLatinHonors
    ? `You qualify for ${latinHonorsEvaluation.tier}.`
    : latinHonorsEvaluation.outstandingEligible
    ? "You qualify for the Outstanding Award."
    : "You are not yet eligible for Latin Honors.";
  const honorsQuestionText = qualifiesForLatinHonors
    ? "Would you like to apply for Latin Honors?"
    : latinHonorsEvaluation.outstandingEligible
    ? "Outstanding Award recognition will be noted."
    : "Keep improving to become eligible for Latin Honors.";

  const renderWizard = () => (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={statusLoading || gradeLoading} onRefresh={refreshApplicationData} />
      }
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Application for Graduation</Text>
      </View>

        {/* Step progress */}
        <View style={styles.progressContainer}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepContainer}>
              <View
                style={[
                  styles.circle,
                  currentStep === index + 1 && styles.activeCircle,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep === index + 1 && styles.activeStepNumber,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.stepLabel}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {/* STEP 1 - Guidelines */}
          {currentStep === 1 && (
            <View>
              <Text style={styles.stepTitle}>Step 1: Guidelines</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Graduation Guidelines</Text>
                <Text style={styles.cardText}>
                  A student’s completion of academic requirements is recognized
                  through the Graduation Application Process, which ensures that
                  only qualified candidates are endorsed for graduation.
                </Text>
                <View style={styles.list}>
                  <Text style={styles.listItem}>
                    • Apply for graduation within the prescribed schedule set by
                    the university;
                  </Text>
                  <Text style={styles.listItem}>
                    • Upload required documents including COR and Final Grades;
                  </Text>
                  <Text style={styles.listItem}>
                    • Ensure all uploaded grades correspond to the approved
                    curriculum;
                  </Text>
                  <Text style={styles.listItem}>
                    • Address any noted deficiencies before submitting the
                    application;
                  </Text>
                  <Text style={styles.listItem}>
                    • Submit the completed Graduation Application Form for
                    Program Chair review.
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>DATA PRIVACY AGREEMENT</Text>
                <Text style={styles.cardText}>
                  I agree that my details be utilized for evaluating my academic
                  records and other graduation-related purposes.
                </Text>
                <Text style={styles.signature}>
                  Signature over Printed Name of Student
                </Text>

                <View style={styles.checkboxContainer}>
                  <Checkbox
                    status={step1Consent ? "checked" : "unchecked"}
                    onPress={() => setStep1Consent(!step1Consent)}
                    color="#DC143C"
                  />
                  <Text style={styles.text}>
                    I have read and agree to the Data Privacy Agreement.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2 - Upload COR and Graduation Evaluation */}
          {currentStep === 2 && (
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Step 2: Upload COR and View Graduation Status</Text>
              
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.stepTitle, { fontSize: 18, marginBottom: 10 }]}>Upload Certificate of Registration (COR)</Text>
                <Text style={styles.text}>
                  Please upload your current COR (PDF) to check your graduation status.
                  Make sure it is clear, complete, and follows the filename format
                  <Text style={{ fontWeight: "700" }}> Lastname_Firstname_COR.pdf</Text>.
                </Text>

                <View style={styles.requirementsContainer}>
                  <Text style={styles.requirementsTitle}>File Requirements</Text>
                  <Text style={styles.requirementText}>• Accepted format: PDF only</Text>
                  <Text style={styles.requirementText}>• Ensure the file is clear, complete, and official</Text>
                  <Text style={styles.requirementText}>• Example filename: Lastname_Firstname_COR.pdf</Text>
                </View>

                <TouchableOpacity style={styles.uploadButton} onPress={handlePickCor}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.uploadButtonText}>Choose File</Text>
                </TouchableOpacity>
              </View>
              
              {/* Show uploaded file info and preview */}
              {corFile && !ocrLoading && (
                <View style={{ marginTop: 20 }}>
                  <Text style={[styles.stepTitle, { fontSize: 18, marginBottom: 10 }]}>Uploaded COR</Text>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{corFile.name}</Text>
                    <Pdf
                      source={{ uri: corFile.uri }}
                      style={styles.pdfPreview}
                      onError={(error) => console.log('PDF error:', error)}
                    />
                  </View>
                </View>
              )}

              {/* Graduation Evaluation - Show after file upload */}
              {corFile && !ocrLoading && studentId && (
                <View style={{ marginTop: 20, marginBottom: 20, flex: 1 }}>
                  <GraduationEvaluation 
                    studentId={studentId} 
                    courseData={courseData}
                    onEvaluationChange={setEvaluationSummary}
                  />
                </View>
              )}

              {ocrLoading && (
                <View style={{ marginTop: 12, alignItems: "center" }}>
                  <ActivityIndicator size="large" color="#DC143C" />
                  <Text style={{ marginTop: 8, color: "#555" }}>Processing COR…</Text>
                </View>
              )}

              {corFile && !ocrLoading && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Selected COR</Text>
                  <Text style={styles.cardText}>{corFile.name}</Text>
                  <Text style={styles.cardText} numberOfLines={1}>
                    {corFile.uri}
                  </Text>
                  {courseData?.studentInfo && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.sectionHeader}>Detected Info</Text>
                      {courseData.studentInfo.name ? (
                        <Text style={styles.cardText}>Name: {courseData.studentInfo.name}</Text>
                      ) : null}
                      {courseData.studentInfo.srCode ? (
                        <Text style={styles.cardText}>SR Code: {courseData.studentInfo.srCode}</Text>
                      ) : null}
                      {courseData.studentInfo.program ? (
                        <Text style={styles.cardText}>Program: {courseData.studentInfo.program}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* STEP 3 - Upload Grades */}
          {currentStep === 3 && (
            <View>
              <Text style={styles.stepTitle}>Step 3: Report of Grades</Text>
              <Text style={styles.text}>
                We automatically generated your latest report of grades from the
                registrar. Review the details below; no PDF upload is required.
              </Text>

              {!gradeLoading && !gradeReport && !gradeError && (
                <View style={styles.recordsHeroCard}>
                  <Text style={styles.recordsTitle}>Student Academic Records</Text>
                  <Text style={styles.recordsSubtitle}>
                    View grades pulled directly from the university database. Tap below to load them.
                  </Text>
                  <View style={styles.recordsBulletList}>
                    <Text style={styles.recordsBullet}>• Data comes from your official records.</Text>
                    <Text style={styles.recordsBullet}>• Verify completeness and accuracy before proceeding.</Text>
                  </View>
                  <Text style={styles.recordsFooterNote}>
                    Use the Load My Academic Records button to retrieve the latest data.
                  </Text>
                </View>
              )}

              <View style={styles.gradeHeaderRow}>
                <View>
                  <Text style={styles.gradeMetaLabel}>Student ID</Text>
                  <Text style={styles.gradeMetaValue}>{studentId || "N/A"}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.loadRecordsButton,
                    (!studentId || gradeLoading) && styles.refreshButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!studentId) return;
                    setGradeReport(null);
                    fetchGradeReport(studentId, { fromRefresh: true });
                  }}
                  disabled={!studentId || gradeLoading}
                >
                  <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                  <Text style={styles.loadRecordsButtonText}>
                    {gradeLoading ? "Loading..." : "Load My Academic Records"}
                  </Text>
                </TouchableOpacity>
              </View>

              {gradeLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#DC143C" />
                  <Text style={styles.loadingText}>Generating report...</Text>
                </View>
              )}

              {!gradeLoading && gradeError && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning" size={20} color="#DC143C" />
                  <Text style={styles.errorText}>{gradeError}</Text>
                </View>
              )}

              {!gradeLoading && !gradeError && gradeReport && gradeReport.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={36} color="#bbb" />
                  <Text style={styles.emptyStateTitle}>No grades found</Text>
                  <Text style={styles.emptyStateText}>
                    We could not find any grade records for your account yet. Please
                    contact your program chair if you believe this is an error.
                  </Text>
                </View>
              )}

              {!gradeLoading && !gradeError && groupedGrades.length > 0 && (
                <>
                  <View style={styles.recordsHeroCard}>
                    <Text style={styles.recordsTitle}>Student Academic Records</Text>
                    <Text style={styles.recordsSubtitle}>
                      View all your grades pulled directly from the university database. Verify completeness and accuracy
                      before proceeding.
                    </Text>
                    <View style={styles.recordsBulletList}>
                      <Text style={styles.recordsBullet}>• Ensure all grades are complete and accurate.</Text>
                      <Text style={styles.recordsBullet}>• Data is fetched directly from your official student records.</Text>
                    </View>
                    <Text style={styles.recordsFooterNote}>
                      Need to update your records? Tap the "Load My Academic Records" button to refresh.
                    </Text>
                  </View>

                  <View style={styles.studentInfoPanel}>
                    <View style={styles.studentInfoHeaderBar}>
                      <Ionicons name="information-circle-outline" size={18} color="#fff" />
                      <Text style={styles.studentInfoHeaderText}>Student Information</Text>
                    </View>
                    <View style={styles.studentInfoContent}>
                      <View style={styles.studentInfoRow}>
                        <View style={styles.studentInfoItem}>
                          <Text style={styles.infoLabel}>SR Code:</Text>
                          <Text style={styles.infoValue}>
                            {studentInfo.srCode || courseData?.studentInfo?.srCode || form.srCode || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.studentInfoItem}>
                          <Text style={styles.infoLabel}>Full Name:</Text>
                          <Text style={styles.infoValue}>
                            {studentInfo.fullName || studentFullName || courseData?.studentInfo?.name || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.studentInfoItem}>
                          <Text style={styles.infoLabel}>Program:</Text>
                          <Text style={styles.infoValue}>
                            {studentInfo.program || courseData?.studentInfo?.program || form.program || "N/A"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.generatedRow}>
                        <Ionicons name="time-outline" size={14} color="#4b5563" />
                        <Text style={styles.generatedText}>Generated: {new Date().toLocaleDateString()}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.overallCard}>
                    <Text style={styles.overallTitle}>Overall GWA</Text>
                    <Text style={styles.overallValue}>{overallGwa?.gwa ?? "N/A"}</Text>
                    <Text style={styles.overallMeta}>
                      Subjects: {overallGwa?.count ?? "N/A"} • Total Units: {overallGwa?.totalUnits || "N/A"}
                    </Text>
                  </View>

                  <View style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Ionicons name="document-text-outline" size={18} color="#1f2937" />
                      <Text style={styles.historyTitle}>Complete Academic History</Text>
                    </View>
                    <View style={{ gap: 16 }}>
                      {groupedGrades.map((group) => (
                        <View key={group.key} style={styles.termCard}>
                          <View style={styles.termHeader}>
                            <Text style={styles.termTitle}>
                              {(group.semesterLabel || "SEMESTER")} · AY {group.academicYearLabel || "N/A"}
                            </Text>
                          </View>
                          <View style={styles.termMetaRow}>
                            <Text style={styles.termMetaText}>
                              Subjects: {group.records.length}
                            </Text>
                          </View>
                          <View style={[styles.gradeDetailTableContainer, { padding: 8 }]}>
                            <ScrollView horizontal style={styles.gradeDetailHorizontalContent}>
                              <View style={[styles.gradeDetailTable, { minWidth: 900 }]}>
                                <View style={[styles.gradeDetailRow, styles.gradeDetailHeaderRow]}>
                                  <View style={[styles.gradeDetailCell, styles.codeColumnWide]}>
                                    <Text style={styles.gradeDetailHeaderText}>Code</Text>
                                  </View>
                                  <View style={[styles.gradeDetailCell, { flex: 2.8 }]}>
                                    <Text style={styles.gradeDetailHeaderText}>Description</Text>
                                  </View>
                                  <View style={[styles.gradeDetailCell, styles.gradeColumnWide]}>
                                    <Text style={styles.gradeDetailHeaderText}>Credits</Text>
                                  </View>
                                  <View style={[styles.gradeDetailCell, styles.gradeColumnWide]}>
                                    <Text style={styles.gradeDetailHeaderText}>Grade</Text>
                                  </View>
                                  <View style={[styles.gradeDetailCell, styles.instructorColumnWide]}>
                                    <Text style={styles.gradeDetailHeaderText}>Instructor</Text>
                                  </View>
                                </View>

                                <ScrollView style={[styles.gradeDetailVerticalScroll, { maxHeight: 320 }]}>
                                  {group.records.map((record, idx) => (
                                    <View
                                      key={`${group.key}-${idx}`}
                                      style={[
                                        styles.gradeDetailRow,
                                        idx % 2 === 0 ? styles.gradeRowEven : styles.gradeRowOdd,
                                      ]}
                                    >
                                      <View style={[styles.gradeDetailCell, styles.codeColumnWide]}>
                                        <Text style={styles.gradeDetailCellText}>
                                          {record.course_code || "N/A"}
                                        </Text>
                                      </View>
                                      <View style={[styles.gradeDetailCell, { flex: 2.8, alignItems: "flex-start" }]}>
                                        <Text style={[styles.gradeDetailCellText, { textAlign: "left", fontSize: 13 }]}>
                                          {record.course_title || record.course_name || "Subject"}
                                        </Text>
                                      </View>
                                      <View style={[styles.gradeDetailCell, styles.gradeColumnWide]}>
                                        <Text style={styles.gradeDetailCellText}>
                                          {record.credit_units || "-"}
                                        </Text>
                                      </View>
                                      <View style={[styles.gradeDetailCell, styles.gradeColumnWide]}>
                                        <Text style={styles.gradeDetailCellText}>
                                          {record.grade || "N/A"}
                                        </Text>
                                      </View>
                                      <View style={[styles.gradeDetailCell, styles.instructorColumnWide]}>
                                        <Text style={[styles.gradeDetailCellText, { textAlign: "left", fontSize: 13 }]}>
                                          {record.instructor || "N/A"}
                                        </Text>
                                      </View>
                                    </View>
                                  ))}
                                </ScrollView>
                              </View>
                            </ScrollView>
                          </View>
                          {(() => {
                            let totalUnits = 0;
                            let weighted = 0;
                            group.records.forEach((rec) => {
                            const unitsNum = parseFloat(rec.credit_units || rec.units || 0);
                            const gradeNum = parseFloat(rec.grade);
                            if (!isNaN(unitsNum) && unitsNum > 0 && !isNaN(gradeNum)) {
                              totalUnits += unitsNum;
                              weighted += unitsNum * gradeNum;
                            }
                          });
                            const gwa = totalUnits > 0 ? (weighted / totalUnits).toFixed(4) : "N/A";
                            return (
                              <Text style={styles.termFooterText}>
                                Total Subjects: {group.records.length} • Total Units: {totalUnits || "N/A"} • GWA: {gwa}
                              </Text>
                            );
                          })()}
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* STEP 4 - Application Form */}
          {currentStep === 4 && (
            <View>
              <Text style={styles.stepTitle}>Step 4: Application Form</Text>
              <Text style={styles.text}>Fill out the required fields below accurately.</Text>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Surname</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.surname)]}
                    placeholder="e.g., Dela Cruz"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.surname}
                    onChangeText={(v) => updateField("surname", v)}
                    editable={!prefilledKeys.includes("surname")}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.firstName)]}
                    placeholder="e.g., Juan"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.firstName}
                    onChangeText={(v) => updateField("firstName", v)}
                    editable={!prefilledKeys.includes("firstName")}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Middle Name</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.middleName)]}
                    placeholder="e.g., Santos"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.middleName}
                    onChangeText={(v) => updateField("middleName", v)}
                    editable={!prefilledKeys.includes("middleName")}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Ext.</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.extensionName)]}
                    placeholder="Jr., III (optional)"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.extensionName}
                    onChangeText={(v) => updateField("extensionName", v)}
                    editable={!prefilledKeys.includes("extensionName")}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>SR Code</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.srCode)]}
                    placeholder="e.g., 22-72350"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.srCode}
                    onChangeText={(v) => updateField("srCode", v)}
                    editable={!prefilledKeys.includes("srCode")}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Birthdate</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openBirthPicker}
                  >
                    <View style={[styles.input, styles.dateInput, getFieldStateStyle(form.birthDate)]}>
                      <Text style={form.birthDate ? styles.dateText : styles.placeholderText}>
                        {form.birthDate || "mm/dd/yyyy"}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Place of Birth</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.placeOfBirth)]}
                    placeholder="e.g., Nasugbu, Batangas"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.placeOfBirth}
                    onChangeText={(v) => updateField("placeOfBirth", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Contact Number</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.contactNumber)]}
                    placeholder="09XXXXXXXXX"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.contactNumber}
                    onChangeText={(v) => updateField("contactNumber", v)}
                    keyboardType="phone-pad"
                    editable={!prefilledKeys.includes("contactNumber")}
                  />
                </View>
              </View>

              <View style={styles.fullWidthField}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, getFieldStateStyle(form.emailAddress)]}
                  placeholder="e.g., 22-72350@g.batstate-u.edu.ph"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={form.emailAddress}
                  onChangeText={(v) => updateField("emailAddress", v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!prefilledKeys.includes("emailAddress")}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Scholarship Grant</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.scholarshipGrant)]}
                    placeholder="e.g., None / Name of grant"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.scholarshipGrant}
                    onChangeText={(v) => updateField("scholarshipGrant", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Parent 1 (Full Name)</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.parent1Name)]}
                    placeholder="e.g., Jane Dela Cruz"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.parent1Name}
                    onChangeText={(v) => updateField("parent1Name", v)}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Parent 1 Contact</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.parent1Contact)]}
                    placeholder="09XXXXXXXXX"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.parent1Contact}
                    onChangeText={(v) => updateField("parent1Contact", v)}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Parent 2 (Full Name)</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.parent2Name)]}
                    placeholder="e.g., Juan Dela Cruz"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.parent2Name}
                    onChangeText={(v) => updateField("parent2Name", v)}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Parent 2 Contact</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.parent2Contact)]}
                    placeholder="09XXXXXXXXX"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.parent2Contact}
                    onChangeText={(v) => updateField("parent2Contact", v)}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Region</Text>
                  <TouchableOpacity style={[styles.selectBox, getFieldStateStyle(form.region)]} onPress={() => showPicker("region")}>
                    <View style={styles.selectBoxContent}>
                      <Text style={styles.selectText}>{form.region || "Select region"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Province</Text>
                  <TouchableOpacity style={[styles.selectBox, getFieldStateStyle(form.province)]} onPress={() => showPicker("province")}>
                    <View style={styles.selectBoxContent}>
                      <Text style={styles.selectText}>{form.province || "Select province"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>City/Municipality</Text>
                  <TouchableOpacity style={[styles.selectBox, getFieldStateStyle(form.city)]} onPress={() => showPicker("city")}>
                    <View style={styles.selectBoxContent}>
                      <Text style={styles.selectText}>{form.city || "Select city/municipality"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Barangay</Text>
                  <TouchableOpacity style={[styles.selectBox, getFieldStateStyle(form.barangay)]} onPress={() => showPicker("barangay")}>
                    <View style={styles.selectBoxContent}>
                      <Text style={styles.selectText}>{form.barangay || "Select barangay"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>ZIP Code</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.zipCode)]}
                    placeholder="e.g., 4200"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.zipCode}
                    onChangeText={(v) => updateField("zipCode", v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.fullWidthField}>
                <Text style={styles.inputLabel}>House No./Street/Subdivision (optional)</Text>
                <TextInput
                  style={[styles.input, getFieldStateStyle(form.address)]}
                  placeholder="e.g., Barangay 7 (Pob.), Nasugbu, Batangas"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={form.address}
                  onChangeText={(v) => updateField("address", v)}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Secondary School Graduated</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.secondarySchool)]}
                    placeholder="e.g., ABC High School"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.secondarySchool}
                    onChangeText={(v) => updateField("secondarySchool", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Year Graduated</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.secondaryYear)]}
                    placeholder="e.g., 2022"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.secondaryYear}
                    onChangeText={(v) => updateField("secondaryYear", v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Elementary School Graduated</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.elementarySchool)]}
                    placeholder="e.g., ABC Elementary School"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.elementarySchool}
                    onChangeText={(v) => updateField("elementarySchool", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Year Graduated</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.elementaryYear)]}
                    placeholder="e.g., 2016"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.elementaryYear}
                    onChangeText={(v) => updateField("elementaryYear", v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>College</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.college)]}
                    placeholder="e.g., College of Informatics and Computing Sciences"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.college}
                    onChangeText={(v) => updateField("college", v)}
                    editable={!prefilledKeys.includes("college")}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Program</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.program)]}
                    placeholder="e.g., Bachelor of Science in IT"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.program}
                    onChangeText={(v) => updateField("program", v)}
                    editable={!prefilledKeys.includes("program")}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <View style={styles.checkboxContainer}>
                    <Checkbox
                      status={form.gradDecemberChecked ? "checked" : "unchecked"}
                      onPress={() => toggleGrad("gradDecemberChecked")}
                      color="#DC143C"
                    />
                    <Text style={styles.text}>Graduation in December?</Text>
                    {form.gradDecemberChecked && (
                      <TextInput
                        style={[styles.input, getFieldStateStyle(form.gradDecemberYear), { flex: 1 }]}
                        placeholder="Year"
                        value={form.gradDecemberYear}
                        onChangeText={(value) => updateField("gradDecemberYear", value)}
                      />
                    )}
                  </View>
                </View>
                <View style={styles.inputCol}>
                  <View style={styles.checkboxContainer}>
                    <Checkbox
                      status={form.gradMayChecked ? "checked" : "unchecked"}
                      onPress={() => toggleGrad("gradMayChecked")}
                      color="#DC143C"
                    />
                    <Text style={styles.text}>Graduation in May?</Text>
                    {form.gradMayChecked && (
                      <TextInput
                        style={[styles.input, getFieldStateStyle(form.gradMayYear), { flex: 1 }]}
                        placeholder="Year"
                        value={form.gradMayYear}
                        onChangeText={(value) => updateField("gradMayYear", value)}
                      />
                    )}
                  </View>
                </View>
                <View style={styles.inputCol}>
                  <View style={styles.checkboxContainer}>
                    <Checkbox
                      status={form.gradMidtermChecked ? "checked" : "unchecked"}
                      onPress={() => toggleGrad("gradMidtermChecked")}
                      color="#DC143C"
                    />
                    <Text style={styles.text}>Graduation in Midterm?</Text>
                    {form.gradMidtermChecked && (
                      <TextInput
                        style={[styles.input, getFieldStateStyle(form.gradMidtermYear), { flex: 1 }]}
                        placeholder="Year"
                        value={form.gradMidtermYear}
                        onChangeText={(value) => updateField("gradMidtermYear", value)}
                      />
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Major</Text>
                  <TextInput
                    style={[styles.input, getFieldStateStyle(form.major)]}
                    placeholder="e.g., Business Analytics"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.major}
                    onChangeText={(v) => updateField("major", v)}
                    editable={!prefilledKeys.includes("major")}
                  />
                </View>
              </View>
            </View>
          )}

          {/* STEP 5 - Validation & Info */}
          {currentStep === 5 && (
            <View>
              <Text style={styles.stepTitle}>Step 5: Generate Application Form</Text>
              <Text style={styles.text}>
                Review your details and generate your application form using the information you provided.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={generateApplicationForm}
              >
                <Text style={styles.submitText}>Generate Application Form</Text>
              </TouchableOpacity>

              {/* Inline PDF viewer below the button */}
              {pdfUri && (
                <View style={styles.pdfViewerBox}>
                  <Text style={styles.pdfViewerTitle}>Application Form Template</Text>

                  <View style={styles.pdfViewerFrame}>
                    <Pdf
                      source={{ uri: pdfUri }}
                      style={{ flex: 1 }}
                      onError={(err) => console.log("PDF load error:", err)}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* STEP 6 - Requirements Upload */}
          {currentStep === 6 && (
            <View>
              <Text style={styles.stepTitle}>Step 6: Requirements Upload</Text>
              <Text style={styles.text}>
                Upload the required documents below. You may mark an item as "To Follow" if you plan to submit it later.
              </Text>
              <View style={styles.requirementsUploadSection}>
                {REQUIREMENT_ITEMS.map((item) => renderRequirementCard(item))}
              </View>
            </View>
          )}

          {/* STEP 7 - Review & Submit */}
          {currentStep === 7 && (
            <View>
              <Text style={styles.stepTitle}>Step 7: Review & Submit</Text>
              <Text style={styles.text}>
                Please review all your inputs and attachments before submitting.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitApplication}
              >
                <Text style={styles.submitText}>Submit Application</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: "#aaa", marginTop: 12 }]}
                onPress={clearFormStorage}
              >
                <Text style={styles.submitText}>Clear Form</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.navButton} onPress={prevStep}>
              <Text style={styles.navButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {currentStep < steps.length && (
            <TouchableOpacity
              style={[
                styles.navButtonPrimary,
                currentStep === 1 && !step1Consent && { backgroundColor: "#aaa" },
                currentStep === 4 && savingGradDetails && { backgroundColor: "#aaa" },
                currentStep === 6 && savingRequirements && { backgroundColor: "#aaa" },
              ]}
              onPress={nextStep}
              disabled={
                (currentStep === 1 && !step1Consent) ||
                (currentStep === 4 && savingGradDetails) ||
                (currentStep === 6 && savingRequirements)
              }
            >
              <Text style={styles.navButtonTextPrimary}>
                {currentStep === 4 && savingGradDetails
                  ? "Saving..."
                  : currentStep === 6 && savingRequirements
                  ? "Saving..."
                  : "Next"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
    </ScrollView>
  );

  const renderContent = () => {
    if (hasExistingApplication) {
      return (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={statusLoading} onRefresh={handleStatusRefresh} />
          }
        >
          <GraduationStatusSummary
            data={graduationStatusData}
            studentInfo={studentInfo}
            onEdit={handleStatusEdit}
            onDelete={handleStatusDelete}
            onPrint={handleStatusPrint}
            onDownload={handleStatusDownload}
            onRefresh={handleStatusRefresh}
            honorEligible={latinHonorsEvaluation.eligible}
          />
        </ScrollView>
      );
    }
    return renderWizard();
  };

  return (
    <PaperProvider>
      {renderContent()}
      {/* Location picker modal */}
      <Modal
        transparent
        visible={pickerVisible}
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>
              {pickerType ? `Select ${pickerType.charAt(0).toUpperCase()}${pickerType.slice(1)}` : "Select"}
            </Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {pickerOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.pickerOption}
                  onPress={() => handleSelectOption(option)}
                >
                  <Text style={styles.pickerOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
              {pickerOptions.length === 0 && (
                <View style={styles.pickerOption}>
                  <Text style={styles.pickerOptionText}>No options available</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Latin Honors Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showLatinHonorsModal}
        onRequestClose={() => handleLatinHonorsChoice(false)}
      >
        <View style={styles.latinModalOverlay}>
          <View style={styles.latinModal}>
            <View style={styles.latinModalHeader}>
              <Text style={styles.latinModalTitle}>Apply for Latin Honors?</Text>
              <TouchableOpacity onPress={() => handleLatinHonorsChoice(false)}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.latinModalCard,
                qualifiesForLatinHonors
                  ? styles.latinModalCardSuccess
                  : styles.latinModalCardWarning,
              ]}
            >
              <View style={styles.latinModalBadge}>
                <MaterialIcons
                  name={qualifiesForLatinHonors ? "emoji-events" : "warning"}
                  size={20}
                  color="#1F513F"
                />
                <Text style={styles.latinModalBadgeText}>{honorsBadgeText}</Text>
              </View>
              <Text style={styles.latinModalHighlight}>{honorsHighlightText}</Text>
              <Text style={styles.latinModalMetrics}>
                GWA: {latinHonorsGwa?.gwa ?? "N/A"} • Lowest Grade: {lowestGradeValue}
              </Text>
            </View>
            <Text style={styles.latinModalQuestion}>{honorsQuestionText}</Text>
            <View style={styles.latinModalActions}>
              <TouchableOpacity
                style={[styles.latinModalButton, styles.latinModalButtonGhost]}
                onPress={() => handleLatinHonorsChoice(false)}
              >
                <Text style={styles.latinModalButtonGhostText}>No, thanks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.latinModalButton,
                  styles.latinModalButtonPrimary,
                  !qualifiesForLatinHonors && { opacity: 0.6 },
                ]}
                onPress={() => handleLatinHonorsChoice(true)}
                disabled={!qualifiesForLatinHonors}
              >
                <Text style={styles.latinModalButtonPrimaryText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Consent Form Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={showConsentModal}
        onRequestClose={() => setShowConsentModal(false)}
      >
        <View style={styles.consentModalOverlay}>
          <View style={styles.consentModal}>
            <View style={styles.consentModalHeader}>
              <Text style={styles.consentModalTitle}>
                Consent Form for the Evaluation of Academic Records
              </Text>
              <TouchableOpacity onPress={() => setShowConsentModal(false)}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
            {consentPdfUri ? (
              <View style={styles.consentPdfWrapper}>
                <Pdf
                  source={{ uri: consentPdfUri }}
                  style={styles.consentPdf}
                  onError={(error) => console.warn("Consent PDF error:", error)}
                />
              </View>
            ) : (
              <View style={styles.consentEmpty}>
                <Text style={styles.consentEmptyText}>Generating consent form...</Text>
              </View>
            )}
            <View style={styles.consentActions}>
              <TouchableOpacity
                style={[styles.latinModalButton, styles.latinModalButtonPrimary]}
                onPress={() => setShowConsentModal(false)}
              >
                <Text style={styles.latinModalButtonPrimaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Edit Requirements Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={editRequirementsVisible}
        onRequestClose={() => setEditRequirementsVisible(false)}
      >
        <View style={styles.latinModalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Graduation Requirements</Text>
              <TouchableOpacity onPress={() => setEditRequirementsVisible(false)}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {EDIT_REQUIREMENT_FIELDS.map((field) => {
                const fieldState = editRequirementsForm[field.key] || { fileName: "", uri: "" };
                const existingValue =
                  graduationStatusData?.graduation_requirements?.[field.dbKey] ||
                  graduationStatusData?.graduation_requirements?.[field.key];
                return (
                  <View key={field.key} style={styles.editField}>
                    <Text style={styles.editLabel}>{field.label}</Text>
                    <View style={styles.editUploadRow}>
                      <TouchableOpacity
                        style={styles.editUploadButton}
                        onPress={() => handleEditRequirementPick(field.key)}
                      >
                        <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                        <Text style={styles.editUploadButtonText}>Choose File</Text>
                      </TouchableOpacity>
                      <Text style={styles.editFileName}>
                        {fieldState.fileName || "No file chosen"}
                      </Text>
                    </View>
                    {existingValue ? (
                      <Text style={styles.existingFileNote}>Already uploaded</Text>
                    ) : null}
                  </View>
                );
              })}
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Remarks (Optional)</Text>
                <TextInput
                  style={[styles.editInput, styles.editTextarea]}
                  value={editRequirementsForm.remarks}
                  onChangeText={(text) =>
                    setEditRequirementsForm((prev) => ({ ...prev, remarks: text }))
                  }
                  placeholder="Add any notes or comments."
                  multiline
                />
              </View>
            </ScrollView>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.latinModalButton, styles.latinModalButtonGhost]}
                onPress={() => setEditRequirementsVisible(false)}
                disabled={editRequirementsSaving}
              >
                <Text style={styles.latinModalButtonGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.latinModalButton,
                  styles.latinModalButtonPrimary,
                  editRequirementsSaving && { opacity: 0.6 },
                ]}
                onPress={handleSaveRequirementsEdit}
                disabled={editRequirementsSaving}
              >
                <Text style={styles.latinModalButtonPrimaryText}>
                  {editRequirementsSaving ? "Saving..." : "Save Requirements"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Birthdate picker modal */}
      <Modal
        transparent
        visible={showBirthPicker}
        animationType="fade"
        onRequestClose={cancelBirthdate}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Select Birthdate</Text>
            <DatePicker
              key={`birth-${birthPickerKey}`}
              date={tempBirthDate}
              mode="date"
              androidVariant="nativeAndroid"
              onDateChange={setTempBirthDate}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
              <TouchableOpacity onPress={cancelBirthdate}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  updateField("birthDate", formatDateMMDDYYYY(tempBirthDate));
                  setShowBirthPicker(false);
                }}
              >
                <Text style={styles.pickerCancelText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  // Graduation Evaluation Styles
  header: {
    backgroundColor: '#fff',
    padding: 16,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  statusHeader: {
    marginBottom: 16,
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusText: {
    color: '#1976D2',
    fontWeight: '500',
  },
  statusSubtext: {
    color: '#666',
    fontSize: 14,
  },
  eligibilityContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  eligibilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  eligibilityText: {
    marginLeft: 8,
    color: '#333',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  summarySubtext: {
    fontSize: 10,
    color: '#999',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  missingCoursesContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  missingCourseCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
  },
  missingCourseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  missingCourseCode: {
    fontWeight: 'bold',
    marginRight: 8,
    color: '#333',
  },
  missingCourseTitle: {
    flex: 1,
    color: '#333',
  },
  missingCourseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  missingCourseDetail: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 12,
    color: '#666',
  },
  missingCourseStatus: {
    fontWeight: '500',
  },
  noMissingCourses: {
    color: '#4CAF50',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  completedCoursesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  completedCoursesList: {
    flex: 1,
  },
  completedCourseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  courseCheckIcon: {
    marginRight: 8,
  },
  completedCourseCode: {
    fontWeight: '500',
    color: '#333',
    width: 60,
  },
  completedCourseTitle: {
    flex: 1,
    color: '#666',
    paddingRight: 10,
  },
  courseGrade: {
    fontWeight: 'bold',
    color: '#DC143C',
    width: 40,
    textAlign: 'right',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    margin: 10,
  },
  errorText: {
    color: '#B71C1C',
    textAlign: 'center',
  },
  noCoursesText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontStyle: 'italic',
  },
  // PDF Preview styles
  pdfPreview: {
    width: '100%',
    height: 500,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  
  // Original styles
  container: { padding: 16, paddingBottom: 40, backgroundColor: "#f6f6f6" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700" },
  gradeList: { marginTop: 12, gap: 12 },
  gradeTableCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  gradeTableHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  gradeTableTitle: { fontSize: 16, fontWeight: "700", color: "#C2185B" },
  gradeTableSubtitle: { fontSize: 13, color: "#555", marginTop: 2 },
  gradeTableMetaRight: { alignItems: "flex-end" },
  gradeTableMetaText: { fontSize: 12, color: "#666", fontWeight: "600" },
  gradeDetailTableContainer: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    backgroundColor: "#fff",
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  gradeDetailHorizontalContent: {
    minWidth: "100%",
  },
  gradeDetailTable: {
    minWidth: "100%",
    backgroundColor: "#fff",
  },
  gradeDetailRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
  },
  gradeDetailHeaderRow: {
    backgroundColor: "#DC143C",
  },
  gradeDetailHeaderText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  gradeDetailCell: {
    justifyContent: "center",
  },
  gradeDetailCellText: {
    fontSize: 12,
    color: "#374151",
    textAlign: "center",
    paddingHorizontal: 6,
  },
  gradeDetailVerticalScroll: {
    maxHeight: 320,
  },
  gradeRowEven: { backgroundColor: "#f8f9fa" },
  gradeRowOdd: { backgroundColor: "#fff" },
  codeColumnWide: { width: 110, alignItems: "flex-start" },
  remarksColumnWide: { width: 120 },
  gradeColumnWide: { width: 80 },
  sectionColumnWide: { width: 110 },
  instructorColumnWide: { width: 200, alignItems: "flex-start" },
  gradeTableWrapper: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  gradeTableRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#fff",
  },
  gradeTableHeadRow: {
    backgroundColor: "#FAD0D8",
  },
  gradeTableRowAlt: {
    backgroundColor: "#fdf6f6",
  },
  gradeTableCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    justifyContent: "center",
  },
  gradeTableCellCourse: { flex: 1.4 },
  gradeTableCellRemarks: { flex: 0.9 },
  gradeTableCellGrade: { flex: 0.7, alignItems: "center" },
  gradeTableCellSection: { flex: 0.9 },
  gradeTableCellInstructor: { flex: 1.3, borderRightWidth: 0 },
  gradeCourseSubLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  tableTextSuccess: { color: "#15803d", fontWeight: "700" },
  tableTextDanger: { color: "#b91c1c", fontWeight: "700" },
  tableTextNeutral: { color: "#555", fontWeight: "600" },
  gradeSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  gradeSummaryCard: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#f4f5f7",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  summaryLabel: { color: "#555", fontSize: 13, fontWeight: "600" },
  summaryValue: { fontSize: 20, fontWeight: "700", marginTop: 4, color: "#111" },
  summaryAccentPrimary: { backgroundColor: "#fde7ea" },
  summaryAccentSuccess: { backgroundColor: "#e7f7ef" },
  summaryAccentWarning: { backgroundColor: "#fff7e6" },
  summaryAccentDanger: { backgroundColor: "#ffecec" },
  mobileInfoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 12,
    gap: 6,
  },
  infoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  infoLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "700" },
  gradeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  loadRecordsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DC143C",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  loadRecordsButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  recordsFooterNote: {
    marginTop: 12,
    fontSize: 12,
    color: "#4b5563",
    fontStyle: "italic",
  },
  gradeCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  gradeCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  gradeCourseCode: { fontSize: 17, fontWeight: "700", color: "#DC143C", letterSpacing: 0.5 },
  gradeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  gradeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#f4f5f7",
    color: "#555",
    fontSize: 12,
    fontWeight: "600",
  },
  gradeValuePill: {
    borderRadius: 14,
    backgroundColor: "#fff0f3",
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#ffe1e7",
  },
  gradeValuePillText: { fontSize: 18, fontWeight: "700", color: "#C2185B" },
  gradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  gradeBadgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  badgeSuccess: { backgroundColor: "#22c55e" },
  badgeDanger: { backgroundColor: "#ef4444" },
  badgeNeutral: { backgroundColor: "#9ca3af" },
  gradeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 10,
  },
  gradeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8f9fb",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  gradeMetaValueText: { color: "#444", fontWeight: "600", fontSize: 13 },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 12,
    gap: 12,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  termCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginHorizontal: -2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  termTitle: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 8 },
  termHeader: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  termMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  termMetaText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
  },
  overallCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  overallTitle: { fontSize: 14, fontWeight: "700", color: "#1f2937" },
  overallValue: { fontSize: 22, fontWeight: "800", color: "#111827" },
  overallMeta: { fontSize: 12, color: "#4b5563", fontWeight: "600" },
  studentInfoPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    overflow: "hidden",
    marginTop: 10,
  },
  studentInfoHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1d4ed8",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  studentInfoHeaderText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  studentInfoContent: { padding: 12, gap: 8 },
  studentInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  studentInfoItem: {
    flex: 1,
    minWidth: 140,
  },
  generatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  generatedText: { fontSize: 12, color: "#4b5563", fontWeight: "600" },
  termFooterText: {
    marginTop: 8,
    fontSize: 12,
    color: "#555",
    textAlign: "right",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  progressContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  stepContainer: { alignItems: "center", width: "15%" },
  circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#ccc", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  activeCircle: { borderColor: "#DC143C", backgroundColor: "#DC143C" },
  stepNumber: { color: "#666", fontWeight: "600" },
  activeStepNumber: { color: "#fff" },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  requirementsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#DC143C',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
    lineHeight: 20,
  },
  text: { color: "#555", lineHeight: 20 },
  sectionHeader: { fontSize: 16, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  inputLabel: { fontWeight: "600", marginTop: 10, marginBottom: 4, textTransform: "capitalize" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fafafa", marginBottom: 10 },
  inputFilled: { borderColor: "#16a34a" },
  inputEmpty: { borderColor: "#facc15" },
  selectBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#fafafa",
    marginBottom: 10,
  },
  selectBoxContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 14,
    color: "#333",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontSize: 14,
    color: "#111",
  },
  placeholderText: {
    fontSize: 14,
    color: PLACEHOLDER_COLOR,
  },
  gradRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  submitButton: { backgroundColor: "#DC143C", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 12 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  inputRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  inputCol: { flex: 1, minWidth: 160 },
  fullWidthField: { marginTop: 12 },
  navigation: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  navButton: { padding: 12, borderRadius: 8, backgroundColor: "#ddd", minWidth: 100, alignItems: "center" },
  navButtonPrimary: { padding: 12, borderRadius: 8, backgroundColor: "#DC143C", minWidth: 100, alignItems: "center" },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DC143C",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  uploadButtonText: { color: "#fff", fontWeight: "700" },
  navButtonText: { color: "#333", fontWeight: "600" },
  navButtonTextPrimary: { color: "#fff", fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  cardText: { fontSize: 14, lineHeight: 20 },
  list: { marginTop: 6 },
  listItem: { fontSize: 14, lineHeight: 20, marginBottom: 2 },
  signature: { fontStyle: "italic", marginTop: 12, color: "#555" },
  
  // Mobile-friendly course data styles
  courseInfoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#DC143C", 
    marginBottom: 8,
    marginTop: 8,
  },
  compactInfoSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compactInfoText: { 
    fontSize: 13, 
    color: "#333", 
    marginBottom: 4, 
    lineHeight: 18,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  coursesSection: {
    marginTop: 8,
  },
  
  // Mobile table styles
  mobileTable: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#DC143C",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  tableBody: {
    backgroundColor: "#fff",
  },
  mobileTableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    minHeight: 44,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#f8f9fa",
  },
  tableRowOdd: {
    backgroundColor: "#ffffff",
  },
  tableCellText: {
    fontSize: 12,
    color: "#333",
    paddingHorizontal: 2,
  },
  courseCodeCell: {
    fontWeight: "700",
    color: "#DC143C",
    textAlign: "center",
  },
  courseTitleCell: {
    textAlign: "left",
    lineHeight: 16,
  },
  unitCell: {
    textAlign: "center",
    fontWeight: "600",
    color: "#DC143C",
  },
  noDataText: { 
    fontSize: 14, 
    color: "#999", 
    fontStyle: "italic", 
    textAlign: "center", 
    marginTop: 20,
    padding: 20,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111",
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  pickerOptionText: {
    fontSize: 14,
    color: "#333",
  },
  pickerCancel: {
    marginTop: 12,
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickerCancelText: {
    color: "#DC143C",
    fontWeight: "700",
    fontSize: 14,
  },
  latinModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  latinModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  latinModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  latinModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  latinModalCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  latinModalCardSuccess: {
    backgroundColor: "#d1f5e5",
    borderWidth: 1,
    borderColor: "#9ed9c2",
  },
  latinModalCardWarning: {
    backgroundColor: "#fff7e0",
    borderWidth: 1,
    borderColor: "#f2d27c",
  },
  latinModalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  latinModalBadgeText: {
    fontWeight: "600",
    color: "#1F513F",
  },
  latinModalHighlight: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F513F",
    marginTop: 8,
  },
  latinModalMetrics: {
    marginTop: 4,
    color: "#333",
    fontSize: 12,
    fontWeight: "600",
  },
  latinModalQuestion: {
    marginTop: 18,
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  latinModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  latinModalButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  latinModalButtonGhost: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  latinModalButtonGhostText: {
    color: "#444",
    fontWeight: "600",
  },
  latinModalButtonPrimary: {
    backgroundColor: "#2563eb",
  },
  latinModalButtonPrimaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  statusScreen: {
    flex: 1,
    backgroundColor: "#f6f6f6",
    padding: 16,
  },
  statusHeaderCard: {
    backgroundColor: "#991b1b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusHeaderTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  statusHeaderSubtitle: {
    color: "#fcd34d",
    marginTop: 6,
    fontSize: 13,
  },
  refreshBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  refreshBadgeText: {
    color: "#1d4ed8",
    fontWeight: "600",
  },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 16,
  },
  statusTableWrapper: {
    marginTop: 8,
  },
  statusSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1f2937",
  },
  statusTable: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statusRowHeader: {
    backgroundColor: "#eff6ff",
  },
  statusCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    textAlign: "center",
    fontSize: 12,
    color: "#1f2937",
    flexShrink: 0,
  },
  cellNumber: { width: 40 },
  cellSR: { width: 90 },
  cellName: { flex: 1, textAlign: "left" },
  cellStatus: { width: 120, fontWeight: "600", color: "#15803d" },
  cellRequirement: { width: 90 },
  cellActions: {
    width: 140,
    borderRightWidth: 0,
  },
  statusIndicator: {
    fontWeight: "700",
    fontSize: 14,
  },
  statusIndicatorYes: {
    color: "#16a34a",
  },
  statusIndicatorNo: {
    color: "#dc2626",
  },
  statusLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#f9fafb",
  },
  legendItem: {
    fontSize: 12,
    color: "#4b5563",
  },
  tableActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  tableActionText: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 12,
  },
  tableActionDanger: {
    marginTop: 4,
  },
  applicationDetailsCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  applicationDetailsTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1f2937",
  },
  applicationInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  applicationInfoItem: {
    flex: 1,
  },
  applicationInfoLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  applicationInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  statusActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
    marginTop: 16,
    marginBottom: 30,
  },
  consentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  consentModal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  consentModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  consentModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  consentPdfWrapper: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
    height: 420,
    marginBottom: 16,
  },
  consentPdf: {
    flex: 1,
  },
  consentEmpty: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  consentEmptyText: {
    color: "#555",
  },
  consentActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  editModal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  editField: {
    marginBottom: 12,
  },
  editLabel: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 6,
    fontWeight: "600",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  editTextarea: {
    height: 100,
    textAlignVertical: "top",
  },
  existingFileNote: {
    fontSize: 11,
    color: "#16a34a",
    marginTop: 4,
  },
  editUploadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  editUploadButton: {
    backgroundColor: "#a80909ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editUploadButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  editFileName: {
    flex: 1,
    fontSize: 12,
    color: "#374151",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
    pdfViewerBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
    pdfViewerTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: "#111827",
      marginBottom: 8,
    },
    pdfViewerFrame: {
      height: 400,          // adjust as needed
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#d1d5db",
      backgroundColor: "#f3f4f6",
    },
    hidePdfButton: {
      marginTop: 10,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: "#DC143C",
      alignItems: "center",
    },
  hidePdfText: {
    color: "#fff",
    fontWeight: "700",
  },
  requirementsUploadSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
  },
  requirementCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
    marginHorizontal: 6,
  },
  requirementHeader: {
    marginBottom: 12,
  },
  requirementTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  requiredAsterisk: {
    color: "#DC143C",
  },
  requirementHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  requirementFileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  requirementUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC143C",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  requirementUploadText: {
    color: "#fff",
    fontWeight: "600",
  },
  requirementFileName: {
    flex: 1,
    color: "#555",
    fontStyle: "italic",
  },
  requirementFollowRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  requirementFollowText: {
    color: "#333",
    fontWeight: "500",
  },
});
