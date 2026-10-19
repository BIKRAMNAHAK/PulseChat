import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { fetchStatusesAction, uploadStatusAction } from '../Services/Actions/chatActions';
import { theme, postApi } from '../Services/helper';

const { width, height } = Dimensions.get('window');

const COLOR_PRESETS = [
  '#0F5132', // Emerald WhatsApp Green
  '#7C3AED', // Royal Violet
  '#DC2626', // Crimson Red
  '#2563EB', // Electric Blue
  '#D97706', // Sunset Amber
  '#0F172A', // Midnight Slate
];

const StatusScreen = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { statuses } = useSelector((state) => state.chat);

  const [activeStory, setActiveStory] = useState(null);
  const [viewerModalVisible, setViewerModalVisible] = useState(false);

  // Status creation modals
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [textStatusModalVisible, setTextStatusModalVisible] = useState(false);

  // Media Status State
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [caption, setCaption] = useState('');

  // Text Status State
  const [textStatus, setTextStatus] = useState('');
  const [selectedBgColor, setSelectedBgColor] = useState(COLOR_PRESETS[0]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchStatusesAction());
  }, [dispatch]);

  // 1. Pick Image or Video from Gallery
  const pickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'mixed',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (!res.didCancel && res.assets && res.assets.length > 0) {
        setSelectedAsset(res.assets[0]);
        setMediaModalVisible(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open gallery.');
    }
  };

  // 2. Open Camera
  const openCamera = async () => {
    try {
      const res = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (!res.didCancel && res.assets && res.assets.length > 0) {
        setSelectedAsset(res.assets[0]);
        setMediaModalVisible(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  // 3. Upload Gallery Media Status (Photo or Video)
  const handleUploadMediaStatus = async () => {
    if (!selectedAsset) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('media', {
        uri: selectedAsset.uri,
        name: selectedAsset.fileName || (selectedAsset.type?.includes('video') ? 'status.mp4' : 'status.jpg'),
        type: selectedAsset.type || (selectedAsset.type?.includes('video') ? 'video/mp4' : 'image/jpeg'),
      });
      formData.append('caption', caption.trim());
      formData.append('mediaType', selectedAsset.type?.includes('video') ? 'video' : 'image');

      await dispatch(uploadStatusAction(formData));

      setSelectedAsset(null);
      setCaption('');
      setMediaModalVisible(false);
      Alert.alert('Status Posted', 'Your story has been shared for 24 hours!');
    } catch (e) {
      Alert.alert('Error', 'Failed to upload status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Upload Text Status (Like WhatsApp)
  const handleUploadTextStatus = async () => {
    if (!textStatus.trim()) return;

    try {
      setLoading(true);
      await postApi('/status/upload', {
        mediaType: 'text',
        caption: textStatus.trim(),
        bgColor: selectedBgColor,
      });

      await dispatch(fetchStatusesAction());

      setTextStatus('');
      setTextStatusModalVisible(false);
      Alert.alert('Status Posted', 'Your text status has been shared for 24 hours!');
    } catch (e) {
      Alert.alert('Error', 'Failed to post text status.');
    } finally {
      setLoading(false);
    }
  };

  const openStoryViewer = (status) => {
    setActiveStory(status);
    setViewerModalVisible(true);
    if (status._id) {
      postApi(`/status/view/${status._id}`).catch(() => {});
    }
  };

  const formatStoryTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return `${Math.floor(diff / 3600)} hours ago`;
  };

  const myLatestStatus = statuses.myStatuses?.[0];

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Status & Shorts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* My Status Card */}
        <TouchableOpacity
          style={styles.statusRow}
          activeOpacity={0.8}
          onPress={() => {
            if (myLatestStatus) {
              openStoryViewer(myLatestStatus);
            } else {
              pickFromGallery();
            }
          }}
        >
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.storyRing,
                myLatestStatus ? styles.storyRingActive : styles.storyRingNone,
              ]}
            >
              {user?.profilePic ? (
                <Image source={{ uri: user.profilePic }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{user?.fullName?.charAt(0) || 'U'}</Text>
                </View>
              )}
            </View>

            {/* Plus badge */}
            <TouchableOpacity style={styles.addBadge} onPress={pickFromGallery}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusTextWrap}>
            <Text style={styles.statusUserName}>My Status</Text>
            <Text style={styles.statusSubtext}>
              {myLatestStatus
                ? `${formatStoryTime(myLatestStatus.createdAt)} • ${myLatestStatus.viewers?.length || 0} views`
                : 'Tap to add status from gallery'}
            </Text>
          </View>

          {/* Quick Camera & Gallery shortcuts */}
          <View style={styles.shortcutRow}>
            <TouchableOpacity style={styles.actionIconBtn} onPress={openCamera}>
              <Ionicons name="camera" size={20} color={theme.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconBtn} onPress={pickFromGallery}>
              <Ionicons name="images" size={20} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Section divider */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent updates</Text>
        </View>

        {/* Friends Statuses */}
        {statuses.friendsStatuses?.length > 0 ? (
          statuses.friendsStatuses.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={styles.statusRow}
              activeOpacity={0.8}
              onPress={() => openStoryViewer(item)}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.storyRing, styles.storyRingActive]}>
                  {item.user?.profilePic ? (
                    <Image source={{ uri: item.user.profilePic }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {item.user?.fullName?.charAt(0) || 'F'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.statusTextWrap}>
                <Text style={styles.statusUserName}>{item.user?.fullName}</Text>
                <Text style={styles.statusSubtext}>{formatStoryTime(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyStatus}>
            <Ionicons name="time-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyText}>No recent updates from friends</Text>
            <Text style={styles.emptySubtext}>
              Updates posted by mutual friends will appear here for 24 hours.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons (Like WhatsApp: Pencil for text, Camera for Gallery) */}
      <View style={styles.fabColumn}>
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => setTextStatusModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="pencil" size={20} color="#0F2D37" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fabBig}
          onPress={pickFromGallery}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 1. Modal: Upload Photo/Video from Gallery */}
      <Modal
        visible={mediaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedAsset?.type?.includes('video') ? 'Share Video Short' : 'Share Photo Story'}
              </Text>
              <TouchableOpacity onPress={() => setMediaModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Media Preview */}
            {selectedAsset?.uri ? (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: selectedAsset.uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                {selectedAsset.type?.includes('video') && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={16} color="#FFFFFF" />
                    <Text style={styles.videoBadgeText}>Video Selected</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Caption Input */}
            <View style={styles.captionWrap}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="#94A3B8"
                value={caption}
                onChangeText={setCaption}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleUploadMediaStatus}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Share to My Status</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Modal: Text Status Composer (WhatsApp Style) */}
      <Modal
        visible={textStatusModalVisible}
        animationType="slide"
        onRequestClose={() => setTextStatusModalVisible(false)}
      >
        <View style={[styles.textStatusContainer, { backgroundColor: selectedBgColor }]}>
          <View style={styles.textStatusHeader}>
            <TouchableOpacity onPress={() => setTextStatusModalVisible(false)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Color Palette Switcher */}
            <View style={styles.paletteRow}>
              {COLOR_PRESETS.map((col) => (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: col },
                    selectedBgColor === col && styles.colorCircleActive,
                  ]}
                  onPress={() => setSelectedBgColor(col)}
                />
              ))}
            </View>
          </View>

          {/* Central Text Input */}
          <View style={styles.textStatusBody}>
            <TextInput
              style={styles.largeTextInput}
              placeholder="Type a status..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              multiline
              autoFocus
              value={textStatus}
              onChangeText={setTextStatus}
              textAlign="center"
            />
          </View>

          {/* Post Button */}
          <View style={styles.textStatusFooter}>
            <TouchableOpacity
              style={[styles.postTextBtn, !textStatus.trim() && styles.disabledBtn]}
              onPress={handleUploadTextStatus}
              disabled={!textStatus.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Fullscreen Story Viewer Modal */}
      <Modal
        visible={viewerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerModalVisible(false)}
      >
        <View
          style={[
            styles.viewerContainer,
            activeStory?.mediaType === 'text' && {
              backgroundColor: activeStory.mediaUrl || '#0F5132',
            },
          ]}
        >
          {/* Progress bar */}
          <View style={styles.progressBarWrap}>
            <View style={styles.progressBar} />
          </View>

          {/* Viewer Top Header */}
          <View style={styles.viewerHeader}>
            <View style={styles.viewerUserWrap}>
              <View style={styles.viewerSmallAvatar}>
                <Text style={styles.smallAvatarText}>
                  {activeStory?.user?.fullName?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.viewerNameBlock}>
                <Text style={styles.viewerUserName}>{activeStory?.user?.fullName || 'User'}</Text>
                <Text style={styles.viewerTime}>{formatStoryTime(activeStory?.createdAt)}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => setViewerModalVisible(false)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Story Content */}
          <View style={styles.viewerMediaContent}>
            {activeStory?.mediaType === 'text' ? (
              /* Text Status */
              <View style={styles.fullscreenTextWrap}>
                <Text style={styles.fullscreenText}>{activeStory.caption}</Text>
              </View>
            ) : activeStory?.mediaUrl ? (
              /* Photo or Video status */
              <Image
                source={{ uri: activeStory.mediaUrl }}
                style={styles.storyFullImage}
                resizeMode="contain"
              />
            ) : null}
          </View>

          {/* Caption */}
          {activeStory?.caption && activeStory.mediaType !== 'text' ? (
            <View style={styles.viewerCaptionBox}>
              <Text style={styles.viewerCaptionText}>{activeStory.caption}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
  },
  topTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingVertical: 10,
    paddingBottom: 90,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  storyRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyRingActive: {
    borderWidth: 2.5,
    borderColor: theme.statusUnviewed,
  },
  storyRingNone: {
    borderWidth: 0,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusTextWrap: {
    flex: 1,
  },
  statusUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 8,
    marginLeft: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyStatus: {
    alignItems: 'center',
    padding: 30,
    marginTop: 30,
  },
  emptyText: {
    color: '#0F2D37',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtext: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  fabColumn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
  },
  fabSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4,
  },
  fabBig: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F2D37',
  },
  previewBox: {
    position: 'relative',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#0F172A',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  },
  captionWrap: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
    justifyContent: 'center',
  },
  captionInput: {
    fontSize: 14,
    color: '#0F172A',
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  textStatusContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  textStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  paletteRow: {
    flexDirection: 'row',
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  colorCircleActive: {
    borderColor: '#FDE047',
    transform: [{ scale: 1.2 }],
  },
  textStatusBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeTextInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    width: '100%',
  },
  textStatusFooter: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  postTextBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  progressBarWrap: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 10,
    marginTop: 20,
    borderRadius: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: theme.accent,
    width: '100%',
    borderRadius: 2,
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewerUserWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerSmallAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  viewerNameBlock: {
    marginLeft: 10,
  },
  viewerUserName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  viewerTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  viewerMediaContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenTextWrap: {
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38,
  },
  storyFullImage: {
    width: width,
    height: height * 0.7,
  },
  viewerCaptionBox: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  viewerCaptionText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default StatusScreen;
