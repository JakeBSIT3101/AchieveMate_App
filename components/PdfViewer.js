import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import * as Sharing from 'expo-sharing';

export default function PdfViewer({ visible, uri, onClose }) {
  if (!uri) return null;

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        alert('Sharing is not available on this device.');
      }
    } catch (e) {
      console.warn('Share failed', e);
      alert('Unable to share file.');
    }
  };

  const source = { uri, cache: true };
  const { height } = Dimensions.get('window');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PDF Preview</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
      <Pdf
        source={source}
        style={[styles.pdf, { height: height - 64 }]}
        onError={(e) => console.log('PDF render error', e)}
        onLoadComplete={(n) => console.log('PDF loaded pages:', n)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: '#2c7be5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerButton: { padding: 8 },
  headerButtonText: { color: '#fff', fontWeight: '600' },
  headerTitle: { color: '#fff', fontWeight: '700' },
  pdf: { flex: 1, width: '100%' },
});
