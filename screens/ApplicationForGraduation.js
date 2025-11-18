import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { OCR_SERVER_CONFIG } from '../config/serverConfig';
import PdfUploader from "../components/PdfUploader";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../config/api";
import { Checkbox, Provider as PaperProvider } from "react-native-paper";

// Backend OCR function for PDF (COR) - extracts parsed fields + raw text
const runOCRBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "upload.pdf",
      type: "application/pdf",
    });

    const response = await fetch(OCR_SERVER_CONFIG.getEndpointURL(OCR_SERVER_CONFIG.ENDPOINTS.OCR), {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `OCR failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.raw_text || "No text detected";
  } catch (err) {
    console.error("runOCRBackend error:", err);
    throw err;
  }
};

// Backend OCR function for full text extraction from all pages
const runFullOCRBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "upload.pdf",
      type: "application/pdf",
    });

    const response = await fetch(OCR_SERVER_CONFIG.getEndpointURL(OCR_SERVER_CONFIG.ENDPOINTS.OCR_FULL), {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Full OCR failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.full_text || "No text detected";
  } catch (err) {
    console.error("runFullOCRBackend error:", err);
    throw err;
  }
};

// Backend OCR function for positioned text extraction (preserves layout)
const runPositionedOCRBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "upload.pdf",
      type: "application/pdf",
    });

    const response = await fetch(OCR_SERVER_CONFIG.getEndpointURL(OCR_SERVER_CONFIG.ENDPOINTS.OCR_POSITIONED), {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Positioned OCR failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.full_text || "No text detected";
  } catch (err) {
    console.error("runPositionedOCRBackend error:", err);
    throw err;
  }
};

// Backend function for direct PDF text extraction (no image conversion)
const runDirectPDFBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "upload.pdf",
      type: "application/pdf",
    });

    const response = await fetch(OCR_SERVER_CONFIG.getEndpointURL(OCR_SERVER_CONFIG.ENDPOINTS.OCR_DIRECT), {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Direct PDF extraction failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.full_text || "No text detected";
  } catch (err) {
    console.error("runDirectPDFBackend error:", err);
    throw err;
  }
};

// Validate COR filename format
const validateCORFilename = (fileName) => {
  // Expected format: Lastname_Firstname_COR.pdf
  const corPattern = /^[A-Za-z]+_[A-Za-z]+_COR\.pdf$/i;
  return corPattern.test(fileName);
};

// File picker specifically for Step 2 (COR)
const pickCORFile = async (setCoe, setOcrText, setOcrLoading, setCourseData) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    if (result.type === "cancel") return;

    const file = result.assets ? result.assets[0] : result;
    if (!file.uri) throw new Error("No file URI returned from picker");

    const fileUri = file.uri;
    const fileName = file.name || "document.pdf";

    // Validate file extension
    const fileExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';
    
    if (fileExtension !== 'pdf') {
      Alert.alert(
        "Invalid File Format", 
        "Accepted format: PDF only\nMake sure the file is clear, complete, and official\nExample filename: Lastname_Firstname_COR.pdf"
      );
      return;
    }

    // Validate COR filename format
    if (!validateCORFilename(fileName)) {
      Alert.alert(
        "Invalid Filename Format", 
        "Please rename your file to follow this format:\nLastname_Firstname_COR.pdf\n\nExample: Smith_John_COR.pdf\n\nMake sure the file is clear, complete, and official."
      );
      return;
    }

    const newPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: fileUri,
      to: newPath,
    });

    setCoe(newPath);
    setOcrText("");
    setOcrLoading(true);

    try {
      const text = await runDirectPDFBackend(newPath);
      setOcrText(text);
      
      // Parse the OCR text to extract course data
      const parsedData = parseCourseData(text);
      setCourseData(parsedData);
    } catch (error) {
      console.error("OCR extraction error:", error);
      Alert.alert("OCR Error", error.message || "Failed to extract text from COR. Please ensure the OCR server is running.");
      setOcrText("");
    } finally {
      setOcrLoading(false);
    }

    Alert.alert("Success", `${fileName} uploaded successfully!`);
  } catch (error) {
    console.error("File picker error:", error);
    Alert.alert("Error", error.message || "Failed to pick file.");
  }
};

// Function to fix course title spacing
const fixCourseTitle = (title) => {
  // Remove extra spaces first
  title = title.replace(/\s+/g, ' ').trim();
  
  // Add space before capital letters that follow lowercase letters
  title = title.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Add space before numbers that follow letters
  title = title.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  
  // Add space after numbers that are followed by letters
  title = title.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  
  // Fix common OCR issues
  const replacements = {
    'AnalyticsApplication': 'Analytics Application',
    'SocialIssues': 'Social Issues',
    'andProfessional': 'and Professional',
    'ProfessionalPractice': 'Professional Practice',
    'QualityAssurance': 'Quality Assurance',
    'InformationAssurance': 'Information Assurance',
    'andSecurity': 'and Security',
    'PlatformTechnologies': 'Platform Technologies',
    'CapstoneProject': 'Capstone Project',
    'DatabaseManagement': 'Database Management',
    'ManagementSystem': 'Management System',
    'ComputerNetworking': 'Computer Networking',
    'DataAnalysis': 'Data Analysis',
    'TeamSports': 'Team Sports',
    'EnvironmentalSciences': 'Environmental Sciences'
  };
  
  for (const [old, replacement] of Object.entries(replacements)) {
    title = title.replace(new RegExp(old, 'gi'), replacement);
  }
  
  // Clean up multiple spaces
  return title.replace(/\s+/g, ' ').trim();
};

// Function to parse course enrollment data from OCR text
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

const formatSemesterLabel = (semester) => {
  if (!semester) return "N/A";
  return semester.toString().trim().toUpperCase();
};

const parseCourseData = (ocrText) => {
  try {
    const lines = ocrText.split('\n');
    const courseData = {
      studentInfo: {},
      courses: [],
      semester: '',
      academicYear: '',
      totalUnits: 0
    };

    // Extract student information and semester/year
    for (const line of lines) {
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
  const hasFetchedGradesRef = useRef(false);
  const [attachments, setAttachments] = useState([]);
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");

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

  const [form, setForm] = useState({
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

  const steps = [
    "Guidelines",
    "Upload COR",
    "Upload Grades",
    "Application Form",
    "Validation & Info",
    "Review & Submit",
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
      } catch (error) {
        console.warn("Failed to resolve student ID:", error);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setForm(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to load saved form:", e);
      }
    })();
  }, []);

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

      setGradeReport(data.grades || []);
    } catch (error) {
      if (!fromRefresh) {
        hasFetchedGradesRef.current = false;
      }
      setGradeError(error.message || "Unable to fetch grades.");
    } finally {
      setGradeLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 3 && studentId && !hasFetchedGradesRef.current) {
      hasFetchedGradesRef.current = true;
      fetchGradeReport(studentId);
    }
  }, [currentStep, studentId]);

  const nextStep = () =>
    setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
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

  return (
    <PaperProvider>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Application for Graduation</Text>

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
                    • Upload required documents including Final Grades and
                    Certificate of Current Enrollment (COR);
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

          {/* STEP 2 - Upload COR */}
          {currentStep === 2 && (
            <View>
              <Text style={styles.stepTitle}>
                Step 2: Upload Certificate of Current Enrollment (COR)
              </Text>
              
              {/* File Requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>File Requirements:</Text>
                <Text style={styles.requirementText}>• Accepted format: PDF only</Text>
                <Text style={styles.requirementText}>• Make sure the file is clear, complete, and official</Text>
                <Text style={styles.requirementText}>• Example filename: Lastname_Firstname_COR.pdf</Text>
              </View>
              
              <PdfUploader
                label="Certificate of Current Enrollment (COR)"
                fileUri={coe}
                onPickFile={() => pickCORFile(setCoe, setOcrText, setOcrLoading, setCourseData)}
                webviewHeight={400}
              />

              {ocrLoading && (
                <View style={{ marginTop: 12, alignItems: "center" }}>
                  <ActivityIndicator size="large" color="#DC143C" />
                  <Text style={{ marginTop: 8, color: "#555" }}>
                    Extracting text...
                  </Text>
                </View>
              )}

              {courseData && !ocrLoading && (
                <View style={styles.courseInfoCard}>
                  <Text style={styles.cardTitle}>Course Enrollment Information</Text>
                  
                  {/* Student Information - Compact */}
                  {courseData.studentInfo && (
                    <View style={styles.compactInfoSection}>
                      <Text style={styles.sectionTitle}>Student Information</Text>
                      <View style={styles.infoGrid}>
                        {courseData.studentInfo.name && (
                          <Text style={styles.compactInfoText}>👤 {courseData.studentInfo.name}</Text>
                        )}
                        {courseData.studentInfo.srCode && (
                          <Text style={styles.compactInfoText}>🆔 {courseData.studentInfo.srCode}</Text>
                        )}
                      </View>
                      {courseData.studentInfo.program && (
                        <Text style={styles.compactInfoText}>🎓 {courseData.studentInfo.program}</Text>
                      )}
                    </View>
                  )}

                  {/* Semester and Academic Year - Compact */}
                  {(courseData.semester || courseData.academicYear) && (
                    <View style={styles.compactInfoSection}>
                      <Text style={styles.sectionTitle}>Enrollment Period</Text>
                      <View style={styles.infoGrid}>
                        {courseData.semester && (
                          <Text style={styles.compactInfoText}>📅 {courseData.semester}</Text>
                        )}
                        {courseData.academicYear && (
                          <Text style={styles.compactInfoText}>📚 {courseData.academicYear}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Courses Table - Mobile Optimized */}
                  {courseData.courses && courseData.courses.length > 0 && (
                    <View style={styles.coursesSection}>
                      <Text style={styles.sectionTitle}>Courses ({courseData.courses.length} courses, {courseData.totalUnits} units)</Text>
                      
                      {/* Mobile-Friendly Table */}
                      <View style={styles.mobileTable}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Code</Text>
                          <Text style={[styles.tableHeaderText, { flex: 2.5 }]}>Course Title</Text>
                          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Units</Text>
                        </View>
                        
                        {/* Table Rows */}
                        <View style={styles.tableBody}>
                          {courseData.courses.map((course, index) => (
                            <View key={index} style={[styles.mobileTableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                              <Text style={[styles.tableCellText, styles.courseCodeCell, { flex: 1.2 }]}>{course.code}</Text>
                              <Text style={[styles.tableCellText, styles.courseTitleCell, { flex: 2.5 }]} numberOfLines={2}>{course.title}</Text>
                              <Text style={[styles.tableCellText, styles.unitCell, { flex: 0.8 }]}>{course.units}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Show message if no courses found */}
                  {(!courseData.courses || courseData.courses.length === 0) && (
                    <Text style={styles.noDataText}>No course information found in the document.</Text>
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

              <View style={styles.gradeHeaderRow}>
                <View>
                  <Text style={styles.gradeMetaLabel}>Student ID</Text>
                  <Text style={styles.gradeMetaValue}>{studentId || "N/A"}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.refreshButton,
                    (!studentId || gradeLoading) && styles.refreshButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!studentId) return;
                    setGradeReport(null);
                    fetchGradeReport(studentId, { fromRefresh: true });
                  }}
                  disabled={!studentId || gradeLoading}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.refreshButtonText}>
                    {gradeLoading ? "Loading" : "Refresh"}
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
                  {gradeStats && (
                    <View style={styles.gradeSummaryRow}>
                      <View style={[styles.gradeSummaryCard, styles.summaryAccentPrimary]}>
                        <Text style={styles.summaryLabel}>Total Records</Text>
                        <Text style={styles.summaryValue}>{gradeStats.total}</Text>
                      </View>
                      <View style={[styles.gradeSummaryCard, styles.summaryAccentSuccess]}>
                        <Text style={styles.summaryLabel}>Passed</Text>
                        <Text style={styles.summaryValue}>{gradeStats.passed}</Text>
                      </View>
                      <View style={[styles.gradeSummaryCard, styles.summaryAccentWarning]}>
                        <Text style={styles.summaryLabel}>Pending</Text>
                        <Text style={styles.summaryValue}>{gradeStats.pending}</Text>
                      </View>
                      <View style={[styles.gradeSummaryCard, styles.summaryAccentDanger]}>
                        <Text style={styles.summaryLabel}>Failed</Text>
                        <Text style={styles.summaryValue}>{gradeStats.failed}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.gradeList}>
                    {groupedGrades.map((group) => (
                      <View key={group.key} style={styles.gradeTableCard}>
                        <View style={styles.gradeTableHeaderRow}>
                          <View>
                            <Text style={styles.gradeTableTitle}>{group.academicYearLabel}</Text>
                            <Text style={styles.gradeTableSubtitle}>{group.semesterLabel}</Text>
                          </View>
                          <View style={styles.gradeTableMetaRight}>
                            <Text style={styles.gradeTableMetaText}>{group.records.length} subject(s)</Text>
                            <Text style={styles.gradeTableMetaText}>
                              Year Level: {group.yearLevelLabel || "N/A"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.gradeDetailTableContainer}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator
                            contentContainerStyle={styles.gradeDetailHorizontalContent}
                          >
                            <View style={styles.gradeDetailTable}>
                              <View style={[styles.gradeDetailRow, styles.gradeDetailHeaderRow]}>
                                <Text style={[styles.gradeDetailHeaderText, styles.codeColumnWide]}>Course Code</Text>
                                <Text style={[styles.gradeDetailHeaderText, styles.remarksColumnWide]}>Remarks</Text>
                                <Text style={[styles.gradeDetailHeaderText, styles.gradeColumnWide]}>Grade</Text>
                                <Text style={[styles.gradeDetailHeaderText, styles.sectionColumnWide]}>Section</Text>
                                <Text style={[styles.gradeDetailHeaderText, styles.instructorColumnWide]}>Instructor</Text>
                              </View>

                              <ScrollView
                                style={styles.gradeDetailVerticalScroll}
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                              >
                                {group.records.map((item, index) => (
                                  <View
                                    key={`${group.key}-${item.course_code}-${index}`}
                                    style={[
                                      styles.gradeDetailRow,
                                      index % 2 === 0 ? styles.gradeRowEven : styles.gradeRowOdd,
                                    ]}
                                  >
                                    <View style={[styles.gradeDetailCell, styles.codeColumnWide]}>
                                      <Text style={styles.gradeDetailCellText}>{item.course_code || "N/A"}</Text>
                                      {item.subject_id ? (
                                        <Text style={styles.gradeCourseSubLabel}>Subject #{item.subject_id}</Text>
                                      ) : null}
                                    </View>
                                    <Text
                                      style={[
                                        styles.gradeDetailCellText,
                                        styles.remarksColumnWide,
                                        (item.remarks || "").toUpperCase() === "PASSED"
                                          ? styles.tableTextSuccess
                                          : (item.remarks || "").toUpperCase() === "FAIL"
                                          ? styles.tableTextDanger
                                          : styles.tableTextNeutral,
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {item.remarks || "Pending"}
                                    </Text>
                                    <Text style={[styles.gradeDetailCellText, styles.gradeColumnWide]}>
                                      {item.grade || "N/A"}
                                    </Text>
                                    <Text style={[styles.gradeDetailCellText, styles.sectionColumnWide]} numberOfLines={1}>
                                      {item.section || "—"}
                                    </Text>
                                    <Text
                                      style={[styles.gradeDetailCellText, styles.instructorColumnWide]}
                                      numberOfLines={2}
                                    >
                                      {item.instructor || "—"}
                                    </Text>
                                  </View>
                                ))}
                              </ScrollView>
                            </View>
                          </ScrollView>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* STEP 4 - Application Form */}
          {currentStep === 4 && (
            <View>
              <Text style={styles.stepTitle}>Step 4: Application Form</Text>
              <Text style={styles.text}>
                Fill out the required fields below accurately.
              </Text>

              {Object.keys(form).map((key) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>{key}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[key]}
                    onChangeText={(value) => updateField(key, value)}
                  />
                </View>
              ))}

              {/* Graduation checkboxes */}
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={form.gradDecemberChecked ? "checked" : "unchecked"}
                  onPress={() => toggleGrad("gradDecemberChecked")}
                  color="#DC143C"
                />
                <Text style={styles.text}>Graduation in December?</Text>
                {form.gradDecemberChecked && (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Year"
                    value={form.gradDecemberYear}
                    onChangeText={(value) =>
                      updateField("gradDecemberYear", value)
                    }
                  />
                )}
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={form.gradMayChecked ? "checked" : "unchecked"}
                  onPress={() => toggleGrad("gradMayChecked")}
                  color="#DC143C"
                />
                <Text style={styles.text}>Graduation in May?</Text>
                {form.gradMayChecked && (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Year"
                    value={form.gradMayYear}
                    onChangeText={(value) => updateField("gradMayYear", value)}
                  />
                )}
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={form.gradMidtermChecked ? "checked" : "unchecked"}
                  onPress={() => toggleGrad("gradMidtermChecked")}
                  color="#DC143C"
                />
                <Text style={styles.text}>Graduation in Midterm?</Text>
                {form.gradMidtermChecked && (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Year"
                    value={form.gradMidtermYear}
                    onChangeText={(value) =>
                      updateField("gradMidtermYear", value)
                    }
                  />
                )}
              </View>
            </View>
          )}

          {/* STEP 5 - Validation & Info */}
          {currentStep === 5 && (
            <View>
              <Text style={styles.stepTitle}>Step 5: Validation & Info</Text>
              <Text style={styles.text}>
                Please provide your guardian information for validation:
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Guardian Name"
                value={guardianName}
                onChangeText={setGuardianName}
              />
              <TextInput
                style={styles.input}
                placeholder="Guardian Contact Number"
                value={guardianContact}
                onChangeText={setGuardianContact}
              />
            </View>
          )}

          {/* STEP 6 - Review & Submit */}
          {currentStep === 6 && (
            <View>
              <Text style={styles.stepTitle}>Step 6: Review & Submit</Text>
              <Text style={styles.text}>
                Please review all your inputs and attachments before submitting.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={() =>
                  Alert.alert("Submitted", "Your application has been submitted.")
                }
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
              ]}
              onPress={nextStep}
              disabled={currentStep === 1 && !step1Consent}
            >
              <Text style={styles.navButtonTextPrimary}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: "#f6f6f6" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
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
    paddingHorizontal: 8,
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
    maxHeight: 260,
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
  gradRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  submitButton: { backgroundColor: "#DC143C", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 12 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  navigation: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  navButton: { padding: 12, borderRadius: 8, backgroundColor: "#ddd", minWidth: 100, alignItems: "center" },
  navButtonPrimary: { padding: 12, borderRadius: 8, backgroundColor: "#DC143C", minWidth: 100, alignItems: "center" },
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
});
