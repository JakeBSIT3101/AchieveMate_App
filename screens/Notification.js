import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/api';

const Notification = () => {
  const [activeTab, setActiveTab] = useState('announcement');
  const [studentId, setStudentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Announcements from backend (post table)
  const [announcements, setAnnouncements] = useState([]);

  // Awards & Claims from backend (student_notifications table)
  const [awards, setAwards] = useState([]);

  // Modal state for Award & Claims
  const [selectedAward, setSelectedAward] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [updatingReadId, setUpdatingReadId] = useState(null);

  const loadStudentId = async () => {
    try {
      const stored = await AsyncStorage.getItem('student_id');
      if (stored) {
        setStudentId(stored);
        return stored;
      }
      setError('Student ID not found. Please log in again.');
      return null;
    } catch {
      setError('Unable to read stored student ID.');
      return null;
    }
  };

  // Section 1: Announcements (post table via student_notification.php)
  const fetchAnnouncements = async (id) => {
    // id currently not used in PHP WHERE, but kept for future filter
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/student_notification.php`);
      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Server response is not valid JSON.');
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      // Expect: Post_id, Title, Announcement, Semester, End_date
      const mapped = (json.data || []).map((row) => ({
        id: String(row.Post_id),
        title: row.Title ?? '',
        content: row.Announcement ?? '',
        // bottom line: Semester • End_date
        time: `${row.Semester ?? ''} • ${row.End_date ?? ''}`,
        read: false, // no read flag in post table
      }));

      setAnnouncements(mapped);
    } catch (e) {
      setError(e.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  // Section 2: Awards & Claims (student_notifications table via student_awards.php)
  const fetchAwards = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${BASE_URL}/student_awards.php?student_id=${encodeURIComponent(id)}`
      );
      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Server response is not valid JSON.');
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      // Expect: StudentNotification_id, title, message, is_read, claimed_at, created_at, ...
      const mapped = (json.data || []).map((row) => ({
        id: String(row.StudentNotification_id),
        title: row.title ?? '',
        content: row.message ?? '',
        time: row.claimed_at ?? row.created_at ?? '',
        isRead:
          row.is_read === '1' ||
          row.is_read === 1 ||
          row.is_read === true,
      }));

      setAwards(mapped);
    } catch (e) {
      setError(e.message || 'Failed to load awards & claims.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const id = await loadStudentId();
      if (id) {
        await Promise.all([fetchAnnouncements(id), fetchAwards(id)]);
      }
    })();
  }, []);

  // --- Read handling ---

  const markAnnouncementAsRead = (id) => {
    setAnnouncements((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  };

  const markAwardAsReadLocal = (id) => {
    setAwards((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isRead: true } : item
      )
    );
  };

  const updateAwardIsReadOnServer = async (awardId) => {
    try {
      setUpdatingReadId(awardId);
      const res = await fetch(`${BASE_URL}/update_student_award_read.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_notification_id: awardId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      // On success, update local state
      markAwardAsReadLocal(awardId);
    } catch (e) {
      console.log('Failed to update award read status:', e.message);
    } finally {
      setUpdatingReadId(null);
    }
  };

  // --- Item press handlers ---

  const handlePressItem = (item) => {
    if (activeTab === 'announcement') {
      markAnnouncementAsRead(item.id);
    } else {
      // Award & Claims: open modal and update is_read
      setSelectedAward(item);
      setModalVisible(true);
      if (!item.isRead) {
        updateAwardIsReadOnServer(item.id);
      }
    }
  };

  const renderItem = ({ item }) => {
    const isUnread =
      activeTab === 'announcement' ? !item.read : !item.isRead;

    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => handlePressItem(item)}
        activeOpacity={0.8}
      >
        <Text style={[styles.titleText, isUnread && styles.unreadMessage]}>
          {item.title}
        </Text>
        <Text style={styles.announcementText}>{item.content}</Text>
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{item.time}</Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const currentData = activeTab === 'announcement' ? announcements : awards;

  const hasUnreadAnnouncements = announcements.some((n) => !n.read);
  const hasUnreadAwards = awards.some((a) => !a.isRead);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'announcement' && styles.activeTab]}
          onPress={() => setActiveTab('announcement')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'announcement' && styles.activeTabText,
            ]}
          >
            Announcement
          </Text>
          {hasUnreadAnnouncements && <View style={styles.unreadBadge} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'award' && styles.activeTab]}
          onPress={() => setActiveTab('award')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'award' && styles.activeTabText,
            ]}
          >
            Award & Claims
          </Text>
          {hasUnreadAwards && <View style={styles.unreadBadge} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 20 }}
          size="small"
          color="#9e0009"
        />
      ) : error ? (
        <Text style={styles.emptyText}>{error}</Text>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.notificationsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No {activeTab === 'announcement' ? 'announcements' : 'awards'} available
            </Text>
          }
        />
      )}

      {/* Award & Claims modal */}
      <Modal
        visible={modalVisible && !!selectedAward}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedAward?.title || ''}
            </Text>
            <Text style={styles.modalMessage}>
              {selectedAward?.content || ''}
            </Text>
            <Text style={styles.modalTime}>
              {selectedAward?.time || ''}
            </Text>

            <TouchableOpacity
              style={styles.claimButton}
              onPress={() => setModalVisible(false)}
              disabled={updatingReadId === selectedAward?.id}
            >
              <Text style={styles.claimButtonText}>
                {updatingReadId === selectedAward?.id ? 'Updating...' : 'Claim'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTab: {
    borderBottomColor: '#9e0009',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#9e0009',
    fontWeight: '600',
  },
  unreadBadge: {
    position: 'absolute',
    top: 10,
    right: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9e0009',
  },
  notificationsList: {
    padding: 15,
  },
  notificationItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  announcementText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  unreadMessage: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9e0009',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 50,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: '#fdfdfd',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    color: '#222',
  },
  modalMessage: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalTime: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    marginBottom: 24,
  },
  claimButton: {
    alignSelf: 'center',
    backgroundColor: '#9e0009',
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 20,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Notification;