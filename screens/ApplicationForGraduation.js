import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { Checkbox, Provider as PaperProvider } from "react-native-paper";
import { OCR_SERVER_CONFIG } from "../config/serverConfig";
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
      // 1. Load the template PDF from assets
      const asset = Asset.fromModule(
        require("../assets/ApplicationForGraduation_template.pdf")
      );
      await asset.downloadAsync();

      const existingPdfBytes = await fetch(asset.uri).then((res) =>
        res.arrayBuffer()
      );

      // 2. Load PDF in pdf-lib
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const page = pages[0];
      const { width, height } = page.getSize();

      // 3. Embed font
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

      // ========== OPTIONAL DEBUG GRID ==========
      const SHOW_DEBUG_GRID = false;
      if (SHOW_DEBUG_GRID) {
        for (let y = 0; y < height; y += 50) {
          page.drawLine({
            start: { x: 0, y },
            end: { x: width, y },
            thickness: 0.3,
            color: rgb(0.8, 0.2, 0.2),
          });
          page.drawText(`${y}`, {
            x: 5,
            y: y + 2,
            size: 6,
            font,
            color: rgb(0.8, 0.2, 0.2),
          });
        }
        for (let x = 0; x < width; x += 50) {
          page.drawLine({
            start: { x, y: 0 },
            end: { x, y: height },
            thickness: 0.3,
            color: rgb(0.2, 0.2, 0.8),
          });
          page.drawText(`${x}`, {
            x: x + 2,
            y: 5,
            size: 6,
            font,
            color: rgb(0.2, 0.2, 0.8),
          });
        }
      }

      // ========== FIELD MAPPING (adjusted down) ==========

      // NAME ROW: SURNAME / FIRST / MIDDLE / EXT
      // dating height - 145 → binaba natin (mas malaki ang minus = mas baba sa papel)
      const nameRowY = height - 155;
      draw(values.surname,       80,  nameRowY);  // SURNAME
      draw(values.firstName,     230, nameRowY);  // FIRST NAME
      draw(values.middleName,    370, nameRowY);  // MIDDLE NAME
      draw(values.extensionName, 520, nameRowY);  // EXTENSION

      // BIRTHDATE / PLACE OF BIRTH / SR CODE
      const birthRowY = height - 178;             // (was 165, mas baba na)
      draw(values.srCode,       110, birthRowY);  // SR CODE
      draw(values.birthDate,    270, birthRowY);  // BIRTHDATE
      draw(values.placeOfBirth, 460, birthRowY);  // PLACE OF BIRTH

      // HOME ADDRESS (house/street + barangay + city + province)
      const homeAddressLine = [
        values.address,
        values.barangay,
        values.city,
        values.province,
      ]
        .filter(Boolean)
        .join(", ");

      const homeAddrY = height - 210;             // (was 185)
      draw(homeAddressLine, 85, homeAddrY);      // HOME ADDRESS

      // ZIP / CONTACT / EMAIL
      const zipContactRowY = height - 220;        // (was 205)
      draw(values.zipCode,       120, zipContactRowY); // ZIP CODE
      draw(values.contactNumber, 260, zipContactRowY); // CONTACT NUMBER

      const emailRowY = height - 240;             // hiwalay na row para di sumampa sa label
      draw(values.emailAddress,  160, emailRowY);      // EMAIL ADDRESS

      // SECONDARY SCHOOL + YEAR
      const secondaryRowY = height - 260;         // (was 235)
      draw(values.secondarySchool, 150, secondaryRowY);
      draw(values.secondaryYear,   width - 120, secondaryRowY);

      // ELEMENTARY SCHOOL + YEAR
      const elemRowY = height - 280;             // (was 255)
      draw(values.elementarySchool, 150, elemRowY);
      draw(values.elementaryYear,   width - 120, elemRowY);

      // COLLEGE / PROGRAM / MAJOR
      const collegeRowY = height - 305;          // (was 285)
      draw(values.college, 150, collegeRowY);

      const programRowY = height - 325;          // (was 305)
      draw(values.program, 150, programRowY);

      const majorRowY = height - 345;            // (was 325)
      draw(values.major,  150, majorRowY);

      // DATE OF GRADUATION (DECEMBER / MAY / MIDTERM)
      const gradRowY = height - 370;             // (was 355)
      if (values.gradDecemberChecked && values.gradDecemberYear) {
        draw(values.gradDecemberYear, 165, gradRowY); // DECEMBER box
      }
      if (values.gradMayChecked && values.gradMayYear) {
        draw(values.gradMayYear, 315, gradRowY);      // MAY box
      }
      if (values.gradMidtermChecked && values.gradMidtermYear) {
        draw(values.gradMidtermYear, 465, gradRowY);  // MIDTERM box
      }

      // OPTIONAL: Requested by / target year kung meron ka sa form state
      if (values.requestedBy) {
        draw(values.requestedBy, 150, height - 405);
      }
      if (values.targetGradYear) {
        draw(values.targetGradYear, 150, height - 420);
      }

      // ========== SAVE TO FILE ==========
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
      if (parsedData) setCourseData(parsedData);
      Alert.alert("Uploaded", "COR uploaded and processed.");
    } catch (error) {
      Alert.alert("Upload failed", error.message || "Unable to process COR file.");
    } finally {
      setOcrLoading(false);
    }
  };

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

          {/* STEP 2 - Upload COR */}
          {currentStep === 2 && (
            <View>
              <Text style={styles.stepTitle}>Step 2: Upload Certificate of Registration (COR)</Text>
              <Text style={styles.text}>
                Upload your current COR (PDF). Make sure it is clear, complete, and follows the filename format
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
                  <TouchableOpacity
                    style={[
                      styles.refreshCTA,
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
                    <Text style={styles.refreshCTAtext}>Load My Academic Records</Text>
                  </TouchableOpacity>
                </View>
              )}

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
                    <TouchableOpacity
                      style={[styles.refreshCTA, (!studentId || gradeLoading) && styles.refreshButtonDisabled]}
                      onPress={() => {
                        if (!studentId) return;
                        setGradeReport(null);
                        fetchGradeReport(studentId, { fromRefresh: true });
                      }}
                      disabled={!studentId || gradeLoading}
                    >
                      <Ionicons name="refresh" size={18} color="#fff" />
                      <Text style={styles.refreshCTAtext}>Refresh Academic Records</Text>
                    </TouchableOpacity>
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
                    <Text style={styles.overallValue}>{overallGwa.gwa}</Text>
                    <Text style={styles.overallMeta}>
                      Subjects: {overallGwa.count} • Total Units: {overallGwa.totalUnits || "N/A"}
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
                    style={styles.input}
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
                    style={styles.input}
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
                    style={styles.input}
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
                    style={styles.input}
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
                    style={styles.input}
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
                    <View style={[styles.input, styles.dateInput]}>
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
                    style={styles.input}
                    placeholder="e.g., Nasugbu, Batangas"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.placeOfBirth}
                    onChangeText={(v) => updateField("placeOfBirth", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Contact Number</Text>
                  <TextInput
                    style={styles.input}
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
                  style={styles.input}
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
                    style={styles.input}
                    placeholder="e.g., None / Name of grant"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.scholarshipGrant}
                    onChangeText={(v) => updateField("scholarshipGrant", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Parent 1 (Full Name)</Text>
                  <TextInput
                    style={styles.input}
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
                    style={styles.input}
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
                    style={styles.input}
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
                    style={styles.input}
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
                  <TouchableOpacity style={styles.selectBox} onPress={() => showPicker("region")}>
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
                  <TouchableOpacity style={styles.selectBox} onPress={() => showPicker("province")}>
                    <View style={styles.selectBoxContent}>
                      <Text style={styles.selectText}>{form.province || "Select province"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>City/Municipality</Text>
                  <TouchableOpacity style={styles.selectBox} onPress={() => showPicker("city")}>
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
                  <TouchableOpacity style={styles.selectBox} onPress={() => showPicker("barangay")}>
                    <View style={styles.selectBoxContent}>
                      <Text style={styles.selectText}>{form.barangay || "Select barangay"}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>ZIP Code</Text>
                  <TextInput
                    style={styles.input}
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
                  style={styles.input}
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
                    style={styles.input}
                    placeholder="e.g., ABC High School"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.secondarySchool}
                    onChangeText={(v) => updateField("secondarySchool", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Year Graduated</Text>
                  <TextInput
                    style={styles.input}
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
                    style={styles.input}
                    placeholder="e.g., ABC Elementary School"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={form.elementarySchool}
                    onChangeText={(v) => updateField("elementarySchool", v)}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Year Graduated</Text>
                  <TextInput
                    style={styles.input}
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
                    style={styles.input}
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
                    style={styles.input}
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
                        style={[styles.input, { flex: 1 }]}
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
                        style={[styles.input, { flex: 1 }]}
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
                        style={[styles.input, { flex: 1 }]}
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
                    style={styles.input}
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
});