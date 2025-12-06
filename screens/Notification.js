import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/api';

const formatDateLabel = (value) => {
  if (!value) {
    return 'Date to be announced';
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return value;
};

const formatTimeLabel = (value) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const asTime = new Date(`1970-01-01T${value}`);
  if (!Number.isNaN(asTime.getTime())) {
    return asTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return value;
};

const buildTimeRangeLabel = (row = {}) => {
  const start =
    row.event_start_at ||
    row.start_at ||
    row.start_time ||
    row.startTime ||
    row.time_from ||
    row.timeFrom ||
    '';
  const end =
    row.event_end_at ||
    row.end_at ||
    row.end_time ||
    row.endTime ||
    row.time_to ||
    row.timeTo ||
    '';
  const fallback = row.time_range || row.timeRange || '';

  const startLabel = formatTimeLabel(start);
  const endLabel = formatTimeLabel(end);
  if (startLabel || endLabel) {
    return [startLabel, endLabel].filter(Boolean).join(' \u2013 ');
  }
  return fallback || 'Time to be announced';
};

const normalizeStatus = (status) => {
  if (!status) {
    return 'Pending';
  }
  const trimmed = String(status).trim();
  if (!trimmed) {
    return 'Pending';
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

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

  // Certificate modal
  const [certificateModalVisible, setCertificateModalVisible] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState('');
  // Event invitations
  const [eventInvites, setEventInvites] = useState([]);
  const [eventError, setEventError] = useState('');
  const [pendingInviteAction, setPendingInviteAction] = useState(null);
  const [updatingInviteId, setUpdatingInviteId] = useState(null);

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
        // no per-student read flag in post table; start as unread
        read: false,
      }));

      setAnnouncements(mapped);
    } catch (e) {
      setError(e.message || 'Failed to load announcements.');
      throw e;
    }
  };

  // Section 2: Awards & Claims (student_notifications table via student_awards.php)
  const fetchAwards = async (id) => {
    if (!id) return;
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

      console.log('[AWARDS][raw]', json.data);
      // Expect: StudentNotification_id, title, message, is_read, claimable, data, claimed_at, created_at, ...
      const mapped = (json.data || []).map((row) => {
        // parse the JSON in `data` column to get certificate_path
        let certPath = '';
        try {
          const parsed = row.data ? JSON.parse(row.data) : null;
          certPath = parsed?.certificate_path || '';
        } catch (e) {
          console.log('[AWARDS][data-parse-error]', e, row.data);
          certPath = '';
        }

        return {
          id: String(row.StudentNotification_id),
          title: row.title ?? '',
          content: row.message ?? '',
          time: row.claimed_at ?? row.created_at ?? '',
          isRead:
            row.is_read === '1' ||
            row.is_read === 1 ||
            row.is_read === true,
          // 0 or 1 from DB
          claimable: Number(row.claimable) || 0,
          certificatePath: certPath,
        };
      });

      console.log('[AWARDS][mapped]', mapped);

      setAwards(mapped);
    } catch (e) {
      setError(e.message || 'Failed to load awards & claims.');
      throw e;
    }
  };

  // Section 3: Event Invitations
  const fetchEventInvites = async (id) => {
    if (!id) return;
    setEventError('');
    try {
      const res = await fetch(
        `${BASE_URL}/get_event_invite.php?student_id=${encodeURIComponent(id)}`
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

      const mapped = (json.data || []).map((row, index) => {
        const status = normalizeStatus(row?.invite_status || row?.status);
        const startAt =
          row?.event_start_at ||
          row?.start_at ||
          row?.event_date ||
          row?.date ||
          '';
        const endAt = row?.event_end_at || row?.end_at || '';
        return {
          id: String(
            row?.Assignment_id ??
              row?.Event_id ??
              `${Date.now()}-${index}`
          ),
          assignmentId: row?.Assignment_id ?? null,
          title:
            row?.event_title ||
            row?.title ||
            row?.event_name ||
            `Event #${row?.Event_id ?? row?.Assignment_id ?? index}`,
          type:
            row?.event_type_name ||
            row?.event_type ||
            row?.type ||
            'Event',
          description:
            row?.event_description ||
            row?.description ||
            row?.details ||
            'No description provided.',
          date: startAt
            ? formatDateLabel(startAt)
            : 'Date to be announced',
          timeRange: buildTimeRangeLabel({
            event_start_at: startAt,
            event_end_at: endAt,
            time_range: row?.time_range,
          }),
          status,
        };
      });

      setEventInvites(mapped);
    } catch (e) {
      console.log('[EVENT][fetch-error]', e?.message || e);
      setEventError(e.message || 'Failed to load event invitations.');
      throw e;
    }
  };

  useEffect(() => {
    (async () => {
      const id = await loadStudentId();
      if (id) {
        setLoading(true);
        setError('');
        await Promise.allSettled([
          fetchAnnouncements(id),
          fetchAwards(id),
          fetchEventInvites(id),
        ]);
        setLoading(false);
      }
    })();
  }, []);

  // --- Read handling ---

  // Announcements: local state + server update via update_post_read.php
  const markAnnouncementAsReadLocal = (id) => {
    setAnnouncements((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  };

  const updateAnnouncementIsReadOnServer = async (postId) => {
    if (!studentId) return;
    try {
      const res = await fetch(`${BASE_URL}/update_post_read.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: Number(postId), // Post_id
          student_id: Number(studentId),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      // Optionally use data.unreadCount if you want a global badge somewhere
    } catch (e) {
      console.log('Failed to update post read status:', e.message);
    }
  };

  // Awards: local + server update via update_student_award_read.php
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

  // Claim logic: update claimable from 0 -> 1
  const updateAwardClaimableOnServer = async (awardId) => {
    try {
      const res = await fetch(`${BASE_URL}/update_student_award_claim.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_notification_id: awardId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      // On success, update local claimable -> 1
      setAwards((prev) =>
        prev.map((item) =>
          item.id === awardId ? { ...item, claimable: 1 } : item
        )
      );
    } catch (e) {
      console.log('Failed to update claimable:', e.message);
    }
  };

  // --- Item press handlers ---

  const handlePressItem = (item) => {
    if (activeTab === 'announcement') {
      // Mark locally and tell backend
      markAnnouncementAsReadLocal(item.id);
      updateAnnouncementIsReadOnServer(item.id);
    } else {
      // Award & Claims: open modal and update is_read
      console.log('[AWARDS][press]', item);
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

  const updateInviteStatusLocal = (inviteId, action) => {
    setEventInvites((prev) =>
      prev.map((invite) =>
        invite.id === inviteId
          ? {
              ...invite,
              status:
                action === 'accept'
                  ? 'Accepted'
                  : action === 'decline'
                  ? 'Declined'
                  : invite.status,
            }
          : invite
      )
    );
    console.log(`[EVENT][${action}]`, inviteId);
  };

  const openInviteActionModal = (invite, action) => {
    setPendingInviteAction({ invite, action });
  };

  const closeInviteActionModal = () => {
    setPendingInviteAction(null);
  };

  const updateInviteStatusOnServer = async (assignmentId, status) => {
    if (!assignmentId) return;
    try {
      setUpdatingInviteId(assignmentId);
      const res = await fetch(`${BASE_URL}/get_event_invite.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: Number(assignmentId),
          student_id: Number(studentId),
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
    } finally {
      setUpdatingInviteId(null);
    }
  };

  const confirmInviteAction = async () => {
    if (!pendingInviteAction?.invite) return;
    const { invite, action } = pendingInviteAction;
    const nextStatus = action === 'decline' ? 'Declined' : 'Accepted';

    try {
      await updateInviteStatusOnServer(invite.assignmentId, nextStatus);
      updateInviteStatusLocal(invite.id, action);
      closeInviteActionModal();
    } catch (e) {
      console.log('[EVENT][update-error]', e?.message || e);
      setEventError(e.message || 'Failed to update invite status.');
      fetchEventInvites(studentId);
    }
  };

  const renderEventInvites = () => (
    <View style={styles.eventInvitesWrapper}>
      <Text style={styles.eventHeader}>Event Invitations</Text>
      <Text style={styles.eventDescription}>
        Below are the events you have been invited to.
      </Text>
      {eventError && eventInvites.length === 0 ? (
        <Text style={styles.emptyText}>{eventError}</Text>
      ) : eventInvites.length === 0 ? (
        <Text style={styles.emptyText}>No event invitations yet.</Text>
      ) : (
        eventInvites.map((invite) => (
          <View key={invite.id} style={styles.eventCard}>
            <View style={styles.eventCardHeader}>
              <View>
                <Text style={styles.eventTitle}>{invite.title}</Text>
                <Text style={styles.eventType}>
                  Type: <Text style={styles.eventTypeLink}>{invite.type}</Text>
                </Text>
              </View>
              <View
                style={[
                  styles.inviteStatusBadge,
                  invite.status === 'Pending'
                    ? styles.statusPending
                    : invite.status === 'Accepted'
                    ? styles.statusApproved
                    : styles.statusDeclined,
                ]}
              >
                <Text
                  style={[
                    styles.inviteStatusText,
                    invite.status === 'Declined' && { color: '#8b1a1a' },
                  ]}
                >
                  {invite.status}
                </Text>
              </View>
            </View>
            <Text style={styles.eventBodyText}>{invite.description}</Text>
            <View style={styles.eventMetaRow}>
              <Text style={styles.eventMetaLabel}>Date:</Text>
              <Text style={styles.eventMetaValue}>{invite.date}</Text>
            </View>
            <View style={styles.eventMetaRow}>
              <Text style={styles.eventMetaLabel}>Time:</Text>
              <Text style={styles.eventMetaValue}>{invite.timeRange}</Text>
            </View>
            {invite.status === 'Pending' ? (
              <View style={styles.eventActionsRow}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => openInviteActionModal(invite, 'accept')}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => openInviteActionModal(invite, 'decline')}
                >
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.eventNote}>
                {invite.status === 'Accepted'
                  ? 'You have accepted this invitation.'
                  : 'You declined this invitation.'}
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const currentData =
    activeTab === 'announcement'
      ? announcements
      : activeTab === 'award'
      ? awards
      : [];

  const hasUnreadAnnouncements = announcements.some((n) => !n.read);
  const hasUnreadAwards = awards.some((a) => !a.isRead);
  const hasPendingInvites = eventInvites.some(
    (invite) => invite.status?.toLowerCase() === 'pending'
  );

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

        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'events' && styles.activeTabText,
            ]}
          >
            Event Invites
          </Text>
          {hasPendingInvites && <View style={styles.unreadBadge} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'events' ? (
        loading ? (
          <ActivityIndicator
            style={{ marginTop: 20 }}
            size="small"
            color="#9e0009"
          />
        ) : (
          renderEventInvites()
        )
      ) : loading ? (
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

      {/* Event invite confirmation modal */}
      <Modal
        visible={!!pendingInviteAction}
        transparent
        animationType="fade"
        onRequestClose={closeInviteActionModal}
      >
        <View style={styles.modalOverlay}>
          {(() => {
            const isProcessing =
              pendingInviteAction?.invite?.assignmentId === updatingInviteId;
            return (
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {pendingInviteAction?.action === 'decline'
                    ? 'Decline Invite'
                    : 'Accept Invite'}
                </Text>
                <View style={styles.modalDivider} />
                <Text style={styles.modalMessage}>
                  Are you sure you want to{' '}
                  {pendingInviteAction?.action === 'decline'
                    ? 'decline'
                    : 'accept'}{' '}
                  the event "{pendingInviteAction?.invite?.title}"?
                </Text>
                <View style={styles.confirmButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      styles.confirmCancelButton,
                      isProcessing && styles.disabledButton,
                    ]}
                    onPress={closeInviteActionModal}
                    disabled={isProcessing}
                  >
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      pendingInviteAction?.action === 'decline'
                        ? styles.confirmDeclineButton
                        : styles.confirmAcceptButton,
                      isProcessing && styles.disabledButton,
                    ]}
                    onPress={confirmInviteAction}
                    disabled={isProcessing}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isProcessing
                        ? 'Processing...'
                        : pendingInviteAction?.action === 'decline'
                        ? 'Yes, Decline'
                        : 'Yes, Accept'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>
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

            {/* Divider line under title */}
            <View style={styles.modalDivider} />

            <Text style={styles.modalMessage}>
              {selectedAward?.content || ''}
            </Text>
            <Text style={styles.modalTime}>
              {selectedAward?.time || ''}
            </Text>

            {(() => {
              const isClaimed =
                selectedAward?.claimable === 1 ||
                selectedAward?.claimable === '1';
              return (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={async () => {
                    if (!selectedAward) return;
                    console.log('[AWARDS][button-press]', {
                      id: selectedAward.id,
                      isClaimed,
                      claimable: selectedAward.claimable,
                      certificatePath: selectedAward.certificatePath,
                    });
                    if (!isClaimed) {
                      // Claim: set claimable = 1
                      updateAwardClaimableOnServer(selectedAward.id);
                    } else {
                      // View: open certificate modal
                      try {
                        const resp = await fetch(
                          `${BASE_URL}/certificate_name.php?id=${selectedAward.id}`
                        );
                        const text = await resp.text();
                        try {
                          const json = JSON.parse(text);
                          console.log('[CERT][php-response]', json);
                          if (
                            !selectedAward.certificatePath &&
                            json?.success &&
                            json?.filename
                          ) {
                            const storageBase = BASE_URL.replace(/\/api$/, '');
                            const fallbackUrl = `${storageBase}/storage/certificates/${json.filename}`;
                            console.log('[CERT][fallback-url]', fallbackUrl);
                            setCertificateUrl(fallbackUrl);
                            setCertificateModalVisible(true);
                            setModalVisible(false);
                            return;
                          }
                        } catch (parseErr) {
                          console.log('[CERT][php-parse-error]', parseErr?.message || parseErr);
                          console.log('[CERT][php-raw]', text.slice(0, 200));
                        }
                      } catch (err) {
                        console.log('[CERT][php-error]', err?.message || err);
                      }
                      if (selectedAward.certificatePath) {
                        const url = `${BASE_URL}/${selectedAward.certificatePath}`;
                        console.log('[CERT][open]', url);
                        setCertificateUrl(url);
                        setCertificateModalVisible(true);
                      } else {
                        console.log('[CERT][missing-path]', selectedAward);
                      }
                      setModalVisible(false);
                    }
                  }}
                  disabled={updatingReadId === selectedAward?.id}
                >
                  <Text style={styles.claimButtonText}>
                    {updatingReadId === selectedAward?.id
                      ? 'Updating...'
                      : isClaimed
                      ? 'View'
                      : 'Claim'}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Certificate modal */}
      <Modal
        visible={certificateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCertificateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingHorizontal: 0 }]}>
            {certificateUrl ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={styles.modalTitle}>Certificate</Text>
                <View style={styles.modalDivider} />
                <View
                  style={{
                    width: '100%',
                    backgroundColor: '#fff',
                    borderRadius: 8,
                  }}
                >
                  <Image
                    source={{ uri: certificateUrl }}
                    style={{
                      width: '100%',
                      aspectRatio: 1.4,
                      resizeMode: 'contain',
                    }}
                  />
                </View>
              </View>
            ) : (
              <>
                {console.log('[CERT][no-url]')}
                <Text style={styles.modalMessage}>Certificate not available.</Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.claimButton, { marginTop: 16 }]}
              onPress={() => setCertificateModalVisible(false)}
            >
              <Text style={styles.claimButtonText}>Close</Text>
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
    marginBottom: 8,
    color: '#222',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#d0d0d0',
    marginHorizontal: 8,
    marginBottom: 16,
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
  eventInvitesWrapper: {
    flex: 1,
    padding: 20,
  },
  eventHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1b1b1b',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 13,
    color: '#5c5c5c',
    marginBottom: 18,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  eventType: {
    fontSize: 13,
    color: '#4c4c4c',
    marginTop: 2,
  },
  eventTypeLink: {
    color: '#0b71c9',
    textDecorationLine: 'underline',
  },
  inviteStatusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 30,
    backgroundColor: '#f5c242',
  },
  statusPending: {
    backgroundColor: '#f5c242',
  },
  statusApproved: {
    backgroundColor: '#1b7f3b',
  },
  statusDeclined: {
    backgroundColor: '#ffe2df',
  },
  inviteStatusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  eventBodyText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
  eventMetaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  eventMetaLabel: {
    fontWeight: '700',
    color: '#222',
    marginRight: 6,
  },
  eventMetaValue: {
    color: '#444',
  },
  eventActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#0c8b3a',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 10,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c62828',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  declineButtonText: {
    color: '#c62828',
    fontWeight: '700',
  },
  eventNote: {
    marginTop: 12,
    fontSize: 13,
    color: '#4f4f4f',
    fontStyle: 'italic',
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmCancelButton: {
    borderWidth: 1,
    borderColor: '#b0b0b0',
    marginRight: 10,
  },
  confirmDeclineButton: {
    backgroundColor: '#c62828',
  },
  confirmAcceptButton: {
    backgroundColor: '#0c8b3a',
  },
  confirmCancelText: {
    color: '#555',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default Notification;
