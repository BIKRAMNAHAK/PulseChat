import React, { useEffect, useState, useRef } from 'react';
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
  TouchableWithoutFeedback,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { fetchStatusesAction, uploadStatusAction } from '../Services/Actions/chatActions';
import { theme, postApi, deleteApi, getImageUrl, getThemeColors } from '../Services/helper';

const { width } = Dimensions.get('window');

const COLOR_PRESETS = [
  '#0F5132', // Emerald WhatsApp Green
  '#7C3AED', // Royal Violet
  '#DC2626', // Crimson Red
  '#2563EB', // Electric Blue
  '#D97706', // Sunset Amber
  '#0F172A', // Midnight Slate
];

const StatusScreen = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { statuses } = useSelector((state) => state.chat);
  const themeMode = useSelector((state) => state.theme?.mode || 'dark');
  const currentTheme = getThemeColors(themeMode);

  const myStatuses = statuses?.myStatuses || [];
  const friendsStatuses = statuses?.friendsStatuses || [];

  // Viewer State (Segmented WhatsApp Stories)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStories, setViewerStories] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [viewerUser, setViewerUser] = useState(null);
  const [isOwnViewer, setIsOwnViewer] = useState(false);
  const [viewersSheetVisible, setViewersSheetVisible] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(true);

  // Status Creation Modals
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [textModalVisible, setTextModalVisible] = useState(false);

  // Media Status Form
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [caption, setCaption] = useState('');

  // Text Status Form
  const [textStatus, setTextStatus] = useState('');
  const [selectedBgColor, setSelectedBgColor] = useState(COLOR_PRESETS[0]);

  const [loading, setLoading] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchStatusesAction());
  }, [dispatch]);

  // Handle Story Auto-advance Timer (5 seconds per story once loaded)
  useEffect(() => {
    if (viewerVisible && viewerStories.length > 0) {
      const activeStory = viewerStories[currentStoryIndex];
      // Mark as viewed on server
      if (activeStory?._id && !isOwnViewer) {
        postApi(`/status/view/${activeStory._id}`).catch(() => {});
      }

      clearTimeout(timerRef.current);

      // Do NOT start timer while media is still loading buffering
      if (mediaLoading && activeStory?.mediaType !== 'text') {
        return;
      }

      timerRef.current = setTimeout(() => {
        if (currentStoryIndex < viewerStories.length - 1) {
          setMediaLoading(true);
          setCurrentStoryIndex((prev) => prev + 1);
        } else {
          setViewerVisible(false);
        }
      }, 5000);
    }

    return () => clearTimeout(timerRef.current);
  }, [viewerVisible, currentStoryIndex, viewerStories.length, isOwnViewer, mediaLoading]);

  // 1. Pick Image or Video from Gallery
  const pickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'mixed',
        quality: 0.8,
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

  // 3. Upload Media Status (Photo or Video)
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
      Alert.alert('Status Added', 'Your status has been posted! You can add multiple statuses anytime.');
    } catch (e) {
      Alert.alert('Error', 'Failed to upload status.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Upload Text Status
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
      setTextModalVisible(false);
      Alert.alert('Status Added', 'Your text status has been posted!');
    } catch (e) {
      Alert.alert('Error', 'Failed to post text status.');
    } finally {
      setLoading(false);
    }
  };

  // Open Multi-Story Viewer
  const openStoryViewer = (stories, targetUser, isOwn = false) => {
    if (!stories || stories.length === 0) return;
    setMediaLoading(true);
    setViewerStories(stories);
    setCurrentStoryIndex(0);
    setViewerUser(targetUser);
    setIsOwnViewer(isOwn);
    setViewerVisible(true);
  };

  // Next / Previous Story Handlers
  const handleNextStory = () => {
    if (currentStoryIndex < viewerStories.length - 1) {
      setMediaLoading(true);
      setCurrentStoryIndex((prev) => prev + 1);
    } else {
      setViewerVisible(false);
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setMediaLoading(true);
      setCurrentStoryIndex((prev) => prev - 1);
    }
  };

  // Delete Own Story
  const handleDeleteCurrentStory = (storyId) => {
    Alert.alert('Delete Status', 'Are you sure you want to delete this status update?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteApi(`/status/${storyId}`);
            setViewerVisible(false);
            dispatch(fetchStatusesAction());
            Alert.alert('Deleted', 'Status removed successfully.');
          } catch (e) {
            Alert.alert('Error', 'Failed to delete status.');
          }
        },
      },
    ]);
  };

  const formatStoryTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const currentStory = viewerStories[currentStoryIndex];

  const isVideoStory = (story) => {
    if (!story || !story.mediaUrl) return false;
    if (story.mediaType === 'video') return true;
    if (typeof story.mediaUrl === 'string') {
      const urlLower = story.mediaUrl.toLowerCase();
      if (urlLower.startsWith('data:video/')) return true;
      if (['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.mkv'].some((ext) => urlLower.endsWith(ext) || urlLower.includes(ext + '?'))) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (currentStory?.mediaType === 'text') {
      setMediaLoading(false);
    }
  }, [currentStory]);

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top > 0 ? insets.top + 8 : 14 }]}>
        <Text style={styles.topTitle}>Updates & Status</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* MY STATUS SECTION */}
        <View style={[styles.myStatusCard, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <TouchableOpacity
            style={styles.myStatusMainRow}
            activeOpacity={0.8}
            onPress={() => {
              if (myStatuses.length > 0) {
                openStoryViewer(myStatuses, user, true);
              } else {
                pickFromGallery();
              }
            }}
          >
            <View style={styles.avatarContainer}>
              <View
                style={[
                  styles.storyRing,
                  myStatuses.length > 0 ? styles.storyRingActive : styles.storyRingNone,
                ]}
              >
                {user?.profilePic ? (
                  <Image source={{ uri: getImageUrl(user.profilePic) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{user?.fullName?.charAt(0) || 'U'}</Text>
                  </View>
                )}
              </View>

              {/* Add (+) Badge */}
              <TouchableOpacity style={styles.addBadge} onPress={pickFromGallery}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusUserName, { color: currentTheme.textPrimary }]}>My Status</Text>
              <Text style={[styles.statusSubtext, { color: currentTheme.textSecondary }]}>
                {myStatuses.length > 0
                  ? `${myStatuses.length} updates • Tap to view`
                  : 'Tap to add status update'}
              </Text>
            </View>

            {/* Quick action buttons on My Status card */}
            <View style={styles.myStatusActions}>
              <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: themeMode === 'dark' ? '#1F2C34' : '#F1F5F9' }]} onPress={() => setTextModalVisible(true)}>
                <Ionicons name="pencil" size={19} color={theme.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionIconBtn, { backgroundColor: themeMode === 'dark' ? '#1F2C34' : '#F1F5F9' }]} onPress={pickFromGallery}>
                <Ionicons name="camera" size={20} color={theme.accent} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* If user has multiple statuses: Show updates summary strip */}
          {myStatuses.length > 0 && (
            <View style={styles.myUpdatesStrip}>
              <Text style={[styles.myUpdatesStripTitle, { color: currentTheme.textSecondary }]}>Your Active Stories ({myStatuses.length}):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.myStoriesScroll}>
                {myStatuses.map((st, idx) => (
                  <TouchableOpacity
                    key={st._id}
                    style={styles.miniStoryThumb}
                    activeOpacity={0.8}
                    onPress={() => {
                      setMediaLoading(true);
                      setViewerStories(myStatuses);
                      setCurrentStoryIndex(idx);
                      setViewerUser(user);
                      setIsOwnViewer(true);
                      setViewerVisible(true);
                    }}
                  >
                    {st.mediaType === 'text' ? (
                      <View style={[styles.miniTextThumb, { backgroundColor: st.mediaUrl || '#0F5132' }]}>
                        <Text style={styles.miniTextThumbText} numberOfLines={2}>
                          {st.caption}
                        </Text>
                      </View>
                    ) : isVideoStory(st) ? (
                      <View style={[styles.miniTextThumb, { backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="play-circle" size={26} color="#FFFFFF" />
                      </View>
                    ) : (
                      <Image source={{ uri: getImageUrl(st.mediaUrl) }} style={styles.miniImageThumb} />
                    )}
                    <View style={styles.miniViewersBadge}>
                      <Ionicons name="eye-outline" size={10} color="#FFFFFF" />
                      <Text style={styles.miniViewersCount}>{st.viewers?.length || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Section Divider */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: currentTheme.textSecondary }]}>Recent updates from friends</Text>
        </View>

        {/* FRIENDS MULTI-STORIES LIST */}
        {friendsStatuses.length > 0 ? (
          friendsStatuses.map((item) => (
            <TouchableOpacity
              key={item.user?._id}
              style={[styles.statusRow, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}
              activeOpacity={0.8}
              onPress={() => openStoryViewer(item.stories, item.user, false)}
            >
              <View style={styles.avatarContainer}>
                <View
                  style={[
                    styles.storyRing,
                    styles.storyRingActive,
                    item.stories?.length > 1 && styles.multiStoryRing,
                  ]}
                >
                  {item.user?.profilePic ? (
                    <Image source={{ uri: getImageUrl(item.user.profilePic) }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {item.user?.fullName?.charAt(0) || 'F'}
                      </Text>
                    </View>
                  )}
                </View>
                {item.stories?.length > 1 && (
                  <View style={styles.multiCountBadge}>
                    <Text style={styles.multiCountText}>{item.stories.length}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statusTextWrap}>
                <Text style={[styles.statusUserName, { color: currentTheme.textPrimary }]}>{item.user?.fullName}</Text>
                <Text style={[styles.statusSubtext, { color: currentTheme.textSecondary }]}>
                  {item.stories?.length > 1 ? `${item.stories.length} updates • ` : ''}
                  {formatStoryTime(item.latestStory?.createdAt)}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyStatus}>
            <Ionicons name="time-outline" size={42} color={currentTheme.textMuted} />
            <Text style={[styles.emptyText, { color: currentTheme.textPrimary }]}>No recent updates from friends</Text>
            <Text style={[styles.emptySubtext, { color: currentTheme.textSecondary }]}>
              When accepted mutual friends post photos, videos, or text stories, they will appear here for 24 hours.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabColumn}>
        <TouchableOpacity
          style={[styles.fabSmall, { backgroundColor: themeMode === 'dark' ? '#1F2C34' : '#F1F5F9' }]}
          onPress={() => setTextModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="pencil" size={20} color={themeMode === 'dark' ? '#FFFFFF' : '#0F2D37'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fabBig}
          onPress={pickFromGallery}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 1. MODAL: UPLOAD MEDIA STATUS (Photo / Video) */}
      <Modal
        visible={mediaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: currentTheme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: currentTheme.textPrimary }]}>
                {selectedAsset?.type?.includes('video') ? 'Share Video Status' : 'Share Photo Status'}
              </Text>
              <TouchableOpacity onPress={() => setMediaModalVisible(false)}>
                <Ionicons name="close" size={24} color={currentTheme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Media Preview */}
            {selectedAsset?.uri ? (
              <View style={styles.previewBox}>
                {selectedAsset.type?.includes('video') ? (
                  <Video
                    source={{ uri: selectedAsset.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                    repeat
                    muted
                  />
                ) : (
                  <Image
                    source={{ uri: selectedAsset.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                )}
                {selectedAsset.type?.includes('video') && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={16} color="#FFFFFF" />
                    <Text style={styles.videoBadgeText}>Video Clip</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Caption Input */}
            <View style={[styles.captionWrap, { backgroundColor: currentTheme.inputBackground }]}>
              <TextInput
                style={[styles.captionInput, { color: currentTheme.textPrimary }]}
                placeholder="Add a caption..."
                placeholderTextColor={currentTheme.textMuted}
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
                <Text style={styles.primaryBtnText}>Post to Status</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. MODAL: TEXT STATUS COMPOSER */}
      <Modal
        visible={textModalVisible}
        animationType="slide"
        onRequestClose={() => setTextModalVisible(false)}
      >
        <View style={[styles.textStatusContainer, { backgroundColor: selectedBgColor }]}>
          <View style={styles.textStatusHeader}>
            <TouchableOpacity onPress={() => setTextModalVisible(false)}>
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

      {/* 3. FULLSCREEN SEGMENTED STORY VIEWER (WhatsApp-Style) */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View
          style={[
            styles.viewerContainer,
            currentStory?.mediaType === 'text' && {
              backgroundColor: currentStory.mediaUrl || '#0F5132',
            },
          ]}
        >
          {/* Segmented Progress Bars at Top */}
          <View style={styles.segmentedProgressRow}>
            {viewerStories.map((_, idx) => (
              <View key={`seg_${idx}`} style={styles.segmentBackground}>
                <View
                  style={[
                    styles.segmentFill,
                    idx <= currentStoryIndex && styles.segmentFillActive,
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Viewer Header */}
          <View style={styles.viewerHeader}>
            <View style={styles.viewerUserWrap}>
              <View style={styles.viewerSmallAvatar}>
                <Text style={styles.smallAvatarText}>
                  {viewerUser?.fullName?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={styles.viewerNameBlock}>
                <Text style={styles.viewerUserName}>
                  {isOwnViewer ? 'My Status' : viewerUser?.fullName || 'User'}
                </Text>
                <Text style={styles.viewerTime}>
                  {currentStoryIndex + 1} of {viewerStories.length} •{' '}
                  {formatStoryTime(currentStory?.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.viewerHeaderRightActions}>
              {isOwnViewer && currentStory && (
                <TouchableOpacity
                  style={styles.viewerDeleteBtn}
                  onPress={() => handleDeleteCurrentStory(currentStory._id)}
                >
                  <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Tap Zones: Left (Previous) & Right (Next) */}
          <View style={styles.touchZonesContainer}>
            <TouchableWithoutFeedback onPress={handlePrevStory}>
              <View style={styles.leftTapZone} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback onPress={handleNextStory}>
              <View style={styles.rightTapZone} />
            </TouchableWithoutFeedback>
          </View>

          {/* Story Media / Text Content */}
          <View style={styles.viewerMediaContent} pointerEvents="none">
            {currentStory?.mediaType === 'text' ? (
              <View style={styles.fullscreenTextWrap}>
                <Text style={styles.fullscreenText}>{currentStory.caption}</Text>
              </View>
            ) : isVideoStory(currentStory) ? (
              <Video
                source={{ uri: getImageUrl(currentStory.mediaUrl) }}
                style={styles.storyFullVideo}
                resizeMode="contain"
                repeat
                paused={!viewerVisible}
                controls={false}
                onLoadStart={() => setMediaLoading(true)}
                onReadyForDisplay={() => setMediaLoading(false)}
                onLoad={() => setMediaLoading(false)}
                onError={(e) => {
                  console.warn('Status video error:', e);
                  setMediaLoading(false);
                }}
              />
            ) : currentStory?.mediaUrl ? (
              <Image
                source={{ uri: getImageUrl(currentStory.mediaUrl) }}
                style={styles.storyFullImage}
                resizeMode="contain"
                onLoadStart={() => setMediaLoading(true)}
                onLoadEnd={() => setMediaLoading(false)}
                onError={(e) => {
                  console.warn('Status image error:', e);
                  setMediaLoading(false);
                }}
              />
            ) : null}

            {/* Buffering / Loading Indicator */}
            {mediaLoading && currentStory?.mediaType !== 'text' && (
              <View style={styles.viewerLoadingOverlay}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.viewerLoadingText}>Loading status...</Text>
              </View>
            )}
          </View>

          {/* Story Caption */}
          {currentStory?.caption && currentStory.mediaType !== 'text' ? (
            <View style={styles.viewerCaptionBox}>
              <Text style={styles.viewerCaptionText}>{currentStory.caption}</Text>
            </View>
          ) : null}

          {/* For Own Status: Viewers Count Drawer */}
          {isOwnViewer && currentStory && (
            <TouchableOpacity
              style={styles.viewersCountPill}
              onPress={() => setViewersSheetVisible(true)}
            >
              <Ionicons name="eye-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.viewersCountText}>
                {currentStory.viewers?.length || 0} views
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Viewers List Modal (For Own Story) */}
        {isOwnViewer && (
          <Modal
            visible={viewersSheetVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setViewersSheetVisible(false)}
          >
            <View style={styles.sheetOverlay}>
              <View style={[styles.sheetContent, { backgroundColor: currentTheme.card }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: currentTheme.textPrimary }]}>
                    Viewed by {currentStory?.viewers?.length || 0}
                  </Text>
                  <TouchableOpacity onPress={() => setViewersSheetVisible(false)}>
                    <Ionicons name="close" size={24} color={currentTheme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.sheetList}>
                  {currentStory?.viewers && currentStory.viewers.length > 0 ? (
                    currentStory.viewers.map((v, i) => (
                      <View key={i} style={[styles.viewerRow, { borderBottomColor: currentTheme.border }]}>
                        <View style={styles.viewerAvatar}>
                          <Text style={styles.viewerAvatarText}>
                            {v.user?.fullName?.charAt(0) || 'U'}
                          </Text>
                        </View>
                        <View style={styles.viewerInfo}>
                          <Text style={[styles.viewerName, { color: currentTheme.textPrimary }]}>{v.user?.fullName || 'Contact'}</Text>
                          <Text style={[styles.viewerSeenTime, { color: currentTheme.textSecondary }]}>
                            {formatStoryTime(v.viewedAt)}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.noViewersText, { color: currentTheme.textSecondary }]}>No views yet</Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
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
  myStatusCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  myStatusMainRow: {
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
  storyRingNone: {
    borderWidth: 0,
  },
  storyRingActive: {
    borderWidth: 2.5,
    borderColor: '#00C49F',
  },
  multiStoryRing: {
    borderStyle: 'dashed',
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
  multiCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.accent,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  multiCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusTextWrap: {
    flex: 1,
  },
  statusUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  statusSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  myStatusActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 8,
    marginLeft: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  myUpdatesStrip: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  myUpdatesStripTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  myStoriesScroll: {
    flexDirection: 'row',
  },
  miniStoryThumb: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F2D37',
  },
  miniImageThumb: {
    width: '100%',
    height: '100%',
  },
  miniTextThumb: {
    width: '100%',
    height: '100%',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniTextThumbText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  miniViewersBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingVertical: 1,
  },
  miniViewersCount: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 3,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
  },
  emptyStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F2D37',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  fabBig: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewBox: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#000',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  captionWrap: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  captionInput: {
    fontSize: 14,
    color: '#0F172A',
    height: 44,
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  textStatusContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
    justifyContent: 'space-between',
  },
  textStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderColor: '#FFD700',
    transform: [{ scale: 1.2 }],
  },
  textStatusBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeTextInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    width: '100%',
  },
  textStatusFooter: {
    alignItems: 'flex-end',
  },
  postTextBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  segmentedProgressRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 12,
    zIndex: 10,
  },
  segmentBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginHorizontal: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    width: '0%',
  },
  segmentFillActive: {
    width: '100%',
    backgroundColor: '#00C49F',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 10,
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
    marginRight: 10,
  },
  smallAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewerNameBlock: {
    justifyContent: 'center',
  },
  viewerUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewerTime: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  viewerHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerDeleteBtn: {
    marginRight: 14,
    padding: 4,
  },
  touchZonesContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
  },
  leftTapZone: {
    width: '35%',
    height: '100%',
  },
  rightTapZone: {
    width: '65%',
    height: '100%',
  },
  viewerMediaContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenTextWrap: {
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
  },
  storyFullImage: {
    width: width,
    height: '80%',
  },
  storyFullVideo: {
    width: width,
    height: '80%',
  },
  viewerLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 50,
  },
  viewerLoadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  viewerCaptionBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  viewerCaptionText: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  viewersCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    zIndex: 10,
  },
  viewersCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetList: {
    maxHeight: 250,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
  },
  viewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  viewerAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  viewerSeenTime: {
    fontSize: 11,
    color: '#64748B',
  },
  noViewersText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
  },
});

export default StatusScreen;
