import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  InteractionManager,
  RefreshControl,
} from 'react-native';
// Removed Picker import - using custom dropdown instead
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { OCR_SERVER_CONFIG } from '../config/serverConfig';
import { OCR_URL } from '../config/api';
import { BASE_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pdf from 'react-native-pdf';
import ViewShot from 'react-native-view-shot';

// OCR Backend function for grade extraction
const runGradeOCRBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("pdf", {
      uri: fileUri,
      name: "grades.pdf",
      type: "application/pdf",
    });

    // Use the upload_grade_pdf endpoint (app.py) that handles CRUD + text files
    const ocrEndpoint = `${OCR_URL || OCR_SERVER_CONFIG.BASE_URL}/upload_grade_pdf`;
    console.log('runGradeOCRBackend url', ocrEndpoint);

    const response = await fetch(ocrEndpoint, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.log("runGradeOCRBackend failure", response.status, errorBody);
      const errorData = (() => {
        try {
          return JSON.parse(errorBody);
        } catch (e) {
          return {};
        }
      })();
      throw new Error(errorData.error || `Grade OCR failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("runGradeOCRBackend success", response.status);
    return data.full_text || "No text detected";
  } catch (err) {
    console.error("runGradeOCRBackend error:", err);
    throw err;
  }
};

const fetchServerTextFile = async (filename) => {
  const base = OCR_URL || OCR_SERVER_CONFIG.BASE_URL;
  const endpoints = [
    `${base}/ocr_results/${filename}?t=${Date.now()}`,
    `${base}/results/${filename}?t=${Date.now()}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.error("fetchServerTextFile endpoint error:", endpoint, error);
    }
  }
  console.error(`fetchServerTextFile error: Unable to retrieve ${filename}`);
  return null;
};

const fetchRawCogTextFromServer = () => fetchServerTextFile("raw_cog_text.txt");
const fetchGradePdfOcrTextFromServer = () => fetchServerTextFile("grade_pdf_ocr.txt");
const fetchGradeWebpageTextFromServer = () => fetchServerTextFile("grade_webpage.txt");

const downloadQrScreenshotToCache = async () => {
  const base = OCR_URL || OCR_SERVER_CONFIG.BASE_URL;
  const endpoints = [
    `${base}/ocr_results/qr_website_screenshot.png?t=${Date.now()}`,
    `${base}/results/qr_website_screenshot.png?t=${Date.now()}`,
  ];
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
  for (const endpoint of endpoints) {
    const localPath = `${cacheDir}qr_screenshot_${Date.now()}.png`;
    try {
      const download = await FileSystem.downloadAsync(endpoint, localPath);
      if (download.status === 200) {
        return download.uri;
      }
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (error) {
      console.error("downloadQrScreenshotToCache endpoint error:", endpoint, error);
    }
  }
  console.error("downloadQrScreenshotToCache error: Unable to download qr_website_screenshot.png");
  return null;
};

const normalizeSemester = (value) => {
  if (!value) return null;

  const normalized = value.toString().trim().toLowerCase();

  if (['first', 'first sem', 'first semester', '1st', '1st sem', '1st semester'].includes(normalized)) {
    return 'FIRST';
  }

  if (['second', 'second sem', 'second semester', '2nd', '2nd sem', '2nd semester'].includes(normalized)) {
    return 'SECOND';
  }

  if (['summer', 'midyear', 'mid-year'].includes(normalized)) {
    return 'SUMMER';
  }

  return value.toString().trim().toUpperCase();
};

const getSemesterLabel = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeSemester(value);
};

const getYearLevelLabel = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.toString().trim().toUpperCase().replace(/\s+/g, ' ');

  const map = {
    'FIRST': 'FIRST YEAR',
    'FIRST YEAR': 'FIRST YEAR',
    '1ST': 'FIRST YEAR',
    '1ST YEAR': 'FIRST YEAR',
    'SECOND': 'SECOND YEAR',
    'SECOND YEAR': 'SECOND YEAR',
    '2ND': 'SECOND YEAR',
    '2ND YEAR': 'SECOND YEAR',
    'THIRD': 'THIRD YEAR',
    'THIRD YEAR': 'THIRD YEAR',
    '3RD': 'THIRD YEAR',
    '3RD YEAR': 'THIRD YEAR',
    'FOURTH': 'FOURTH YEAR',
    'FOURTH YEAR': 'FOURTH YEAR',
    '4TH': 'FOURTH YEAR',
    '4TH YEAR': 'FOURTH YEAR',
  };

  return map[normalized] || normalized;
};

const promoteYearLevelLabel = (value) => {
  const normalized = getYearLevelLabel(value);
  if (!normalized) return value;
  const order = ['FIRST YEAR', 'SECOND YEAR', 'THIRD YEAR', 'FOURTH YEAR'];
  const idx = order.indexOf(normalized);
  if (idx === -1 || idx === order.length - 1) return normalized;
  return order[idx + 1];
};

const incrementAcademicYearRange = (value) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{4})$/);
  if (!match) return value;
  const start = parseInt(match[1], 10) + 1;
  const end = parseInt(match[2], 10) + 1;
  return `${start}-${end}`;
};

// Parse OCR text to extract grade data
const parseGradeListFromText = (text) => {
  if (!text) return [];
  const match = text.match(/Grade\s*\{([^}]*)\}/i);
  const body = match ? match[1] : text;
  return body
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "Grade{" && line !== "}");
};

const ALLOWED_GRADE_VALUES = new Set([
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "4.00",
  "5.00",
  "INC",
]);

const isAllowedGradeValue = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = value.toString().trim().toUpperCase();
  if (normalized === "INCOMPLETE") return ALLOWED_GRADE_VALUES.has("INC");
  if (normalized === "DROP" || normalized === "DRP") return ALLOWED_GRADE_VALUES.has("5.00");
  if (ALLOWED_GRADE_VALUES.has(normalized)) return true;

  const numericMatch = normalized.match(/^(\d(?:\.\d{2})?)$/);
  if (numericMatch) {
    const formatted = parseFloat(numericMatch[1]).toFixed(2);
    return ALLOWED_GRADE_VALUES.has(formatted);
  }
  return false;
};

const extractGradeSequenceFromCourses = (courses = []) =>
  courses
    .map((course) => (course?.grade ? course.grade.toString().trim() : null))
    .filter(Boolean);

const parseGradeData = (extractedText, gradeOverrideList = []) => {
  if (!extractedText) return { courses: [], gwa: null, totalUnits: null, totalCourses: null, academicYear: null, semester: null, yearLevel: null };
  
  
  const lines = extractedText.split('\n');
  const courses = [];
  let weightedSumFromCourses = 0;
  let unitsFromCourses = 0;
  let gwa = null;
  let totalUnits = null;
  let totalCourses = null;
  let academicYear = null;
  let semester = null;
  let yearLevel = null;
  
  // Find GWA - Updated pattern to match your format
  const gwaMatch = extractedText.match(/General Weighted Average \(GWA\)\s*(\d+\.?\d*)/i);
  if (gwaMatch) {
    gwa = parseFloat(gwaMatch[1]);
  }
  
  // Find total units - Updated pattern to match your format
  const unitsMatch = extractedText.match(/Total no of Units\s*(\d+)/i);
  if (unitsMatch) {
    totalUnits = parseInt(unitsMatch[1]);
  }
  
  // Find total courses - Updated pattern to match your format  
  const coursesMatch = extractedText.match(/Total no of Course\s*(\d+)/i);
  if (coursesMatch) {
    totalCourses = parseInt(coursesMatch[1]);
  }
  
  // Extract Academic Year
  const academicYearMatch = extractedText.match(/Academic Year\s*:\s*(\d{4}-\d{4})/i);
  if (academicYearMatch) {
    academicYear = academicYearMatch[1];
  }

  // Extract Semester
  const semesterMatch = extractedText.match(/Semester\s*:\s*(FIRST(?:\s+SEMESTER)?|SECOND(?:\s+SEMESTER)?|SUMMER|MIDYEAR|MID-YEAR|1ST(?:\s+SEMESTER)?|2ND(?:\s+SEMESTER)?)/i);
  if (semesterMatch) {
    semester = normalizeSemester(semesterMatch[1]);
  }

  // Extract Year Level
  const yearLevelMatch = extractedText.match(/Year Level\s*:\s*(FIRST(?:\s+YEAR)?|SECOND(?:\s+YEAR)?|THIRD(?:\s+YEAR)?|FOURTH(?:\s+YEAR)?|1ST(?:\s+YEAR)?|2ND(?:\s+YEAR)?|3RD(?:\s+YEAR)?|4TH(?:\s+YEAR)?)/i);
  if (yearLevelMatch) {
    yearLevel = getYearLevelLabel(yearLevelMatch[1]);
  }
  
  // Helpers for course parsing/aggregation
  const normalizeCodeForComparison = (value) =>
    (value || "").toString().toUpperCase().replace(/\s+/g, "");
  const addCourse = (course) => {
    if (!course || !course.courseCode) return;
    const exists = courses.some((existing) => {
      if (course.rowNumber && existing.rowNumber) {
        return existing.rowNumber === course.rowNumber;
      }
      return (
        normalizeCodeForComparison(existing.courseCode) ===
        normalizeCodeForComparison(course.courseCode)
      );
    });
    if (exists) return;

    courses.push(course);
    const numericGrade = parseFloat(course.grade);
    const numericUnits = parseFloat(course.units);
    if (!isNaN(numericGrade) && !isNaN(numericUnits) && numericUnits > 0) {
      weightedSumFromCourses += numericGrade * numericUnits;
      unitsFromCourses += numericUnits;
    }
  };

  // Parse course data - handle both structured data and table format
  let inStructuredSection = false;
  let structuredCourseCounter = 0;
  const tableRows = [];
  let collectingTableRows = false;
  let pendingRow = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if we've reached the structured data section
    if (line.includes('COURSE_CODE|COURSE_TITLE|UNITS|GRADE|SECTION|INSTRUCTOR')) {
      inStructuredSection = true;
      continue;
    }
    
    // Begin capturing table rows
    if (line.includes('Course Code') && line.includes('Course Title') && line.includes('Units') && line.includes('Grade')) {
      collectingTableRows = true;
      if (pendingRow) {
        tableRows.push(pendingRow);
        pendingRow = null;
      }
      inStructuredSection = false;
      continue;
    }
    
    // Stop parsing when we reach certain sections
    if (line.includes('SUMMARY:') || line.includes('STUDENT INFO:') || line.includes('** NOTHING FOLLOWS **') || line.includes('Total no of Course')) {
      inStructuredSection = false;
      if (collectingTableRows && pendingRow) {
        tableRows.push(pendingRow);
        pendingRow = null;
      }
      if (line.includes('** NOTHING FOLLOWS **') || line.includes('Total no of Course')) {
        collectingTableRows = false;
      }
      continue;
    }
    
    // Parse structured data (pipe-separated format)
    if (inStructuredSection && line.includes('|') && line.split('|').length >= 6) {
      structuredCourseCounter += 1;
      const parts = line.split('|');
      const course = {
        courseCode: parts[0].trim(),
        courseTitle: parts[1].trim(),
        units: parts[2].trim(),
        grade: parts[3].trim(),
        section: parts[4].trim(),
        instructor: parts[5].trim(),
        rowNumber: structuredCourseCounter,
      };
      if (course.courseCode && course.grade) {
        addCourse(course);
      }
      continue;
    }

    // Collect table rows using row numbers (1,2,3...)
    if (collectingTableRows) {
      const rowMatch = line.match(/^\s*(\d+)\s+/);
      if (rowMatch) {
        if (pendingRow) {
          tableRows.push(pendingRow);
        }
        pendingRow = {
          rowNumber: parseInt(rowMatch[1], 10),
          text: line,
        };
      } else if (pendingRow) {
        pendingRow.text += ' ' + line;
      }
    }
  }
  if (pendingRow) {
    tableRows.push(pendingRow);
  }

  const parseTableRow = (row) => {
    if (!row || !row.text) return null;
    const sanitized = row.text.replace(/\|/g, ' ');
    const tokens = sanitized.trim().split(/\s+/);
    if (tokens.length < 5) return null;
    
    // Remove row number token
    tokens.shift();

    // Determine course code (prefix + number)
    const codeTokens = [];
    while (tokens.length > 0) {
      const token = tokens.shift();
      if (/^\d{2,3}$/.test(token)) {
        codeTokens.push(token);
        break;
      }
      codeTokens.push(token);
    }
    if (codeTokens.length < 2) return null;
    const courseNumber = codeTokens.pop();
    const courseCode = `${codeTokens.join(' ')} ${courseNumber}`.replace(/\s+/g, ' ').trim();

    if (tokens.length < 3) return null;

    // Locate section token (pattern like IT-1203)
    let sectionIndex = -1;
    for (let idx = tokens.length - 1; idx >= 0; idx--) {
      const token = tokens[idx];
      if (/^[A-Za-z]{1,}[A-Za-z0-9-]*\d{2,}$/.test(token) || /^[A-Za-z]{2,}-\d{3,}$/.test(token)) {
        sectionIndex = idx;
        break;
      }
    }
    if (sectionIndex === -1 || sectionIndex < 2) {
      return null;
    }

    const unitsIndex = sectionIndex - 2;
    const gradeIndex = sectionIndex - 1;
    if (unitsIndex < 0 || gradeIndex < 0) {
      return null;
    }

    const courseTitleTokens = tokens.slice(0, unitsIndex);
    const courseTitle = courseTitleTokens.join(' ').replace(/\s+/g, ' ').trim();
    const unitsToken = tokens[unitsIndex];
    const gradeToken = tokens[gradeIndex];
    const sectionToken = tokens[sectionIndex];
    const instructorTokens = tokens.slice(sectionIndex + 1);

    return {
      rowNumber: row.rowNumber,
      courseCode,
      courseTitle,
      units: unitsToken,
      grade: gradeToken,
      section: sectionToken,
      instructor: instructorTokens.join(' ').trim(),
    };
  };

  tableRows.forEach((row) => {
    const parsedCourse = parseTableRow(row);
    if (parsedCourse) {
      addCourse(parsedCourse);
    }
  });
  
  if (gradeOverrideList.length > 0) {
    courses.forEach((course, index) => {
      if (gradeOverrideList[index]) {
        course.grade = gradeOverrideList[index];
      }
    });
  }

  let finalWeightedSum = 0;
  let finalUnitsSum = 0;
  courses.forEach((course) => {
    const numericGrade = parseFloat(course.grade);
    const numericUnits = parseFloat(course.units);
    if (!isNaN(numericGrade) && !isNaN(numericUnits) && numericUnits > 0) {
      finalWeightedSum += numericGrade * numericUnits;
      finalUnitsSum += numericUnits;
    }
  });

  if (finalUnitsSum > 0) {
    gwa = finalWeightedSum / finalUnitsSum;
    if (!totalUnits) {
      totalUnits = finalUnitsSum;
    }
    if (!totalCourses) {
      totalCourses = courses.length;
    }
  }
  
  return { courses, gwa, totalUnits, totalCourses, academicYear, semester, yearLevel };
};

// Validate COG filename format
const validateCOGFilename = (fileName) => {
  // Expected format: Lastname_Firstname_COG.pdf
  const cogPattern = /^[A-Za-z]+_[A-Za-z]+_COG\.pdf$/i;
  return cogPattern.test(fileName);
};

// Fetch student data from session
const getStudentData = async () => {
  try {
    const raw = await AsyncStorage.getItem("session");
    if (!raw) throw new Error("No session found");
    
    const session = JSON.parse(raw);
    if (!session.login_id) throw new Error("Login ID not found in session");

    const response = await fetch(`${BASE_URL}/getuser.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: session.login_id }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Failed to fetch student data");
    
    return result.student;
  } catch (error) {
    console.error("Error fetching student data:", error);
    throw error;
  }
};

// Fetch curriculum subjects
const getCurriculumSubjects = async (curriculumId) => {
  try {
    const response = await fetch(`${BASE_URL}/get_curriculum_subjects.php`);
    const result = await response.json();
    
    if (!result.success) throw new Error(result.message || "Failed to fetch curriculum subjects");
    
    // Filter subjects by curriculum_id if provided
    if (curriculumId) {
      return result.data.filter(subject => subject.curriculum_id == curriculumId);
    }
    
    return result.data;
  } catch (error) {
    console.error("Error fetching curriculum subjects:", error);
    throw error;
  }
};

// Normalize course code for better matching
const normalizeCourseCode = (courseCode) => {
  if (!courseCode) return '';
  return courseCode
    .toString()
    .toUpperCase()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove special characters except spaces
    .trim();
};

// Enhanced course code matching with multiple strategies
const findMatchingCurriculumSubject = (courseCode, curriculumSubjects) => {
  if (!courseCode || !curriculumSubjects) return null;
  
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  
  // Strategy 1: Exact match (normalized)
  let match = curriculumSubjects.find(subject => 
    normalizeCourseCode(subject.Code) === normalizedCourseCode
  );
  
  if (match) return { match, strategy: 'exact' };
  
  // Strategy 2: Match without spaces
  const noSpaceCourseCode = normalizedCourseCode.replace(/\s+/g, '');
  match = curriculumSubjects.find(subject => 
    normalizeCourseCode(subject.Code).replace(/\s+/g, '') === noSpaceCourseCode
  );
  
  if (match) return { match, strategy: 'no_spaces' };
  
  // Strategy 3: Partial match (starts with)
  match = curriculumSubjects.find(subject => {
    const subjectCode = normalizeCourseCode(subject.Code);
    return subjectCode.startsWith(normalizedCourseCode) || 
           normalizedCourseCode.startsWith(subjectCode);
  });
  
  if (match) return { match, strategy: 'partial' };
  
  return null;
};

// Validate grades against curriculum
const validateGradesAgainstCurriculum = async (extractedCourses, studentData) => {
  try {
    const curriculumSubjects = await getCurriculumSubjects(studentData.curriculum_id);
    
    const validationResults = {
      matchedCourses: [],
      unmatchedCourses: [],
      totalCourses: extractedCourses.length,
      matchedCount: 0,
      curriculumSubjects: curriculumSubjects,
      studentCurriculumId: studentData.curriculum_id,
      curriculumInfo: {
        totalSubjects: curriculumSubjects.length,
        tracks: [...new Set(curriculumSubjects.map(s => s.track))].filter(Boolean),
        yearLevels: [...new Set(curriculumSubjects.map(s => s.year_level))].filter(Boolean)
      }
    };

    extractedCourses.forEach(course => {
      const matchResult = findMatchingCurriculumSubject(course.courseCode, curriculumSubjects);

      if (matchResult) {
        validationResults.matchedCourses.push({
          ...course,
          curriculumSubject: matchResult.match,
          matchStrategy: matchResult.strategy,
          isValid: true,
          normalizedCourseCode: normalizeCourseCode(course.courseCode),
          curriculumCourseCode: matchResult.match.Code
        });
        validationResults.matchedCount++;
      } else {
        // Find closest matches for better error reporting
        const closestMatches = curriculumSubjects
          .map(subject => ({
            subject,
            similarity: calculateSimilarity(normalizeCourseCode(course.courseCode), normalizeCourseCode(subject.Code))
          }))
          .filter(item => item.similarity > 0.3)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3);

        validationResults.unmatchedCourses.push({
          ...course,
          isValid: false,
          reason: "Course not found in curriculum",
          normalizedCourseCode: normalizeCourseCode(course.courseCode),
          suggestedMatches: closestMatches.map(item => ({
            courseCode: item.subject.Code,
            courseTitle: item.subject.Course_Title,
            units: item.subject.units ?? item.subject.Units ?? null,
            subjectData: item.subject,
            similarity: item.similarity
          }))
        });
      }
    });

    return validationResults;
  } catch (error) {
    console.error("Error validating grades against curriculum:", error);
    throw error;
  }
};

// Simple similarity calculation for course codes
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Levenshtein distance calculation
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const buildValidatedCourseList = (validationResults = {}) => {
  const matchedCourses = validationResults.matchedCourses || [];
  const suggestedCourses = (validationResults.unmatchedCourses || [])
    .map((course) => {
      const suggestion = course.suggestedMatches?.[0];
      const subjectData = suggestion?.subjectData;
      if (!suggestion || !subjectData) return null;

      return {
        ...course,
        courseCode: suggestion.courseCode || course.courseCode,
        courseTitle: suggestion.courseTitle || course.courseTitle,
        units: suggestion.units ?? course.units,
        curriculumSubject: subjectData,
        isValid: true,
        suggestionApplied: true,
      };
    })
    .filter(Boolean);

  return [...matchedCourses, ...suggestedCourses];
};

// Helper function to get academic year ID (matches your academic_years table)
const getAcademicYearId = (academicYear) => {
  const yearMap = {
    "2021-2022": 24,
    "2022-2023": 25,
    "2023-2024": 26,
    "2024-2025": 27,
  };

  // Fall back to the latest known academic year to avoid invalid FK references
  return yearMap[academicYear] || 27;
};

// Reverse mapping for labels when viewing grades
const getAcademicYearLabel = (academicYearId) => {
  const map = {
    24: "2021-2022",
    25: "2022-2023",
    26: "2023-2024",
    27: "2024-2025",
  };
  return map[academicYearId] || null;
};

// Determine grade status based on grade value
const getGradeStatus = (grade) => {
  if (!grade) return "UNKNOWN";
  
  const gradeStr = grade.toString().toUpperCase();
  
  // Handle special cases
  if (gradeStr === "INC" || gradeStr === "INCOMPLETE") {
    return "INC";
  }
  
  // Convert to number for numeric grades
  const numericGrade = parseFloat(grade);
  
  if (isNaN(numericGrade)) {
    return "UNKNOWN";
  }
  
  // Grade logic: 5.00 = FAIL, 4.00 or below = PASSED
  if (numericGrade === 5.00) {
    return "FAIL";
  } else if (numericGrade <= 4.00 && numericGrade >= 1.00) {
    return "PASSED";
  } else {
    return "UNKNOWN";
  }
};

// NEW: helper to build term label from a grade record safely
const getGradeTermLabelFromRecord = (grade) => {
  if (!grade) return null;

  const academicYear =
    grade.academicYear ||
    grade.academic_year ||
    grade.academicYearLabel ||
    grade.academic_year_label ||
    null;

  const rawSem =
    grade.semester ||
    grade.sem ||
    grade.term ||
    grade.semester_label ||
    null;

  const semLabel = rawSem ? getSemesterLabel(rawSem) : null;

  if (!academicYear || !semLabel) return null;

  return `${academicYear} ${semLabel}`;
};

// NEW: group backend grades into terms like "AY + Semester" (with de-duplication)
const groupGradesByTerm = (grades) => {
  if (!Array.isArray(grades)) return [];

  // 1) Remove duplicates coming from the backend
  const uniqueMap = new Map();

  grades.forEach((g) => {
    const sem = getSemesterLabel(g.semester) || g.semester || '';
    const yearId = g.academic_year_id;

    // Prefer a stable unique id if backend sends one
    const baseKey =
      g.id ||
      g.grade_id ||
      `${g.student_id || ''}-${g.course_code || ''}-${yearId || ''}-${sem}`;

    if (!uniqueMap.has(baseKey)) {
      uniqueMap.set(baseKey, { ...g, semester: sem, academic_year_id: yearId });
    }
  });

  const uniqueGrades = Array.from(uniqueMap.values());

  // 2) Group by term (AY + Semester)
  const termMap = new Map();

  uniqueGrades.forEach((g) => {
    const sem = g.semester || '';
    const yearId = g.academic_year_id;
    const key = `${yearId || 'unknown'}-${sem || 'unknown'}`;

    if (!termMap.has(key)) {
      termMap.set(key, {
        key,
        academic_year_id: yearId,
        academicYearLabel:
          getAcademicYearLabel(yearId) || (yearId ? `AY ${yearId}` : 'Academic Year'),
        semester: sem,
        courses: [],
      });
    }
    termMap.get(key).courses.push(g);
  });

  // 3) Sort terms (latest AY first, then FIRST/SECOND/SUMMER)
  const SEM_ORDER = { FIRST: 1, SECOND: 2, SUMMER: 3 };

  return Array.from(termMap.values()).sort((a, b) => {
    const ayA = a.academic_year_id || 0;
    const ayB = b.academic_year_id || 0;
    if (ayA !== ayB) return ayB - ayA; // latest first

    const sA = SEM_ORDER[a.semester] || 99;
    const sB = SEM_ORDER[b.semester] || 99;
    return sA - sB;
  });
};

// NEW: format grade for display in list/table
const formatGradeValue = (grade) => {
  if (grade === null || grade === undefined) return 'N/A';
  const num = parseFloat(grade);
  if (!isNaN(num)) return num.toFixed(2);
  return grade.toString();
};

const STUDENT_PROGRESS_KEY_PREFIX = "studentProgress_";

const updateStudentProgressCache = async (
  studentId,
  yearUpdate = {},
  fallback = {}
) => {
  if (!studentId) return;

  try {
    const key = `${STUDENT_PROGRESS_KEY_PREFIX}${studentId}`;
    const existingRaw = await AsyncStorage.getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};

    const resolvedTrack =
      (yearUpdate.track && yearUpdate.track !== "N/A"
        ? yearUpdate.track
        : fallback.track) ?? existing.track ?? "N/A";

    const mergedProgress = {
      ...existing,
      display_year_level:
        yearUpdate.year_level_after ??
        fallback.display_year_level ??
        existing.display_year_level ??
        null,
      academic_year:
        yearUpdate.academic_year_after ??
        fallback.academic_year ??
        existing.academic_year ??
        null,
      track: resolvedTrack,
      is_bsit:
        typeof yearUpdate.is_bsit === "boolean"
          ? yearUpdate.is_bsit
          : typeof fallback.is_bsit === "boolean"
          ? fallback.is_bsit
          : existing.is_bsit ?? false,
      promotion_reason:
        yearUpdate.promotion_reason ?? existing.promotion_reason ?? null,
      last_synced_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(mergedProgress));
    return mergedProgress;
  } catch (error) {
    console.error("Error updating student progress cache:", error);
  }
};

// Check for existing grades in database
const checkExistingGrades = async (studentId, courses, academicYear, semester) => {
  try {
    const semesterLabel = getSemesterLabel(semester);

    const coursesToCheck = courses.map(course => ({
      course_code: course.courseCode,
      subject_id: course.subject_id,
      grade: course.grade,
      semester: semesterLabel,
      academic_year_id: getAcademicYearId(academicYear)
    }));

    const response = await fetch(`${BASE_URL}/check_existing_grades.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        courses: coursesToCheck
      }),
    });

    // Handle non-OK responses
    if (!response.ok) {
      console.warn(`check_existing_grades returned status ${response.status}, assuming no duplicates`);
      return { success: true, duplicates: [] };
    }

    // Get response text first to check if it's empty
    const responseText = await response.text();
    if (!responseText) {
      console.warn("check_existing_grades returned empty response, assuming no duplicates");
      return { success: true, duplicates: [] };
    }

    const result = JSON.parse(responseText);
    if (!result.success) throw new Error(result.message || "Failed to check existing grades");
    
    return result;
  } catch (error) {
    console.error("Error checking existing grades:", error);
    // Return empty duplicates list instead of throwing, so grade upload can continue
    return { success: true, duplicates: [] };
  }
};

// Insert validated grades to database
const insertValidatedGrades = async (validatedCourses, studentData, academicYear, semester) => {
  try {
    const insertPromises = validatedCourses.map(async (course) => {
      if (!course.isValid || !course.curriculumSubject) return null;

      // Determine grade status based on grade value
      const gradeStatus = getGradeStatus(course.grade);

      const semesterLabel = getSemesterLabel(semester);

      const gradeData = {
        student_id: studentData.Student_id,
        course_code: course.courseCode,
        subject_id: parseInt(course.curriculumSubject.subject_id || course.curriculumSubject.id),
        academic_year_id: getAcademicYearId(academicYear),
        semester: semesterLabel,
        grade: course.grade,
        section: course.section,
        instructor: course.instructor,
        remarks: gradeStatus // Set remarks based on grade status (PASSED/FAIL/INC)
      };

      const response = await fetch(`${BASE_URL}/insert_grade.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gradeData),
      });

      // Check if response is OK
      if (!response.ok) {
        const responseText = await response.text();
        
        // Check if it's a duplicate error (409) - don't log as error since it's expected
        if (response.status === 409) {
          return { 
            success: false, 
            message: "Duplicate grade found",
            course_code: gradeData.course_code,
            error: "This course already exists for this student"
          };
        }
        
        // Only log actual errors (not duplicates)
        console.error(`insert_grade.php returned status ${response.status}:`, responseText);
        console.error("Course data being sent:", gradeData);
        
        return { 
          success: false, 
          message: `Server error: ${response.status}`,
          course_code: gradeData.course_code
        };
      }

      // Get response text first to check if it's valid JSON
      const responseText = await response.text();
      if (!responseText) {
        console.error("insert_grade.php returned empty response");
        return { 
          success: false, 
          message: "Empty response from server",
          course_code: gradeData.course_code
        };
      }

      try {
        const result = JSON.parse(responseText);
        // Add course code to successful responses too
        return { ...result, course_code: gradeData.course_code };
      } catch (parseError) {
        console.error("Failed to parse insert_grade.php response:", responseText);
        return { 
          success: false, 
          message: "Invalid response format from server",
          course_code: gradeData.course_code
        };
      }
    });

    const results = await Promise.all(insertPromises);
    return results.filter(result => result !== null);
  } catch (error) {
    console.error("Error inserting grades:", error);
    throw error;
  }
};

// File picker for grade documents
const pickGradeFile = async (
  setUploadedGrades,
  setOcrLoading,
  currentUploadedGrades,
  onGradeReady
) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    // Handle both old and new DocumentPicker API formats
    const fileInfo = result.assets ? result.assets[0] : result;
    
    let { uri: fileUri, name: fileName } = fileInfo;
    
    // Handle case where fileName might be undefined - generate a fallback name
    if (!fileName) {
      console.warn('fileName is undefined, generating fallback name');
      fileName = `grade_document_${Date.now()}.pdf`;
    }
    
    
    // Safely get file extension
    const fileExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';
    
    if (fileExtension !== 'pdf') {
      Alert.alert(
        "Invalid File Format", 
        "Accepted format: PDF only\nMake sure the file is clear, complete, and official\nExample filename: Lastname_Firstname_COG.pdf"
      );
      return;
    }

    // Validate COG filename format
    if (!validateCOGFilename(fileName)) {
      Alert.alert(
        "Invalid Filename Format", 
        "Please rename your file to follow this format:\nLastname_Firstname_COG.pdf\n\nExample: Smith_John_COG.pdf\n\nMake sure the file is clear, complete, and official."
      );
      return;
    }

    // Create directory for grades if it doesn't exist
    const gradesDir = `${FileSystem.documentDirectory}grades/`;
    await FileSystem.makeDirectoryAsync(gradesDir, { intermediates: true });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFileName = `grades_${timestamp}.pdf`;
    const newPath = `${gradesDir}${newFileName}`;

    // Copy file to grades directory
    await FileSystem.copyAsync({
      from: fileUri,
      to: newPath,
    });

    setOcrLoading(true);

    try {
      // Extract text using OCR
      const extractedText = await runGradeOCRBackend(newPath);
      const [rawCogTextFromServer, gradePdfOcrText, gradeWebpageText] = await Promise.all([
        fetchRawCogTextFromServer(),
        fetchGradePdfOcrTextFromServer(),
        fetchGradeWebpageTextFromServer(),
      ]);

      const gradeStructureText = rawCogTextFromServer || extractedText;
      const initialGradeData = parseGradeData(gradeStructureText, []);
      const rawGradeSequence = extractGradeSequenceFromCourses(initialGradeData.courses);
      const rawGradesAreClear =
        rawGradeSequence.length > 0 && rawGradeSequence.every(isAllowedGradeValue);

      const parsedWebGradeList = parseGradeListFromText(gradeWebpageText);
      const cleanWebGradeList = parsedWebGradeList.filter((grade) =>
        grade ? isAllowedGradeValue(grade) : false
      );
      const shouldUseRawGrades =
        rawGradesAreClear || cleanWebGradeList.length === 0;
      const effectiveGradeList = shouldUseRawGrades
        ? rawGradeSequence
        : cleanWebGradeList;
      const gradeData = shouldUseRawGrades
        ? initialGradeData
        : parseGradeData(gradeStructureText, effectiveGradeList);
      const gradeListSource = shouldUseRawGrades
        ? "raw_cog_text"
        : "grade_webpage";
      
      // Get student data for curriculum validation
      const studentData = await getStudentData();
      
      // Check if student already has grades for this semester/year level/academic year combination
      const existingGradesForPeriod = currentUploadedGrades.filter(grade => 
        grade.academicYear === gradeData.academicYear &&
        grade.semester === gradeData.semester &&
        grade.yearLevel === gradeData.yearLevel &&
        grade.savedToDatabase === true
      );

      if (existingGradesForPeriod.length > 0) {
        Alert.alert(
          "Cannot Upload Grades",
          `Grades for ${gradeData.semester} Semester, ${gradeData.academicYear} Academic Year, ${gradeData.yearLevel} have already been uploaded.\n\nYou cannot upload the same semester/year level combination twice.`
        );
        setOcrLoading(false);
        return;
      }
      
      // Validate grades against curriculum
      const validationResults = await validateGradesAgainstCurriculum(gradeData.courses, studentData);
      const effectiveValidatedCourses = buildValidatedCourseList(validationResults);
      
      // Check for existing grades (duplicates) - pass matched courses with subject_id
      let duplicateCheck = null;
      if (effectiveValidatedCourses.length > 0) {
        const coursesWithSubjectId = effectiveValidatedCourses
          .map(course => ({
            ...course,
            subject_id: course.curriculumSubject?.subject_id || course.curriculumSubject?.id
          }))
          .filter(course => !!course.subject_id);

        if (coursesWithSubjectId.length > 0) {
          duplicateCheck = await checkExistingGrades(
            studentData.Student_id, 
            coursesWithSubjectId, 
            gradeData.academicYear, 
            gradeData.semester
          );
        }
      }
      
      // Add grade status to each course
      const coursesWithStatus = gradeData.courses.map(course => ({
        ...course,
        gradeStatus: getGradeStatus(course.grade)
      }));
      
      // Create grade record with validation results
      const normalizedSemester = normalizeSemester(gradeData.semester);

      const gradeRecord = {
        id: timestamp,
        fileName: newFileName,
        filePath: newPath,
        extractedText: gradeStructureText,
        rawCogText: rawCogTextFromServer,
        gradePdfOcrText,
        gradeWebpageText,
        gradeWebList: effectiveGradeList,
        gradeListSource,
        academicYear: gradeData.academicYear,
        semester: normalizedSemester,
        yearLevel: gradeData.yearLevel,
        uploadDate: new Date().toISOString(),
        validationResults: validationResults,
        effectiveValidatedCourses,
        duplicateCheck: duplicateCheck,
        coursesWithStatus: coursesWithStatus,
        studentData: studentData,
        needsReview: true // Flag to indicate this needs review before saving
      };

      // Update uploaded grades & immediately show details
      setUploadedGrades(prev => [...prev, gradeRecord]);
      if (typeof onGradeReady === 'function') {
        onGradeReady(gradeRecord);
      }
    } catch (error) {
      console.error("Grade processing error:", error);
      Alert.alert("Processing Error", error.message || "Failed to process grades. Please ensure all services are running.");
    } finally {
      setOcrLoading(false);
    }

  } catch (error) {
    console.error("File picker error:", error);
    Alert.alert("Error", "Failed to upload file. Please try again.");
  }
};

const UploadGrades = ({ navigation }) => {
  const [uploadedGrades, setUploadedGrades] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showGradeDetails, setShowGradeDetails] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [savingGrades, setSavingGrades] = useState(false);
  const pdfCaptureRef = useRef(null);
  const pdfCapturePromiseRef = useRef(null);
  const [pdfCaptureGrade, setPdfCaptureGrade] = useState(null);
  const [gradeImagesModalVisible, setGradeImagesModalVisible] = useState(false);
  const [gradeImagesLoading, setGradeImagesLoading] = useState(false);
  const [gradeImages, setGradeImages] = useState([]);
  const [gradeImagesError, setGradeImagesError] = useState(null);

  // NEW: view grades modal state
  const [viewGradesVisible, setViewGradesVisible] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [studentGrades, setStudentGrades] = useState([]);
  const [groupedGrades, setGroupedGrades] = useState([]);
  const [selectedTermIndex, setSelectedTermIndex] = useState(0);
  const [gradeViewMode, setGradeViewMode] = useState('list');
  const [viewGradesScope, setViewGradesScope] = useState('single'); // 'single' | 'all'

  // NEW: term filter state & modal
  const [selectedTermFilter, setSelectedTermFilter] = useState(null);
  const [filterTermOptions, setFilterTermOptions] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterModalLoading, setFilterModalLoading] = useState(false);
  const [filterModalError, setFilterModalError] = useState(null);
  const [availableFilterYears, setAvailableFilterYears] = useState([]);
  const [availableFilterSemesters, setAvailableFilterSemesters] = useState({});
  const [selectedFilterYearOption, setSelectedFilterYearOption] = useState(null);
  const [selectedFilterSemesterOption, setSelectedFilterSemesterOption] = useState(null);
  const [showFilterYearDropdown, setShowFilterYearDropdown] = useState(false);
  const [showFilterSemesterDropdown, setShowFilterSemesterDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const termOptions = React.useMemo(() => {
    if (filterTermOptions.length > 0) {
      return filterTermOptions.map(
        (term) => `${term.academic_year} ${term.semester}`
      );
    }
    return [];
  }, [filterTermOptions]);

  const selectedTermLabel = !selectedTermFilter
    ? 'Filter by term'
    : selectedTermFilter === 'ALL'
    ? 'All Terms'
    : selectedTermFilter;

  const filteredGradeImages = React.useMemo(() => {
    if (!selectedTermFilter || gradeImages.length === 0) {
      return [];
    }
    if (selectedTermFilter === 'ALL') {
      return gradeImages;
    }
    const parts = selectedTermFilter.split(' ');
    const yearLabel = parts[0];
    const semLabel = normalizeSemester(parts.slice(1).join(' '));
    return gradeImages.filter((record) => {
      const recordSem = normalizeSemester(record.sem);
      return (
        record.academic_year === yearLabel &&
        (!semLabel || recordSem === semLabel)
      );
    });
  }, [gradeImages, selectedTermFilter]);

  // Uploaded grades now live only in memory; no AsyncStorage persistence.

  // 🔗 NEW: Use existing term filter dropdown to also control which term is shown in View Grades modal
  useEffect(() => {
    if (!viewGradesVisible || groupedGrades.length === 0) return;

    if (!selectedTermFilter) {
      setSelectedTermIndex(0);
      return;
    }

    if (selectedTermFilter === 'ALL') {
      setSelectedTermIndex(0);
      return;
    }

    // selectedTermFilter format: "2024-2025 FIRST"
    const parts = selectedTermFilter.split(' ');
    const yearLabel = parts[0];              // "2024-2025"
    const semLabel = parts.slice(1).join(' '); // "FIRST"

    const idx = groupedGrades.findIndex((term) => {
      const termYear = term.academicYearLabel || '';
      const termSem = term.semester || '';

      return (
        (termYear === yearLabel || termYear === `AY ${yearLabel}`) &&
        (termSem === semLabel || getSemesterLabel(termSem) === semLabel)
      );
    });

    setSelectedTermIndex(idx >= 0 ? idx : 0);
  }, [groupedGrades, selectedTermFilter, viewGradesVisible]);

  const handleGradeReady = (gradeRecord) => {
    if (gradeRecord) {
      setSelectedGrade(gradeRecord);
      setShowGradeDetails(true);
    }
  };

  const parseTermLabel = (label) => {
    if (!label || label === 'ALL') return { year: null, semester: null };
    const parts = label.trim().split(' ');
    const year = parts[0];
    const semester = normalizeSemester(parts.slice(1).join(' '));
    return { year, semester };
  };

  const loadFilterOptions = async () => {
    setFilterModalLoading(true);
    setFilterModalError(null);
    try {
      const studentData = await getStudentData();
      if (!studentData?.Student_id) {
        throw new Error('Student ID not found.');
      }

      const academicYears = await fetchAcademicYearsForFilter(studentData.Student_id);
      if (!academicYears.length) {
        throw new Error('No academic years available yet.');
      }

      const orderedYearsToUse = Array.from(
        new Set(
          academicYears
            .map((item) => item.label)
            .filter(Boolean)
        )
      );

      if (!orderedYearsToUse.length) {
        throw new Error('No academic years available yet.');
      }

      const termsMapToUse = {};
      orderedYearsToUse.forEach((year) => {
        termsMapToUse[year] = [...SEMESTER_FILTER_OPTIONS];
      });

      const termsListToUse = [];
      orderedYearsToUse.forEach((year) => {
        SEMESTER_FILTER_OPTIONS.forEach((sem) => {
          termsListToUse.push({ academic_year: year, semester: sem });
        });
      });

      setAvailableFilterYears(orderedYearsToUse);
      setAvailableFilterSemesters(termsMapToUse);
      setFilterTermOptions(termsListToUse);

      const currentSelection = parseTermLabel(selectedTermFilter);

      const defaultYear =
        orderedYearsToUse.find(
          (year) =>
            year === currentSelection.year &&
            termsMapToUse[year]?.includes(currentSelection.semester || '')
        ) ||
        orderedYearsToUse.find(
          (year) =>
            year === selectedFilterYearOption &&
            termsMapToUse[year]?.length &&
            termsMapToUse[year].includes(selectedFilterSemesterOption || '')
        ) ||
        orderedYearsToUse.find((year) => termsMapToUse[year]?.length) ||
        null;

      const defaultSemester =
        defaultYear && termsMapToUse[defaultYear]?.length
          ? termsMapToUse[defaultYear][0]
          : null;

      setSelectedFilterYearOption(defaultYear);
      setSelectedFilterSemesterOption((prev) => {
        if (
          defaultYear &&
          prev &&
          termsMapToUse[defaultYear]?.includes(prev)
        ) {
          return prev;
        }
        if (
          defaultYear &&
          currentSelection.semester &&
          termsMapToUse[defaultYear]?.includes(currentSelection.semester)
        ) {
          return currentSelection.semester;
        }
        return defaultSemester;
      });
    } catch (error) {
      setFilterModalError(error.message || 'Unable to load filter options.');
    } finally {
      setFilterModalLoading(false);
    }
  };

  const openTermSelectionModal = async () => {
    setFilterModalVisible(true);
    await loadFilterOptions();
  };

  const applyFilterSelection = () => {
    if (!selectedFilterYearOption || !selectedFilterSemesterOption) {
      Alert.alert('Incomplete Selection', 'Please choose both academic year and semester.');
      return;
    }
    setSelectedTermFilter(`${selectedFilterYearOption} ${selectedFilterSemesterOption}`);
    setFilterModalVisible(false);
    setShowFilterYearDropdown(false);
    setShowFilterSemesterDropdown(false);
  };

  const resetFilterModal = () => {
    setFilterModalVisible(false);
    setShowFilterYearDropdown(false);
    setShowFilterSemesterDropdown(false);
    setFilterModalError(null);
  };

  const SEMESTER_FILTER_OPTIONS = ['FIRST', 'SECOND', 'SUMMER', 'SUMMER2'];

  const fetchAcademicYearsForFilter = async (studentId) => {
    const params = new URLSearchParams({
      student_id: studentId,
    });
    const response = await fetch(
      `${BASE_URL}/filter_grades.php?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch academic years (status ${response.status})`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch academic years.');
    }
    return Array.isArray(data.academic_years) ? data.academic_years : [];
  };

  const fetchGradeImages = async () => {
    try {
      setGradeImagesLoading(true);
      setGradeImagesError(null);
      const student = await getStudentData();
      if (!student?.Student_id) {
        throw new Error('Student ID not found.');
      }
      const response = await fetch(
        `${BASE_URL}/get_grade_img.php?student_id=${encodeURIComponent(student.Student_id)}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch grade images (status ${response.status})`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch grade images.');
      }
      setGradeImages(Array.isArray(data.grades_records) ? data.grades_records : []);
    } catch (error) {
      console.error('Error loading grade images:', error);
      setGradeImagesError(error.message || 'Failed to load grade copies.');
    } finally {
      setGradeImagesLoading(false);
    }
  };

  const handleOpenGradeImages = async () => {
    if (!selectedTermFilter || selectedTermFilter === 'ALL') {
      Alert.alert(
        'Select a specific term',
        'Choose a specific academic year and semester from the filter before viewing the grade copy.'
      );
      openTermSelectionModal();
      return;
    }
    setGradeImagesModalVisible(true);
    await fetchGradeImages();
  };

  const handleCloseGradeImages = () => {
    setGradeImagesModalVisible(false);
    setGradeImagesError(null);
  };

  const requestPdfImageCapture = (gradeRecord) => {
    if (!gradeRecord?.filePath) {
      return Promise.reject(new Error('Missing PDF file for capture.'));
    }

    if (pdfCapturePromiseRef.current) {
      pdfCapturePromiseRef.current.reject(new Error('Another capture is already in progress.'));
      pdfCapturePromiseRef.current = null;
    }

    return new Promise((resolve, reject) => {
      pdfCapturePromiseRef.current = { resolve, reject };
      setPdfCaptureGrade({
        filePath: gradeRecord.filePath,
        captureKey: `${gradeRecord.id || Date.now()}`,
      });
    });
  };

  const handleHiddenPdfLoadComplete = async () => {
    if (!pdfCaptureRef.current || !pdfCapturePromiseRef.current) {
      return;
    }

    const performCapture = async () => {
      try {
        const uri = await pdfCaptureRef.current.capture?.();
        pdfCapturePromiseRef.current?.resolve(uri);
      } catch (error) {
        const fallbackUri = await pdfCaptureRef.current.capture?.({
          result: 'base64',
        });
        if (fallbackUri) {
          const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
          const basePath = `${cacheDir}grade_capture_${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(basePath, fallbackUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const normalizedUri = basePath.startsWith('file://')
            ? basePath
            : `file://${basePath}`;
          pdfCapturePromiseRef.current?.resolve(normalizedUri);
        } else {
          pdfCapturePromiseRef.current?.reject(error);
        }
      } finally {
        pdfCapturePromiseRef.current = null;
        setPdfCaptureGrade(null);
      }
    };

    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(performCapture, 150);
      });
    });
  };

  const handleHiddenPdfError = (error) => {
    if (pdfCapturePromiseRef.current) {
      pdfCapturePromiseRef.current.reject(error || new Error('Failed to render PDF for capture.'));
      pdfCapturePromiseRef.current = null;
    }
    setPdfCaptureGrade(null);
  };

  const uploadGradePdfImage = async (gradeRecord, fallbackAcademicYear, fallbackSemesterLabel) => {
    if (!gradeRecord) return false;
    try {
      let capturedUri = await downloadQrScreenshotToCache();
      if (!capturedUri) {
        capturedUri = await requestPdfImageCapture(gradeRecord);
      }
      if (!capturedUri) {
        throw new Error('Failed to capture the report image. Please try again.');
      }

      const studentId = gradeRecord.studentData?.Student_id;
      if (!studentId) {
        throw new Error('Student ID is missing, unable to save the grade image.');
      }

      const parsedTerm = selectedTermFilter && selectedTermFilter !== 'ALL'
        ? parseTermLabel(selectedTermFilter)
        : { year: null, semester: null };

      const semValue = (
        fallbackSemesterLabel ||
        gradeRecord.semester ||
        gradeRecord.semesterLabel ||
        parsedTerm.semester ||
        ''
      ).toString().trim().toUpperCase();

      const ayValue = (
        fallbackAcademicYear ||
        gradeRecord.academicYear ||
        parsedTerm.year ||
        ''
      ).toString().trim();

      const uploadResult = await FileSystem.uploadAsync(
        `${BASE_URL}/insert_grade_img.php`,
        capturedUri,
        {
          fieldName: 'image',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          parameters: {
            student_id: String(studentId),
            sem: semValue,
            academic_year: ayValue,
          },
        }
      );

      console.log('insert_grade_img.php upload status', uploadResult.status);
      if (uploadResult.body) {
        console.log('insert_grade_img.php response body', uploadResult.body.slice(0, 500));
      }

      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        throw new Error(
          `Image upload failed (${uploadResult.status}): ${uploadResult.body || ''}`
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(uploadResult.body);
      } catch (err) {
        throw new Error('Image upload succeeded but returned invalid JSON.');
      }

      if (!parsed.success) {
        throw new Error(parsed.message || 'Image upload failed.');
      }

      return true;
    } catch (error) {
      console.error('Unable to upload grade image:', error);
      Alert.alert(
        'Grade Image Upload Failed',
        error?.message ||
          'We saved your grade details, but failed to upload the scanned copy. Please try again.'
      );
      return false;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setSelectedTermFilter(null);
      setViewGradesVisible(false);
      await loadStudentGradesFromServer({
        academicYear: "2024-2025",
        semester: "FIRST",
      });
    } catch (err) {
      console.warn('Refresh failed', err?.message || err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUploadGrades = () => {
    pickGradeFile(setUploadedGrades, setOcrLoading, uploadedGrades, handleGradeReady);
  };

  const handleSaveGradesToDatabase = async (gradeRecord) => {
    if (!gradeRecord.validationResults || !gradeRecord.studentData) {
      Alert.alert("Error", "No validation results found. Please re-upload the grades.");
      return;
    }

    const { validationResults, studentData, academicYear, semester, duplicateCheck } = gradeRecord;
    const coursesToSave = buildValidatedCourseList(validationResults);
    
    if (coursesToSave.length === 0) {
      Alert.alert("No Valid Courses", "No courses matched the curriculum. Cannot save to database.");
      return;
    }

    // Check for duplicate courses for the same student
    const duplicateCourses = duplicateCheck?.duplicates || [];
    const duplicateCount = duplicateCourses.length;

    // Block save if there are any duplicates - student cannot have the same subject twice
    if (duplicateCount > 0) {
      let duplicateMessage = `Cannot save grades!\n\nThe following course(s) already exist for this student:\n\n`;
      duplicateCourses.forEach(dup => {
        duplicateMessage += `• ${dup.course_code} (existing grade: ${dup.existing_grade})\n`;
      });
      duplicateMessage += `\nPlease contact your academic advisor if you need to update existing grades.`;
      
      Alert.alert("Duplicate Grades Found", duplicateMessage);
      return;
    }

    // If no duplicates, proceed with all validated courses (including suggested matches)
    const newCoursesCount = coursesToSave.length;
    const totalMatched = coursesToSave.length;

    let confirmMessage = `Review Grade Upload:\n\n`;
    confirmMessage += `📊 Total Matched Courses: ${totalMatched}\n`;
    confirmMessage += `✅ Courses to Upload: ${newCoursesCount}\n`;

    confirmMessage += `\n📝 Grade Status Summary:\n`;
    const statusCounts = { PASSED: 0, FAIL: 0, INC: 0, UNKNOWN: 0 };
    coursesToSave.forEach(course => {
      const status = getGradeStatus(course.grade);
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        const emoji = status === 'PASSED' ? '✅' : status === 'FAIL' ? '❌' : status === 'INC' ? '⏳' : '❓';
        confirmMessage += `${emoji} ${status}: ${count} course(s)\n`;
      }
    });

    confirmMessage += `\nProceed with uploading ${newCoursesCount} new course(s)?`;

    Alert.alert(
      "Confirm Grade Upload",
      confirmMessage,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm & Save", 
          style: "default",
          onPress: () => performGradeSave(coursesToSave, studentData, academicYear, semester)
        }
      ]
    );
  };

  const performGradeSave = async (coursesToSave, studentData, academicYear, semester) => {
    setSavingGrades(true);
    
    try {
      const semesterLabel = getSemesterLabel(selectedGrade?.semester ?? semester);
      const normalizedYearLevel = getYearLevelLabel(selectedGrade?.yearLevel ?? studentData?.Year);

      // Insert only non-duplicate courses
      const insertResults = await insertValidatedGrades(
        coursesToSave, 
        studentData, 
        academicYear, 
        semesterLabel
      );

      const latestYearUpdate = insertResults
        .filter(result => result && result.success && result.year_update)
        .map(result => result.year_update)
        .pop();

      if (latestYearUpdate) {
        const fallbackProgress = {
          display_year_level: normalizedYearLevel,
          academic_year: selectedGrade?.academicYear ?? academicYear ?? null,
          track: latestYearUpdate.track,
          is_bsit: latestYearUpdate.is_bsit ?? false,
        };

        await updateStudentProgressCache(
          studentData.Student_id,
          latestYearUpdate,
          fallbackProgress
        );
      }

      const successCount = insertResults.filter(result => result && result.success).length;
      const failCount = insertResults.length - successCount;
      
      // Find failed courses with details
      const failedCourses = insertResults.filter(result => result && !result.success);
      
      let alertMessage = `Grades saved to database:\n\n✅ Successfully saved: ${successCount} course(s)\n`;
      
      if (failCount > 0) {
        alertMessage += `❌ Failed: ${failCount} course(s)\n\n`;
        alertMessage += `Failed courses:\n`;
        failedCourses.forEach(failed => {
          // Check if it's a duplicate error (409 status)
          if (failed.message && failed.message.includes("Duplicate")) {
            alertMessage += `• ${failed.course_code || 'Unknown'} - Already Uploaded\n`;
          } else {
            alertMessage += `• ${failed.course_code || 'Unknown'} - ${failed.message || 'Unknown error'}\n`;
          }
        });
      }

      Alert.alert(
        "Save Complete",
        alertMessage,
        [{ text: "OK", style: "default" }]
      );

      // Mark as no longer needing review
      setUploadedGrades(prev => prev.map(grade => 
        grade.id === selectedGrade?.id 
          ? { ...grade, needsReview: false, savedToDatabase: true }
          : grade
      ));

      if (selectedGrade?.filePath) {
        await uploadGradePdfImage(
          { ...selectedGrade, studentData },
          selectedGrade?.academicYear ?? academicYear,
          semesterLabel
        );
      }

    } catch (error) {
      console.error("Error saving grades:", error);
      Alert.alert("Save Error", error.message || "Failed to save grades to database.");
    } finally {
      setSavingGrades(false);
    }
  };


  // NEW: load official grades for view grades modal
  const loadStudentGradesFromServer = async ({ academicYear, semester }) => {
    try {
      setGradesLoading(true);
      const student = await getStudentData();
      if (!student || !student.Student_id) {
        throw new Error('Student ID not found.');
      }

      // ✅ PHP endpoint now returns ALL grades for the student.
      // Filtering/grouping is handled here in the UI.
      const url =
        `${BASE_URL}/get_student_grade.php` +
        `?student_id=${encodeURIComponent(student.Student_id)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch grades (status ${response.status})`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch grades.');
      }

      const grades = Array.isArray(data.grades) ? data.grades : [];
      setStudentGrades(grades);

      // ✅ Group all grades by AY + Semester in the UI
      const terms = groupGradesByTerm(grades);
      setGroupedGrades(terms);
      setSelectedTermIndex(0);
    } catch (error) {
      console.error('Error loading student grades:', error);
      Alert.alert('Error', error.message || 'Failed to load grades.');
    } finally {
      setGradesLoading(false);
    }
  };

  // NEW: open/close modal
  const openViewGrades = async (scope = 'single') => {
    if (scope === 'single' && !selectedTermFilter) {
      Alert.alert(
        'Select a term',
        'Please choose a term (All Terms or a specific semester) from the filter above before viewing grades.'
      );
      openTermSelectionModal();
      return;
    }

    setViewGradesScope(scope);
    setViewGradesVisible(true);
    await loadStudentGradesFromServer({
      academicYear: "2024-2025",
      semester: "FIRST",
    });
  };

  const closeViewGrades = () => {
    setViewGradesVisible(false);
    setViewGradesScope('single');
  };

  const getTermLabel = (term) => {
    if (!term) return 'Grades';
    const yearLabel = term.academicYearLabel || 'Academic Year';
    const semLabel = term.semester || '';
    return semLabel ? `${yearLabel} • ${semLabel}` : yearLabel;
  };

const GRADE_TABLE_COLUMN_WIDTHS = {
  code: 110,
  title: 260,
  units: 80,
  grade: 80,
  instructor: 200,
};

const renderGradeTablesForTerms = (terms) => (
    <ScrollView
      style={styles.viewGradesBody}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {terms.map((term) => (
        <View key={term.key} style={styles.termSection}>
          <View style={styles.termSectionHeader}>
            <Text style={styles.termSectionTitle}>{getTermLabel(term)}</Text>
            <Text style={styles.termSectionCount}>
              {term.courses.length} {term.courses.length === 1 ? 'course' : 'courses'}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={styles.gradeTable}>
              <View style={styles.gradeTableHeaderRow}>
                <Text
                  style={[
                    styles.gradeTableHeaderCell,
                    styles.gradeTableCellCenter,
                    { width: GRADE_TABLE_COLUMN_WIDTHS.code },
                  ]}
                >
                  Code
                </Text>
                <Text
                  style={[
                    styles.gradeTableHeaderCell,
                    { width: GRADE_TABLE_COLUMN_WIDTHS.title },
                  ]}
                >
                  Course Title
                </Text>
                <Text
                  style={[
                    styles.gradeTableHeaderCell,
                    styles.gradeTableCellCenter,
                    { width: GRADE_TABLE_COLUMN_WIDTHS.units },
                  ]}
                >
                  Units
                </Text>
                <Text
                  style={[
                    styles.gradeTableHeaderCell,
                    styles.gradeTableCellCenter,
                    { width: GRADE_TABLE_COLUMN_WIDTHS.grade },
                  ]}
                >
                  Grade
                </Text>
                <Text
                  style={[
                    styles.gradeTableHeaderCell,
                    { width: GRADE_TABLE_COLUMN_WIDTHS.instructor },
                  ]}
                >
                  Instructor
                </Text>
              </View>
              {term.courses.map((course, idx) => (
                <View
                  key={`${term.key}-${course.course_code}-${idx}`}
                  style={[
                    styles.gradeTableRow,
                    idx % 2 === 0
                      ? styles.gradeTableRowEven
                      : styles.gradeTableRowOdd,
                  ]}
                >
                  <Text
                    style={[
                      styles.gradeTableCell,
                      styles.gradeTableCellCenter,
                      { width: GRADE_TABLE_COLUMN_WIDTHS.code },
                    ]}
                    numberOfLines={1}
                  >
                    {course.course_code}
                  </Text>
                  <Text
                    style={[
                      styles.gradeTableCell,
                      { width: GRADE_TABLE_COLUMN_WIDTHS.title },
                    ]}
                    numberOfLines={2}
                  >
                    {course.course_title || 'N/A'}
                  </Text>
                  <Text
                    style={[
                      styles.gradeTableCell,
                      styles.gradeTableCellCenter,
                      { width: GRADE_TABLE_COLUMN_WIDTHS.units },
                    ]}
                  >
                    {course.course_units ?? ''}
                  </Text>
                  <Text
                    style={[
                      styles.gradeTableCell,
                      styles.gradeTableCellCenter,
                      { width: GRADE_TABLE_COLUMN_WIDTHS.grade },
                      styles.gradeTableGrade,
                    ]}
                  >
                    {formatGradeValue(course.grade)}
                  </Text>
                  <Text
                    style={[
                      styles.gradeTableCell,
                      { width: GRADE_TABLE_COLUMN_WIDTHS.instructor },
                    ]}
                    numberOfLines={2}
                  >
                    {course.instructor || 'N/A'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );

  const renderGradeListForTerms = (terms) => (
    <ScrollView
      style={styles.viewGradesBody}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {terms.map((term) => (
        <View key={term.key} style={styles.termSection}>
          <View style={styles.termSectionHeader}>
            <Text style={styles.termSectionTitle}>{getTermLabel(term)}</Text>
            <Text style={styles.termSectionCount}>
              {term.courses.length} {term.courses.length === 1 ? 'course' : 'courses'}
            </Text>
          </View>

          {term.courses.map((course, idx) => (
            <View
              key={`${term.key}-${course.course_code}-${idx}`}
              style={styles.gradeListItem}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.gradeListTextMain}>
                  {course.course_code}{' '}
                  {course.course_title ? `- ${course.course_title}` : ''}
                  {course.course_units ? ` (${course.course_units} units)` : ''}
                </Text>
                {course.instructor ? (
                  <Text style={styles.gradeListTextSub}>
                    {course.instructor}
                  </Text>
                ) : null}
              </View>
              <View style={styles.gradeListGradeWrapper}>
                <Text style={styles.gradeListGradeText}>
                  {formatGradeValue(course.grade)}
                </Text>
                {course.remarks === 'PASSED' && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#16A34A"
                    style={{ marginTop: 2 }}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload Grades</Text>
        </View>

        {/* Term filter + quick actions (adapted from portal UI) */}
        <View style={styles.termCardWrapper}>
          <View style={styles.termCard}>
            {/* Term dropdown */}
            <View style={styles.termFilterRow}>
              <TouchableOpacity
                style={styles.termFilterButton}
                onPress={openTermSelectionModal}
              >
                <Ionicons name="funnel-outline" size={16} color="#4B5563" />
                <Text style={styles.termFilterText}>{selectedTermLabel}</Text>
                <Ionicons
                  name="chevron-down-outline"
                  size={16}
                  color="#4B5563"
                />
              </TouchableOpacity>
            </View>

            {/* Quick action row similar to web UI */}
            <View style={styles.gradeMenuRow}>
              <TouchableOpacity
                style={[
                  styles.gradeMenuItem,
                  !selectedTermFilter && styles.gradeMenuItemDisabled,
                ]}
                onPress={() => openViewGrades('single')}   // UPDATED: open official view grades modal
              >
                <View style={styles.gradeMenuIconCircle}>
                  <Ionicons name="document-text-outline" size={20} color="#1B5E20" />
                </View>
                <Text style={styles.gradeMenuLabel}>Grades</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gradeMenuItem}
                onPress={() => openViewGrades('all')}
              >
                <View style={styles.gradeMenuIconCircle}>
                  <Ionicons name="book-outline" size={20} color="#1B5E20" />
                </View>
                <Text style={styles.gradeMenuLabel}>View All Grades</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.gradeMenuItem,
                  (!selectedTermFilter || selectedTermFilter === 'ALL') &&
                    styles.gradeMenuItemDisabled,
                ]}
                onPress={handleOpenGradeImages}
              >
                <View style={styles.gradeMenuIconCircle}>
                  <Ionicons name="copy-outline" size={20} color="#1B5E20" />
                </View>
                <Text style={styles.gradeMenuLabel}>View Copy of Grades</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Upload Grade Document (COG)</Text>
          
          {/* File Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>File Requirements:</Text>
            <Text style={styles.requirementText}>• Accepted format: PDF only</Text>
            <Text style={styles.requirementText}>• Make sure the file is clear, complete, and official</Text>
            <Text style={styles.requirementText}>• Example filename: Lastname_Firstname_COG.pdf</Text>
          </View>
          
          {/* Upload Button */}
          <TouchableOpacity 
            style={[styles.uploadButton, ocrLoading && styles.uploadButtonDisabled]} 
            onPress={handleUploadGrades}
            disabled={ocrLoading}
          >
            {ocrLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.uploadButtonText}>Processing...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="cloud-upload-outline" size={24} color="#FFF" />
                <Text style={styles.uploadButtonText}>Upload Grade Document</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Grade Details Modal */}
      <Modal
        visible={showGradeDetails}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Grade Details</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowGradeDetails(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {selectedGrade && (() => {
            const gradeData = parseGradeData(
              selectedGrade.extractedText,
              selectedGrade.gradeWebList ||
                parseGradeListFromText(selectedGrade.gradeWebpageText || "")
            );
            
            return (
              <View style={styles.modalContentWrapper}>
                <ScrollView style={styles.modalContent}>
                  {/* Basic Information */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Academic Year:</Text>
                      <Text style={styles.infoValue}>{selectedGrade.academicYear || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Semester:</Text>
                      <Text style={styles.infoValue}>{selectedGrade.semester || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Year Level:</Text>
                      <Text style={styles.infoValue}>{selectedGrade.yearLevel || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Upload Date:</Text>
                      <Text style={styles.infoValue}>
                        {new Date(selectedGrade.uploadDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  {/* Courses Table - Show detailed courses and grades with curriculum validation */}
                  {gradeData.courses.length > 0 ? (
                    <View style={styles.tableSection}>
                      <Text style={styles.tableSectionTitle}>Course Details ({gradeData.courses.length} courses)</Text>
                      
                      {/* Horizontally Scrollable Table Container */}
                      <View style={styles.scrollableTableContainer}>
                        <ScrollView 
                          horizontal={true}
                          showsHorizontalScrollIndicator={true}
                          style={styles.horizontalScrollView}
                        >
                          <View style={styles.tableContent}>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                              <Text style={[styles.tableHeaderText, styles.codeColumnWide]}>Course Code</Text>
                              <Text style={[styles.tableHeaderText, styles.titleColumnWide]}>Course Title</Text>
                              <Text style={[styles.tableHeaderText, styles.unitsColumnWide]}>Units</Text>
                              <Text style={[styles.tableHeaderText, styles.gradeColumnWide]}>Grade</Text>
                              <Text style={[styles.tableHeaderText, styles.statusColumnWide]}>Status</Text>
                              <Text style={[styles.tableHeaderText, styles.matchColumnWide]}>Curriculum Match</Text>
                              <Text style={[styles.tableHeaderText, styles.sectionColumnWide]}>Section</Text>
                              <Text style={[styles.tableHeaderText, styles.instructorColumnWide]}>Instructor</Text>
                            </View>
                            
                            {/* Vertically Scrollable Table Content */}
                            <ScrollView 
                              style={styles.tableScrollView}
                              showsVerticalScrollIndicator={true}
                              nestedScrollEnabled={true}
                            >
                              {gradeData.courses.map((course, index) => {
                                // Find validation info for this course
                                const matchedCourse = selectedGrade.validationResults?.matchedCourses?.find(
                                  mc => mc.courseCode === course.courseCode
                                );
                                const unmatchedCourse = selectedGrade.validationResults?.unmatchedCourses?.find(
                                  uc => uc.courseCode === course.courseCode
                                );
                                
                                const isMatched = !!matchedCourse;
                                const gradeStatus = getGradeStatus(course.grade);
                                const fallbackSuggestion = !isMatched ? unmatchedCourse?.suggestedMatches?.[0] : null;
                                const treatedMatched = isMatched || !!fallbackSuggestion;
                                const displayCourseCode = fallbackSuggestion?.courseCode || course.courseCode;
                                const displayCourseTitle = fallbackSuggestion?.courseTitle || course.courseTitle;
                                const displayUnits = fallbackSuggestion?.units ?? course.units;
                                
                                return (
                                  <View key={index} style={[
                                    styles.tableRow, 
                                    index % 2 === 0 ? styles.evenRow : styles.oddRow,
                                    !treatedMatched && styles.unmatchedRow
                                  ]}>
                                    <Text style={[styles.tableCellText, styles.codeColumnWide]} numberOfLines={2}>
                                      {displayCourseCode}
                                    </Text>
                                    <Text style={[styles.tableCellText, styles.titleColumnWide]} numberOfLines={3}>
                                      {displayCourseTitle}
                                    </Text>
                                    <Text style={[styles.tableCellText, styles.unitsColumnWide]}>
                                      {displayUnits}
                                    </Text>
                                    <Text style={[styles.tableCellText, styles.gradeColumnWide, styles.gradeText]}>
                                      {course.grade}
                                    </Text>
                                    <Text style={[
                                      styles.tableCellText, 
                                      styles.statusColumnWide,
                                      gradeStatus === 'PASSED' ? styles.passedStatus : 
                                      gradeStatus === 'FAIL' ? styles.failedStatus : 
                                      gradeStatus === 'INC' ? styles.incStatus : styles.unknownStatus
                                    ]}>
                                      {gradeStatus}
                                    </Text>
                                    <View style={[styles.tableCellText, styles.matchColumnWide]}>
                                      {treatedMatched ? (
                                        <View style={styles.matchedIndicator}>
                                          <Text style={styles.matchedText}>✅ MATCHED</Text>
                                          {(matchedCourse?.matchStrategy || fallbackSuggestion) && (
                                            <Text style={styles.matchStrategyText}>
                                              ({matchedCourse?.matchStrategy || 'suggested'})
                                            </Text>
                                          )}
                                          {(matchedCourse?.curriculumCourseCode || fallbackSuggestion?.courseCode) && (matchedCourse?.curriculumCourseCode !== course.courseCode || fallbackSuggestion) && (
                                            <Text style={styles.curriculumCodeText}>
                                              Curriculum: {matchedCourse?.curriculumCourseCode || fallbackSuggestion?.courseCode}
                                            </Text>
                                          )}
                                        </View>
                                      ) : (
                                        <View style={styles.unmatchedIndicator}>
                                          <Text style={styles.unmatchedText}>❌ NOT FOUND</Text>
                                          {(() => {
                                            const suggestion = unmatchedCourse?.suggestedMatches?.[0];
                                            if (!suggestion) return null;
                                            return (
                                              <>
                                                <Text style={styles.suggestionText}>
                                                  Similar Code: {suggestion.courseCode || 'N/A'}
                                                </Text>
                                                {suggestion.courseTitle ? (
                                                  <Text style={styles.suggestionText}>
                                                    Title: {suggestion.courseTitle}
                                                  </Text>
                                                ) : null}
                                                {suggestion.units ? (
                                                  <Text style={styles.suggestionText}>
                                                    Units: {suggestion.units}
                                                  </Text>
                                                ) : null}
                                              </>
                                            );
                                          })()}
                                        </View>
                                      )}
                                    </View>
                                    <Text style={[styles.tableCellText, styles.sectionColumnWide]} numberOfLines={2}>
                                      {course.section}
                                    </Text>
                                    <Text style={[styles.tableCellText, styles.instructorColumnWide]} numberOfLines={2}>
                                      {course.instructor}
                                    </Text>
                                  </View>
                                );
                              })}
                            </ScrollView>
                          </View>
                        </ScrollView>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noDataSection}>
                      <Text style={styles.noDataText}>No course data could be extracted from this document.</Text>
                      <Text style={styles.noDataSubtext}>Please ensure the document contains a clear grade table.</Text>
                    </View>
                  )}

                  {/* GWA Summary - Show after detailed courses */}
                  {gradeData.gwa && (
                    <View style={styles.gwaSection}>
                      <Text style={styles.gwaSectionTitle}>Academic Summary</Text>
                      <View style={styles.gwaCard}>
                        <View style={styles.gwaRow}>
                          <Text style={styles.gwaLabel}>General Weighted Average (GWA):</Text>
                          <Text style={styles.gwaValue}>{gradeData.gwa.toFixed(4)}</Text>
                        </View>
                        {gradeData.totalCourses && (
                          <View style={styles.gwaRow}>
                            <Text style={styles.gwaLabel}>Total Courses:</Text>
                            <Text style={styles.gwaValue}>{gradeData.totalCourses}</Text>
                          </View>
                        )}
                        {gradeData.totalUnits && (
                          <View style={styles.gwaRow}>
                            <Text style={styles.gwaLabel}>Total Units:</Text>
                            <Text style={styles.gwaValue}>{gradeData.totalUnits}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                  
                  {/* Bottom spacing to prevent content from touching screen bottom */}
                  <View style={styles.bottomSpacing} />
                </ScrollView>

                {/* Save Button and Status at Bottom */}
                <View style={styles.modalFooter}>
                  {selectedGrade?.savedToDatabase ? (
                    <View style={styles.savedIndicator}>
                      <Ionicons name="checkmark-circle" size={20} color="#28A745" />
                      <Text style={styles.savedText}>Grades have been uploaded</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={[
                        styles.confirmButton,
                        savingGrades && styles.buttonDisabled
                      ]}
                      onPress={() => handleSaveGradesToDatabase(selectedGrade)}
                      disabled={savingGrades}
                    >
                      {savingGrades ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="#FFF" />
                          <Text style={styles.buttonText}>Uploading...</Text>
                        </View>
                      ) : (
                        <View style={styles.buttonContent}>
                          <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                          <Text style={styles.buttonText}>Confirm & Upload</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* View Grades Modal (official grades from backend) */}
      <Modal
        visible={viewGradesVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeViewGrades}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {viewGradesScope === 'all'
                ? 'All Grades'
                : (() => {
                    const term = groupedGrades[selectedTermIndex];
                    if (!term) return 'Grades';
                    const yearLabel = term.academicYearLabel || 'Academic Year';
                    const semLabel = term.semester || '';
                    return `Grades — ${yearLabel}${semLabel ? ` • ${semLabel}` : ''}`;
                  })()}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={closeViewGrades}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {gradesLoading ? (
            <View style={styles.viewGradesLoadingContainer}>
              <ActivityIndicator size="large" color="#DC143C" />
              <Text style={styles.viewGradesLoadingText}>Loading grades...</Text>
            </View>
          ) : groupedGrades.length === 0 ? (
            <View style={styles.viewGradesEmptyContainer}>
              <Text style={styles.viewGradesEmptyText}>No grades found.</Text>
              <Text style={styles.viewGradesEmptySubtext}>
                Upload your COG or check back later.
              </Text>
            </View>
          ) : (
            <View style={styles.viewGradesContentWrapper}>
              {/* View mode toggle */}
              <View style={styles.viewModeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.viewModeButton,
                    gradeViewMode === 'list' && styles.viewModeButtonActive,
                  ]}
                  onPress={() => setGradeViewMode('list')}
                >
                  <Ionicons
                    name="list-outline"
                    size={16}
                    color={gradeViewMode === 'list' ? '#DC143C' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.viewModeButtonText,
                      gradeViewMode === 'list' && styles.viewModeButtonTextActive,
                    ]}
                  >
                    List View
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.viewModeButton,
                    gradeViewMode === 'table' && styles.viewModeButtonActive,
                  ]}
                  onPress={() => setGradeViewMode('table')}
                >
                  <Ionicons
                    name="grid-outline"
                    size={16}
                    color={gradeViewMode === 'table' ? '#DC143C' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.viewModeButtonText,
                      gradeViewMode === 'table' && styles.viewModeButtonTextActive,
                    ]}
                  >
                    Table View
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.viewGradesBody}>
                {(() => {
                  const selectedTerm = groupedGrades[selectedTermIndex];
                  const termsToRender =
                    viewGradesScope === 'all'
                      ? groupedGrades
                      : selectedTerm
                      ? [selectedTerm]
                      : [];

                  if (termsToRender.length === 0) {
                    return (
                      <View style={styles.viewGradesEmptyContainer}>
                        <Text style={styles.viewGradesEmptyText}>
                          No grade data available.
                        </Text>
                        <Text style={styles.viewGradesEmptySubtext}>
                          Upload a grade document or try another filter.
                        </Text>
                      </View>
                    );
                  }

                  return gradeViewMode === 'table'
                    ? renderGradeTablesForTerms(termsToRender)
                    : renderGradeListForTerms(termsToRender);
                })()}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Term selection modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetFilterModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Academic Year & Semester</Text>
            <TouchableOpacity style={styles.closeButton} onPress={resetFilterModal}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          {filterModalLoading ? (
            <View style={styles.viewGradesLoadingContainer}>
              <ActivityIndicator size="large" color="#DC143C" />
              <Text style={styles.viewGradesLoadingText}>Loading available terms...</Text>
            </View>
          ) : filterModalError ? (
            <View style={styles.viewGradesEmptyContainer}>
              <Text style={styles.viewGradesEmptyText}>Unable to load filter options.</Text>
              <Text style={styles.viewGradesEmptySubtext}>{filterModalError}</Text>
            </View>
          ) : !availableFilterYears.length ? (
            <View style={styles.viewGradesEmptyContainer}>
              <Text style={styles.viewGradesEmptyText}>No terms available.</Text>
              <Text style={styles.viewGradesEmptySubtext}>
                Upload a grade document first or try again later.
              </Text>
            </View>
          ) : (
            <View style={styles.filterModalContent}>
              <View style={styles.filterField}>
                <Text style={styles.filterLabel}>Academic Year</Text>
                <TouchableOpacity
                  style={styles.filterDropdown}
                  onPress={() => {
                    setShowFilterYearDropdown((prev) => !prev);
                    setShowFilterSemesterDropdown(false);
                  }}
                >
                  <Text style={styles.filterDropdownText}>
                    {selectedFilterYearOption || 'Select academic year'}
                  </Text>
                  <Ionicons
                    name={showFilterYearDropdown ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={16}
                    color="#4B5563"
                  />
                </TouchableOpacity>
                {showFilterYearDropdown && (
                  <View style={styles.filterDropdownList}>
                    {availableFilterYears.map((year) => (
                      <TouchableOpacity
                        key={year}
                        style={styles.filterDropdownItem}
                        onPress={() => {
                          setSelectedFilterYearOption(year);
                          setSelectedFilterSemesterOption(
                            availableFilterSemesters[year]?.[0] || null
                          );
                          setShowFilterYearDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.filterDropdownOptionText,
                            selectedFilterYearOption === year &&
                              styles.filterDropdownOptionTextActive,
                          ]}
                        >
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.filterField}>
                <Text style={styles.filterLabel}>Semester</Text>
                <TouchableOpacity
                  style={styles.filterDropdown}
                  onPress={() => {
                    if (selectedFilterYearOption) {
                      setShowFilterSemesterDropdown((prev) => !prev);
                    }
                  }}
                >
                  <Text style={styles.filterDropdownText}>
                    {selectedFilterSemesterOption || 'Select semester'}
                  </Text>
                  <Ionicons
                    name={
                      showFilterSemesterDropdown ? 'chevron-up-outline' : 'chevron-down-outline'
                    }
                    size={16}
                    color="#4B5563"
                  />
                </TouchableOpacity>
                {showFilterSemesterDropdown && selectedFilterYearOption && (
                  <View style={styles.filterDropdownList}>
                    {(availableFilterSemesters[selectedFilterYearOption] || []).map((sem) => (
                      <TouchableOpacity
                        key={`${selectedFilterYearOption}-${sem}`}
                        style={styles.filterDropdownItem}
                        onPress={() => {
                          setSelectedFilterSemesterOption(sem);
                          setShowFilterSemesterDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.filterDropdownOptionText,
                            selectedFilterSemesterOption === sem &&
                              styles.filterDropdownOptionTextActive,
                          ]}
                        >
                          {sem}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <Text style={styles.filterExampleText}>
                Example: {selectedFilterYearOption || '2023-2024'}{' '}
                {selectedFilterSemesterOption || 'FIRST'}
              </Text>
              <View style={styles.filterModalFooter}>
                <TouchableOpacity
                  style={styles.filterCancelButton}
                  onPress={resetFilterModal}
                >
                  <Text style={styles.filterCancelText}>Cancel</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity
                    style={styles.filterOutlineButton}
                    onPress={() => {
                      setSelectedTermFilter('ALL');
                      resetFilterModal();
                    }}
                  >
                    <Text style={styles.filterOutlineText}>All Terms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterApplyButton,
                      (!selectedFilterYearOption || !selectedFilterSemesterOption) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={applyFilterSelection}
                    disabled={!selectedFilterYearOption || !selectedFilterSemesterOption}
                  >
                    <Text style={styles.filterApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Grade Copy Modal */}
      <Modal
        visible={gradeImagesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseGradeImages}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedTermFilter === 'ALL'
                ? 'Grade Copies — All Terms'
                : `Grade Copy — ${selectedTermFilter || ''}`}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseGradeImages}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {gradeImagesLoading ? (
            <View style={styles.viewGradesLoadingContainer}>
              <ActivityIndicator size="large" color="#DC143C" />
              <Text style={styles.viewGradesLoadingText}>Loading grade copy...</Text>
            </View>
          ) : gradeImagesError ? (
            <View style={styles.viewGradesEmptyContainer}>
              <Text style={styles.viewGradesEmptyText}>Unable to load grade copy.</Text>
              <Text style={styles.viewGradesEmptySubtext}>{gradeImagesError}</Text>
            </View>
          ) : filteredGradeImages.length === 0 ? (
            <View style={styles.viewGradesEmptyContainer}>
              <Text style={styles.viewGradesEmptyText}>No grade copy found for this term.</Text>
              <Text style={styles.viewGradesEmptySubtext}>
                Upload a grade document first or choose another term.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.viewGradesBody}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            >
              {filteredGradeImages.map((record) => {
                const imageUri = `data:image/png;base64,${record.image_base64}`;
                return (
                  <View key={record.grades_id} style={styles.gradeImageCard}>
                        <View style={styles.gradeImageMetaRow}>
                          <Text style={styles.gradeImageMetaTitle}>
                            AY {record.academic_year} • {record.sem}
                          </Text>
                        </View>
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.gradeImagePreview}
                          resizeMode="contain"
                        />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Hidden PDF capture surface */}
      <View pointerEvents="none" style={styles.hiddenPdfCapture}>
        <ViewShot
          ref={pdfCaptureRef}
          options={{ format: 'jpg', quality: 1, result: 'tmpfile' }}
          collapsable={false}
          style={styles.hiddenPdf}
        >
          {pdfCaptureGrade ? (
            <Pdf
              key={pdfCaptureGrade.captureKey}
              source={{ uri: pdfCaptureGrade.filePath }}
              style={styles.hiddenPdf}
              page={1}
              singlePage
              onLoadComplete={handleHiddenPdfLoadComplete}
              onError={handleHiddenPdfError}
              trustAllCerts
              collapsable={false}
            />
          ) : (
            <View style={styles.hiddenPdfPlaceholder} />
          )}
        </ViewShot>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30, // Extra padding at bottom for better scrolling
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC143C',
  },

  /* NEW styles for term header & quick actions */
  termCardWrapper: {
    backgroundColor: '#7B0010',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  termCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  termFilterRow: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  termFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termFilterText: {
    marginHorizontal: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  gradeMenuRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gradeMenuItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  gradeMenuItemDisabled: {
    opacity: 0.5,
  },
  gradeMenuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1B5E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  gradeMenuLabel: {
    fontSize: 11,
    color: '#111827',
    textAlign: 'center',
  },

  uploadSection: {
    backgroundColor: '#FFF',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
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
  validationSection: {
    marginBottom: 20,
  },
  validationSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 10,
  },
  validationSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  validationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  validationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  validationValue: {
    fontSize: 14,
    color: '#212529',
    fontWeight: 'bold',
  },
  matchedText: {
    fontSize: 10,
    color: '#28A745',
    fontWeight: 'bold',
  },
  unmatchedText: {
    fontSize: 10,
    color: '#DC3545',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#28A745',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  duplicateSection: {
    marginBottom: 15,
  },
  duplicateSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 10,
  },
  duplicateContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  duplicateText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
    fontWeight: '600',
  },
  duplicateItem: {
    marginLeft: 10,
    marginBottom: 4,
  },
  duplicateItemText: {
    fontSize: 13,
    color: '#856404',
  },
  duplicateNote: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
    marginTop: 8,
  },
  reviewButton: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#28A745',
  },
  savedText: {
    fontSize: 14,
    color: '#155724',
    marginLeft: 8,
    fontWeight: '600',
  },
  curriculumInfoSection: {
    marginBottom: 20,
  },
  curriculumInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 10,
  },
  curriculumInfoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  curriculumInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  curriculumInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    flex: 1,
  },
  curriculumInfoValue: {
    fontSize: 14,
    color: '#0D47A1',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginTop: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDropdownItem: {
    color: '#DC143C',
    fontWeight: 'bold',
  },
  customYearContainer: {
    marginBottom: 15,
  },
  customYearInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  uploadButton: {
    backgroundColor: '#DC143C',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  uploadButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  gradeDetailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
  },
  extractedTextContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 15,
    maxHeight: 300,
    marginTop: 5,
  },
  extractedText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  // New styles for enhanced grade details
  infoSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#212529',
    flex: 2,
    textAlign: 'right',
  },
  gwaSection: {
    marginBottom: 20,
  },
  gwaSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 10,
  },
  gwaCard: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gwaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gwaLabel: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  gwaValue: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  tableSection: {
    marginBottom: 20,
  },
  tableSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#DC143C',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  evenRow: {
    backgroundColor: '#F8F9FA',
  },
  oddRow: {
    backgroundColor: '#FFF',
  },
  tableCellText: {
    fontSize: 11,
    color: '#495057',
    textAlign: 'center',
  },
  codeColumn: {
    flex: 1,
  },
  titleColumn: {
    flex: 2.5,
    textAlign: 'left',
    paddingLeft: 8,
  },
  unitsColumn: {
    flex: 0.6,
  },
  gradeColumn: {
    flex: 0.6,
  },
  sectionColumn: {
    flex: 1,
  },
  instructorColumn: {
    flex: 2,
    textAlign: 'left',
    paddingLeft: 4,
  },
  // Wide column styles for horizontal scrolling
  codeColumnWide: {
    width: 100,
    paddingHorizontal: 8,
  },
  titleColumnWide: {
    width: 250,
    textAlign: 'left',
    paddingHorizontal: 8,
  },
  unitsColumnWide: {
    width: 60,
    paddingHorizontal: 8,
  },
  gradeColumnWide: {
    width: 70,
    paddingHorizontal: 8,
  },
  statusColumnWide: {
    width: 80,
    paddingHorizontal: 8,
  },
  matchColumnWide: {
    width: 180,
    paddingHorizontal: 8,
  },
  sectionColumnWide: {
    width: 90,
    paddingHorizontal: 8,
  },
  instructorColumnWide: {
    width: 200,
    textAlign: 'left',
    paddingHorizontal: 8,
  },
  unmatchedRow: {
    backgroundColor: '#FFEBEE',
  },
  passedStatus: {
    color: '#28A745',
    fontWeight: 'bold',
  },
  failedStatus: {
    color: '#DC3545',
    fontWeight: 'bold',
  },
  incStatus: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  unknownStatus: {
    color: '#6C757D',
    fontWeight: 'bold',
  },
  matchedIndicator: {
    alignItems: 'center',
  },
  unmatchedIndicator: {
    alignItems: 'center',
  },
  matchStrategyText: {
    fontSize: 8,
    color: '#6C757D',
    fontStyle: 'italic',
  },
  curriculumCodeText: {
    fontSize: 8,
    color: '#495057',
    textAlign: 'center',
  },
  suggestionText: {
    fontSize: 8,
    color: '#FF9800',
    textAlign: 'center',
  },
  gradeText: {
    fontWeight: 'bold',
    color: '#DC143C',
  },
  noDataSection: {
    padding: 20,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 10,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scrollableTableContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  horizontalScrollView: {
    backgroundColor: '#FFF',
  },
  tableContent: {
    minWidth: 1100, // Increased width to accommodate new columns (Status + Curriculum Match)
  },
  tableScrollView: {
    maxHeight: 400,
    backgroundColor: '#FFF',
  },
  bottomSpacing: {
    height: 30,
    marginBottom: 20,
  },
  modalContentWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  modalFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  confirmButton: {
    backgroundColor: '#DC143C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  /* NEW styles for View Grades modal (official grades) */
  viewGradesLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewGradesLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  viewGradesEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  viewGradesEmptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  viewGradesEmptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  viewGradesContentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  viewModeButtonActive: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  viewModeButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  viewModeButtonTextActive: {
    color: '#B91C1C',
  },
  viewGradesBody: {
    flex: 1,
    marginTop: 8,
  },
  filterModalContent: {
    flex: 1,
    padding: 20,
  },
  filterField: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  filterDropdown: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  filterDropdownText: {
    fontSize: 14,
    color: '#111827',
  },
  filterDropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    maxHeight: 200,
  },
  filterDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterDropdownOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  filterDropdownOptionTextActive: {
    fontWeight: '700',
    color: '#B91C1C',
  },
  filterExampleText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 20,
  },
  filterModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  filterCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterCancelText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  filterOutlineButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 10,
  },
  filterOutlineText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  filterApplyButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  filterApplyText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  termSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  termSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  termSectionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  gradeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  gradeListTextMain: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  gradeListTextSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  gradeListGradeWrapper: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  gradeListGradeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  gradeTable: {
    minWidth: 730,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  gradeTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#DC143C',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  gradeTableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 4,
  },
  gradeTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  gradeTableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  gradeTableRowOdd: {
    backgroundColor: '#FFFFFF',
  },
  gradeTableCell: {
    fontSize: 12,
    color: '#111827',
    paddingHorizontal: 4,
    textAlign: 'left',
    flexShrink: 0,
  },
  gradeTableCellCenter: {
    textAlign: 'center',
  },
  gradeTableCellRight: {
    textAlign: 'right',
  },
  gradeTableGrade: {
    fontWeight: '700',
    color: '#DC143C',
  },
  gradeImageCard: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  gradeImageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gradeImageMetaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  gradeImagePreview: {
    width: '100%',
    height: 450,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  hiddenPdfCapture: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.01,
    zIndex: -1,
  },
  hiddenPdf: {
    width: 900,
    height: 1200,
  },
  hiddenPdfPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF',
  },
});

export default UploadGrades;





