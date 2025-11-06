import React, { useState, useEffect } from 'react';
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
} from 'react-native';
// Removed Picker import - using custom dropdown instead
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

// OCR Backend function for grade extraction
const runGradeOCRBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "grades.pdf",
      type: "application/pdf",
    });

    const response = await fetch("http://192.168.254.114:5000/ocr/direct", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Grade OCR failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.full_text || "No text detected";
  } catch (err) {
    console.error("runGradeOCRBackend error:", err);
    throw err;
  }
};

// File picker for grade documents
const pickGradeFile = async (semester, academicYear, setUploadedGrades, setOcrLoading) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    // Handle both old and new DocumentPicker API formats
    const fileInfo = result.assets ? result.assets[0] : result;
    console.log('DocumentPicker result:', result);
    console.log('File info:', fileInfo);
    
    let { uri: fileUri, name: fileName } = fileInfo;
    
    // Handle case where fileName might be undefined - generate a fallback name
    if (!fileName) {
      console.warn('fileName is undefined, generating fallback name');
      fileName = `grade_document_${Date.now()}.pdf`;
    }
    
    console.log('Selected file:', fileName, 'URI:', fileUri);
    
    // Safely get file extension
    const fileExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';
    
    if (fileExtension !== 'pdf') {
      Alert.alert("Invalid File", "Please select a PDF file.");
      return;
    }

    // Create directory for grades if it doesn't exist
    const gradesDir = `${FileSystem.documentDirectory}grades/`;
    await FileSystem.makeDirectoryAsync(gradesDir, { intermediates: true });

    // Create filename with semester and academic year
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFileName = `grades_${semester}_${academicYear}_${timestamp}.pdf`;
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
      
      // Create grade record
      const gradeRecord = {
        id: timestamp,
        semester,
        academicYear,
        fileName: newFileName,
        filePath: newPath,
        extractedText,
        uploadDate: new Date().toISOString(),
      };

      // Update uploaded grades
      setUploadedGrades(prev => [...prev, gradeRecord]);

      Alert.alert("Success", `${fileName} uploaded successfully for ${semester} ${academicYear}!`);
    } catch (error) {
      console.error("Grade OCR extraction error:", error);
      Alert.alert("OCR Error", error.message || "Failed to extract text from grades. Please ensure the OCR server is running.");
    } finally {
      setOcrLoading(false);
    }

  } catch (error) {
    console.error("File picker error:", error);
    Alert.alert("Error", "Failed to upload file. Please try again.");
  }
};

const UploadGrades = ({ navigation }) => {
  const [selectedSemester, setSelectedSemester] = useState('1st Semester');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-2025');
  const [customAcademicYear, setCustomAcademicYear] = useState('');
  const [showCustomYear, setShowCustomYear] = useState(false);
  const [uploadedGrades, setUploadedGrades] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showGradeDetails, setShowGradeDetails] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [showSemesterPicker, setShowSemesterPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Academic year options
  const academicYears = [
    '2024-2025',
    '2023-2024',
    '2022-2023',
    '2021-2022',
    '2020-2021',
    'Custom'
  ];

  // Semester options
  const semesters = [
    '1st Semester',
    '2nd Semester',
    'Summer'
  ];

  // Load uploaded grades on component mount
  useEffect(() => {
    loadUploadedGrades();
  }, []);

  const loadUploadedGrades = async () => {
    try {
      const gradesDir = `${FileSystem.documentDirectory}grades/`;
      const dirExists = await FileSystem.getInfoAsync(gradesDir);
      
      if (dirExists.exists) {
        const files = await FileSystem.readDirectoryAsync(gradesDir);
        // You can implement loading saved grade records from AsyncStorage here
        console.log('Grades directory files:', files);
      }
    } catch (error) {
      console.error('Error loading grades:', error);
    }
  };

  const handleUploadGrades = () => {
    const yearToUse = showCustomYear ? customAcademicYear : selectedAcademicYear;
    
    if (!yearToUse.trim()) {
      Alert.alert("Error", "Please select or enter an academic year.");
      return;
    }

    if (showCustomYear && !customAcademicYear.match(/^\d{4}-\d{4}$/)) {
      Alert.alert("Error", "Please enter academic year in format: YYYY-YYYY (e.g., 2024-2025)");
      return;
    }

    pickGradeFile(selectedSemester, yearToUse, setUploadedGrades, setOcrLoading);
  };

  const viewGradeDetails = (grade) => {
    setSelectedGrade(grade);
    setShowGradeDetails(true);
  };

  const deleteGrade = async (gradeId) => {
    Alert.alert(
      "Delete Grade",
      "Are you sure you want to delete this grade record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const gradeToDelete = uploadedGrades.find(g => g.id === gradeId);
              if (gradeToDelete) {
                // Delete file
                await FileSystem.deleteAsync(gradeToDelete.filePath, { idempotent: true });
                // Remove from state
                setUploadedGrades(prev => prev.filter(g => g.id !== gradeId));
                Alert.alert("Success", "Grade record deleted successfully.");
              }
            } catch (error) {
              console.error('Error deleting grade:', error);
              Alert.alert("Error", "Failed to delete grade record.");
            }
          }
        }
      ]
    );
  };

  const closeDropdowns = () => {
    setShowSemesterPicker(false);
    setShowYearPicker(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.container} 
        activeOpacity={1} 
        onPress={closeDropdowns}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Grades</Text>
        </View>

        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Select Semester & Academic Year</Text>
          
          {/* Semester Picker */}
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Semester:</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowSemesterPicker(!showSemesterPicker)}
            >
              <Text style={styles.dropdownButtonText}>{selectedSemester}</Text>
              <Ionicons 
                name={showSemesterPicker ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            {showSemesterPicker && (
              <View style={styles.dropdownList}>
                {semesters.map((semester) => (
                  <TouchableOpacity
                    key={semester}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedSemester(semester);
                      setShowSemesterPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      selectedSemester === semester && styles.selectedDropdownItem
                    ]}>
                      {semester}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Academic Year Picker */}
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Academic Year:</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowYearPicker(!showYearPicker)}
            >
              <Text style={styles.dropdownButtonText}>
                {showCustomYear ? 'Custom' : selectedAcademicYear}
              </Text>
              <Ionicons 
                name={showYearPicker ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            {showYearPicker && (
              <View style={styles.dropdownList}>
                {academicYears.map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={styles.dropdownItem}
                    onPress={() => {
                      if (year === 'Custom') {
                        setShowCustomYear(true);
                      } else {
                        setShowCustomYear(false);
                        setSelectedAcademicYear(year);
                      }
                      setShowYearPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      ((showCustomYear && year === 'Custom') || 
                       (!showCustomYear && selectedAcademicYear === year)) && 
                      styles.selectedDropdownItem
                    ]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Custom Academic Year Input */}
          {showCustomYear && (
            <View style={styles.customYearContainer}>
              <Text style={styles.pickerLabel}>Enter Academic Year:</Text>
              <TextInput
                style={styles.customYearInput}
                value={customAcademicYear}
                onChangeText={setCustomAcademicYear}
                placeholder="e.g., 2024-2025"
                placeholderTextColor="#999"
              />
            </View>
          )}

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

        {/* Uploaded Grades List */}
        {uploadedGrades.length > 0 && (
          <View style={styles.gradesSection}>
            <Text style={styles.sectionTitle}>Uploaded Grades</Text>
            {uploadedGrades.map((grade) => (
              <View key={grade.id} style={styles.gradeCard}>
                <View style={styles.gradeHeader}>
                  <View style={styles.gradeInfo}>
                    <Text style={styles.gradeSemester}>{grade.semester}</Text>
                    <Text style={styles.gradeYear}>{grade.academicYear}</Text>
                  </View>
                  <View style={styles.gradeActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => viewGradeDetails(grade)}
                    >
                      <Ionicons name="eye-outline" size={20} color="#2E7D32" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteGrade(grade.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.gradeFileName}>{grade.fileName}</Text>
                <Text style={styles.gradeDate}>
                  Uploaded: {new Date(grade.uploadDate).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
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
          
          {selectedGrade && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.gradeDetailSection}>
                <Text style={styles.detailLabel}>Semester:</Text>
                <Text style={styles.detailValue}>{selectedGrade.semester}</Text>
              </View>
              
              <View style={styles.gradeDetailSection}>
                <Text style={styles.detailLabel}>Academic Year:</Text>
                <Text style={styles.detailValue}>{selectedGrade.academicYear}</Text>
              </View>
              
              <View style={styles.gradeDetailSection}>
                <Text style={styles.detailLabel}>File Name:</Text>
                <Text style={styles.detailValue}>{selectedGrade.fileName}</Text>
              </View>
              
              <View style={styles.gradeDetailSection}>
                <Text style={styles.detailLabel}>Upload Date:</Text>
                <Text style={styles.detailValue}>
                  {new Date(selectedGrade.uploadDate).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.gradeDetailSection}>
                <Text style={styles.detailLabel}>Extracted Text:</Text>
                <ScrollView style={styles.extractedTextContainer}>
                  <Text style={styles.extractedText}>
                    {selectedGrade.extractedText || "No text extracted"}
                  </Text>
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
      </TouchableOpacity>
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
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
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
    color: '#2E7D32',
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
    backgroundColor: '#2E7D32',
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
  gradesSection: {
    margin: 20,
    marginTop: 0,
  },
  gradeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeInfo: {
    flex: 1,
  },
  gradeSemester: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  gradeYear: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  gradeActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  gradeFileName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  gradeDate: {
    fontSize: 12,
    color: '#999',
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
});

export default UploadGrades;
