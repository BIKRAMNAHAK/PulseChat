import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  StatusBar,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  fetchFriendsAction,
  fetchGroupsAction,
  createGroupAction,
  updateUserStatusAction,
  fetchRequestsAction,
  acceptRequestAction,
  rejectRequestAction,
  clearUnreadCountAction,
} from '../Services/Actions/chatActions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import socketService from '../Services/socketService';
import { theme, getImageUrl, getThemeColors } from '../Services/helper';
import { TOGGLE_THEME } from '../Services/Reducers/themeReducer';

const ChatsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { friends, groups = [], incomingRequests = [] } = useSelector((state) => state.chat);
  const { user } = useSelector((state) => state.auth);
  const themeMode = useSelector((state) => state.theme?.mode || 'dark');
  const currentTheme = getThemeColors(themeMode);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'direct' | 'groups'
  const [acceptingReqId, setAcceptingReqId] = useState(null);

  // Create Group Modal State
  const [createGroupModal, setCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [groupPicAsset, setGroupPicAsset] = useState(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  const loadData = async () => {
    await Promise.all([
      dispatch(fetchFriendsAction()),
      dispatch(fetchGroupsAction()),
      dispatch(fetchRequestsAction()),
    ]);
  };

  const handleAcceptIncomingRequest = async (requestId, friend) => {
    try {
      setAcceptingReqId(requestId);
      await dispatch(acceptRequestAction(requestId));
      Alert.alert(
        'Friend Added! 🎉',
        `You and ${friend?.fullName || 'your friend'} are now connected! Chat unlocked.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Open Chat',
            onPress: () => {
              if (friend) {
                navigation.navigate('Chat', { recipient: friend });
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to accept friend request.');
    } finally {
      setAcceptingReqId(null);
    }
  };

  const handleRejectIncomingRequest = async (requestId) => {
    try {
      setAcceptingReqId(requestId);
      await dispatch(rejectRequestAction(requestId));
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to decline request.');
    } finally {
      setAcceptingReqId(null);
    }
  };

  // Automatically refresh friends list and unread counts whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      dispatch(fetchFriendsAction());
    }, [dispatch])
  );

  useEffect(() => {
    loadData();

    // Listen to real-time events on socket
    const handleReceiveMsg = () => {
      dispatch(fetchFriendsAction());
    };

    const handleSeen = () => {
      dispatch(fetchFriendsAction());
    };

    const handleStatusChanged = (data) => {
      dispatch(updateUserStatusAction(data));
      dispatch(fetchFriendsAction());
    };

    const handleGroupCreated = (newGroup) => {
      dispatch(fetchGroupsAction());
      socketService.joinGroup(newGroup._id);
    };

    const handleGroupUpdated = () => {
      dispatch(fetchGroupsAction());
    };

    const handleFriendReqReceived = (data) => {
      dispatch(fetchRequestsAction());
      Alert.alert(
        'New Friend Request! 👋',
        `${data?.sender?.fullName || 'Someone'} sent you a friend request! Accept to start chatting.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Accept Now',
            onPress: () => {
              if (data?.requestId) {
                handleAcceptIncomingRequest(data.requestId, data.sender);
              }
            },
          },
        ]
      );
    };

    const handleFriendReqAccepted = (data) => {
      dispatch(fetchFriendsAction());
      dispatch(fetchRequestsAction());
      Alert.alert(
        'Friend Request Accepted! 🎉',
        `${data?.friendName || 'Your friend'} accepted your request. You can now chat!`
      );
    };

    socketService.on('receive-message', handleReceiveMsg);
    socketService.on('messages-seen', handleSeen);
    socketService.on('user-status-changed', handleStatusChanged);
    socketService.on('friend-request-received', handleFriendReqReceived);
    socketService.on('friend-request-accepted', handleFriendReqAccepted);
    socketService.on('group-created', handleGroupCreated);
    socketService.on('group-updated', handleGroupUpdated);

    // Join all existing groups
    if (groups && groups.length > 0) {
      groups.forEach((g) => socketService.joinGroup(g._id));
    }

    return () => {
      socketService.off('receive-message', handleReceiveMsg);
      socketService.off('messages-seen', handleSeen);
      socketService.off('user-status-changed', handleStatusChanged);
      socketService.off('friend-request-received', handleFriendReqReceived);
      socketService.off('friend-request-accepted', handleFriendReqAccepted);
      socketService.off('group-created', handleGroupCreated);
      socketService.off('group-updated', handleGroupUpdated);
    };
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Group Creation Image Picker
  const pickGroupImage = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (!res.didCancel && res.assets && res.assets.length > 0) {
        setGroupPicAsset(res.assets[0]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open image library.');
    }
  };

  // Toggle Friend Selection for Group
  const toggleSelectFriend = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  // Submit New Group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name.');
      return;
    }
    if (selectedFriends.length === 0) {
      Alert.alert('Select Members', 'Please select at least 1 friend to form a group.');
      return;
    }

    try {
      setCreatingGroup(true);
      const formData = new FormData();
      formData.append('name', groupName.trim());
      formData.append('description', groupDesc.trim());
      formData.append('memberIds', JSON.stringify(selectedFriends));

      if (groupPicAsset) {
        formData.append('groupPic', {
          uri: groupPicAsset.uri,
          name: groupPicAsset.fileName || 'group.jpg',
          type: groupPicAsset.type || 'image/jpeg',
        });
      }

      await dispatch(createGroupAction(formData));
      setCreateGroupModal(false);
      setGroupName('');
      setGroupDesc('');
      setSelectedFriends([]);
      setGroupPicAsset(null);
      Alert.alert('Success', 'Group created successfully!');
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to create group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Filtered Online Friends for Active Tray
  const onlineFriends = friends.filter((f) => f.isOnline);

  // Formatting message timestamp
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Render Read Receipt Tick
  const renderTick = (status, isMine) => {
    if (!isMine) return null;
    if (status === 'seen') {
      return <Ionicons name="checkmark-done" size={16} color={theme.tickSeen} style={styles.tick} />;
    } else if (status === 'delivered') {
      return <Ionicons name="checkmark-done" size={16} color={theme.tickDelivered} style={styles.tick} />;
    } else {
      return <Ionicons name="checkmark" size={16} color={theme.tickSent} style={styles.tick} />;
    }
  };

  // Build unified chats/groups list
  let combinedItems = [];
  if (activeTab === 'all' || activeTab === 'direct') {
    friends.forEach((f) => {
      combinedItems.push({
        type: 'direct',
        id: f._id,
        data: f,
        timestamp: f.lastMessage?.createdAt ? new Date(f.lastMessage.createdAt).getTime() : 0,
      });
    });
  }
  if (activeTab === 'all' || activeTab === 'groups') {
    groups.forEach((g) => {
      combinedItems.push({
        type: 'group',
        id: g._id,
        data: g,
        timestamp: g.lastMessage?.createdAt ? new Date(g.lastMessage.createdAt).getTime() : 0,
      });
    });
  }

  // Sort list by latest message
  combinedItems.sort((a, b) => b.timestamp - a.timestamp);

  // Search filter
  const filteredList = combinedItems.filter((item) => {
    if (item.type === 'direct') {
      return item.data.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    } else {
      return item.data.name?.toLowerCase().includes(searchQuery.toLowerCase());
    }
  });

  // Render Direct Friend Chat Row
  const renderDirectChat = (item) => {
    const isMyLastMessage = item.lastMessage?.sender === user?._id;

    return (
      <TouchableOpacity
        key={`direct_${item._id}`}
        style={[styles.chatRow, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}
        activeOpacity={0.7}
        onPress={() => {
          dispatch(clearUnreadCountAction(item._id));
          navigation.navigate('Chat', {
            recipient: item,
          });
        }}
      >
        {/* Avatar with Real-time Online Green Dot */}
        <View style={styles.avatarWrap}>
          {item.profilePic ? (
            <Image source={{ uri: getImageUrl(item.profilePic) }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{item.fullName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {item.isOnline ? (
            <View style={styles.onlineBadgeGlow}>
              <View style={styles.onlineDot} />
            </View>
          ) : (
            <View style={styles.offlineDot} />
          )}
        </View>

        {/* Chat Details */}
        <View style={styles.chatDetails}>
          <View style={styles.topRow}>
            <View style={styles.nameWithStatusRow}>
              <Text style={[styles.userName, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                {item.fullName}
              </Text>
              {item.isOnline && (
                <View style={styles.liveOnlineTag}>
                  <Text style={styles.liveOnlineTagText}>ONLINE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.timeText, { color: currentTheme.textMuted }]}>{formatTime(item.lastMessage?.createdAt)}</Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.messagePreviewWrap}>
              {renderTick(item.lastMessage?.status, isMyLastMessage)}
              {item.lastMessage?.messageType === 'image' && (
                <Ionicons name="image-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.lastMessage, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                {item.lastMessage?.content ||
                  (item.lastMessage?.messageType === 'image' ? 'Photo' : item.about || 'Start conversation')}
              </Text>
            </View>

            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Direct Call Buttons on Card */}
        <View style={styles.cardCallActions}>
          <TouchableOpacity
            style={styles.cardCallBtn}
            onPress={() => navigation.navigate('Chat', { recipient: item, initiateCall: 'audio' })}
          >
            <Ionicons name="call" size={17} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardCallBtn}
            onPress={() => navigation.navigate('Chat', { recipient: item, initiateCall: 'video' })}
          >
            <Ionicons name="videocam" size={19} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Group Chat Row
  const renderGroupChat = (grp) => {
    return (
      <TouchableOpacity
        key={`group_${grp._id}`}
        style={[styles.chatRow, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('Chat', {
            group: grp,
          });
        }}
      >
        {/* Group Avatar */}
        <View style={styles.avatarWrap}>
          {grp.groupPic ? (
            <Image source={{ uri: grp.groupPic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: '#0B2228' }]}>
              <Ionicons name="people" size={24} color={theme.accent} />
            </View>
          )}
          <View style={styles.groupBadgeOverlay}>
            <Ionicons name="chatbubbles" size={10} color="#FFFFFF" />
          </View>
        </View>

        {/* Group Details */}
        <View style={styles.chatDetails}>
          <View style={styles.topRow}>
            <View style={styles.nameWithStatusRow}>
              <Text style={[styles.userName, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                {grp.name}
              </Text>
              <View style={styles.groupMemberCountTag}>
                <Text style={styles.groupMemberCountText}>
                  {grp.members?.length || 0} members
                </Text>
              </View>
            </View>
            <Text style={[styles.timeText, { color: currentTheme.textMuted }]}>{formatTime(grp.lastMessage?.createdAt || grp.updatedAt)}</Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.messagePreviewWrap}>
              <Ionicons name="people-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={[styles.lastMessage, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                {grp.lastMessage?.senderName ? `${grp.lastMessage.senderName}: ` : ''}
                {grp.lastMessage?.content || 'Tap to start group chat'}
              </Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  };

  const renderUnifiedItem = ({ item }) => {
    if (item.type === 'direct') {
      return renderDirectChat(item.data);
    } else {
      return renderGroupChat(item.data);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Top App Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top > 0 ? insets.top + 8 : 14 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandIconCircle}>
            <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>PulseChat</Text>
        </View>
        <View style={styles.topIcons}>
          {/* Theme Mode Switcher (Dark / Light) */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => dispatch({ type: TOGGLE_THEME })}
            activeOpacity={0.7}
          >
            <Ionicons
              name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={21}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setCreateGroupModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="people-circle" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSearch(!showSearch)}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar (Expandable) */}
      {showSearch && (
        <View style={[styles.searchBarWrap, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <Ionicons name="search" size={18} color={currentTheme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.textPrimary, backgroundColor: currentTheme.inputBackground }]}
            placeholder="Search conversations, friends or groups..."
            placeholderTextColor={currentTheme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={currentTheme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Filter Tabs: All | Direct | Groups */}
      <View style={[styles.tabFilterRow, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: activeTab === 'all' ? theme.accent : (themeMode === 'dark' ? '#1F2C34' : '#E2E8F0') },
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.filterChipText, { color: activeTab === 'all' ? '#FFFFFF' : currentTheme.textSecondary }]}>
            All ({friends.length + groups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: activeTab === 'direct' ? theme.accent : (themeMode === 'dark' ? '#1F2C34' : '#E2E8F0') },
          ]}
          onPress={() => setActiveTab('direct')}
        >
          <Text style={[styles.filterChipText, { color: activeTab === 'direct' ? '#FFFFFF' : currentTheme.textSecondary }]}>
            Chats ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: activeTab === 'groups' ? theme.accent : (themeMode === 'dark' ? '#1F2C34' : '#E2E8F0') },
          ]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.filterChipText, { color: activeTab === 'groups' ? '#FFFFFF' : currentTheme.textSecondary }]}>
            Groups ({groups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Incoming Friend Requests Banner / Action Cards */}
      {incomingRequests.length > 0 && (
        <View
          style={[
            styles.incomingBannerContainer,
            {
              backgroundColor: themeMode === 'dark' ? '#0E2A21' : '#F0FDF4',
              borderColor: themeMode === 'dark' ? '#15803D' : '#86EFAC',
            },
          ]}
        >
          <View style={styles.incomingBannerHeader}>
            <View style={styles.incomingBannerTitleRow}>
              <View style={styles.incomingBadgePill}>
                <Ionicons name="person-add" size={13} color="#FFFFFF" />
                <Text style={styles.incomingBadgeCount}>{incomingRequests.length}</Text>
              </View>
              <Text style={[styles.incomingBannerTitle, { color: themeMode === 'dark' ? '#86EFAC' : '#14532D' }]}>
                {incomingRequests.length === 1 ? 'New Friend Request' : `Friend Requests (${incomingRequests.length})`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Discover')}>
              <Text style={styles.viewAllRequestsText}>View in Discover →</Text>
            </TouchableOpacity>
          </View>

          {incomingRequests.map((req) => (
            <View
              key={`req_${req._id}`}
              style={[
                styles.incomingRequestCard,
                { backgroundColor: currentTheme.card, borderColor: currentTheme.border },
              ]}
            >
              <View style={styles.incomingAvatarWrap}>
                {req.sender?.profilePic ? (
                  <Image source={{ uri: req.sender.profilePic }} style={styles.incomingAvatar} />
                ) : (
                  <View style={styles.incomingAvatarPlaceholder}>
                    <Text style={styles.incomingAvatarInitial}>
                      {req.sender?.fullName?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.incomingInfoWrap}>
                <Text style={[styles.incomingSenderName, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                  {req.sender?.fullName || 'User'}
                </Text>
                <Text style={[styles.incomingSenderSub, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                  {req.sender?.about || 'Wants to connect with you'}
                </Text>
              </View>

              <View style={styles.incomingActionButtons}>
                <TouchableOpacity
                  style={styles.incomingAcceptBtn}
                  activeOpacity={0.8}
                  disabled={acceptingReqId === req._id}
                  onPress={() => handleAcceptIncomingRequest(req._id, req.sender)}
                >
                  {acceptingReqId === req._id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.incomingAcceptText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.incomingRejectBtn, { backgroundColor: themeMode === 'dark' ? '#1F2C34' : '#F1F5F9' }]}
                  activeOpacity={0.8}
                  disabled={acceptingReqId === req._id}
                  onPress={() => handleRejectIncomingRequest(req._id)}
                >
                  <Ionicons name="close" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Active Online Friends Horizontal Tray */}
      {onlineFriends.length > 0 && activeTab !== 'groups' && (
        <View style={[styles.onlineTrayContainer, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <View style={styles.onlineTrayHeader}>
            <View style={[styles.onlineIndicatorPill, { backgroundColor: themeMode === 'dark' ? '#112A26' : '#E6FAF5' }]}>
              <View style={styles.pulsingGreenDot} />
              <Text style={[styles.onlineTrayTitle, { color: theme.accent }]}>ONLINE FRIENDS ({onlineFriends.length})</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.onlineScrollList}
          >
            {onlineFriends.map((f) => (
              <TouchableOpacity
                key={`online_${f._id}`}
                style={styles.onlineAvatarItem}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Chat', { recipient: f })}
              >
                <View style={styles.onlineRingWrap}>
                  {f.profilePic ? (
                    <Image source={{ uri: f.profilePic }} style={styles.onlineTrayAvatar} />
                  ) : (
                    <View style={styles.onlineTrayAvatarPlaceholder}>
                      <Text style={styles.onlineTrayAvatarText}>{f.fullName?.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.onlineTrayGreenDot} />
                </View>
                <Text style={[styles.onlineTrayName, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                  {f.fullName?.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Unified List of Direct Friends & Groups */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        renderItem={renderUnifiedItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: themeMode === 'dark' ? '#112A26' : '#E6FAF5' }]}>
              <Ionicons
                name={activeTab === 'groups' ? 'people-outline' : 'chatbubbles-outline'}
                size={48}
                color={theme.accent}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: currentTheme.textPrimary }]}>
              {activeTab === 'groups' ? 'No Groups Created Yet' : 'No Conversations Yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
              {activeTab === 'groups'
                ? 'Create a group to chat with multiple friends at once!'
                : 'Connect with friends in Discover, or tap Create Group to start a group chat!'}
            </Text>
            {activeTab === 'groups' ? (
              <TouchableOpacity
                style={styles.findFriendsBtn}
                onPress={() => setCreateGroupModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.findFriendsBtnText}>Create New Group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.findFriendsBtn}
                onPress={() => navigation.navigate('Discover')}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.findFriendsBtnText}>Find Friend Suggestions</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Floating Action Buttons */}
      <View style={styles.fabColumn}>
        <TouchableOpacity
          style={styles.fabSecondary}
          activeOpacity={0.85}
          onPress={() => setCreateGroupModal(true)}
        >
          <Ionicons name="people" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Discover')}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* CREATE NEW GROUP MODAL */}
      <Modal
        visible={createGroupModal}
        animationType="slide"
        onRequestClose={() => setCreateGroupModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.background }]}>
          <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateGroupModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.modalHeaderTitle}>New Group</Text>
              <Text style={styles.modalHeaderSubtitle}>
                {selectedFriends.length} of {friends.length} selected
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalCreateBtn, creatingGroup && styles.disabledBtn]}
              onPress={handleCreateGroup}
              disabled={creatingGroup}
            >
              {creatingGroup ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalCreateBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Group Icon & Name Row */}
            <View style={[styles.groupInfoCard, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
              <TouchableOpacity style={styles.groupPicPicker} onPress={pickGroupImage}>
                {groupPicAsset ? (
                  <Image source={{ uri: groupPicAsset.uri }} style={styles.groupPicPreview} />
                ) : (
                  <View style={[styles.groupPicPlaceholder, { backgroundColor: themeMode === 'dark' ? '#1F2C34' : '#E2E8F0', borderColor: currentTheme.border }]}>
                    <Ionicons name="camera" size={26} color={currentTheme.textSecondary} />
                    <Text style={[styles.groupPicPickerText, { color: currentTheme.textSecondary }]}>Icon</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.groupInputWrap}>
                <TextInput
                  style={[styles.groupNameInput, { color: currentTheme.textPrimary }]}
                  placeholder="Group subject..."
                  placeholderTextColor={currentTheme.textMuted}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={50}
                />
                <TextInput
                  style={[styles.groupDescInput, { color: currentTheme.textSecondary }]}
                  placeholder="Description (optional)"
                  placeholderTextColor={currentTheme.textMuted}
                  value={groupDesc}
                  onChangeText={setGroupDesc}
                  maxLength={120}
                />
              </View>
            </View>

            {/* Selected Members Chips */}
            {selectedFriends.length > 0 && (
              <View style={[styles.selectedChipsSection, { borderBottomColor: currentTheme.border }]}>
                <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>Selected Participants</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {selectedFriends.map((fId) => {
                    const f = friends.find((fr) => fr._id === fId);
                    if (!f) return null;
                    return (
                      <View key={`chip_${f._id}`} style={[styles.memberChip, { backgroundColor: themeMode === 'dark' ? '#0F2D37' : '#E6FAF5', borderColor: theme.accent }]}>
                        <Text style={[styles.memberChipText, { color: theme.accent }]} numberOfLines={1}>
                          {f.fullName?.split(' ')[0]}
                        </Text>
                        <TouchableOpacity onPress={() => toggleSelectFriend(f._id)}>
                          <Ionicons name="close-circle" size={16} color="#DC2626" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Friend Selector Header & Search */}
            <View style={styles.selectFriendsHeader}>
              <Text style={[styles.selectFriendsTitle, { color: currentTheme.textPrimary }]}>Add Participants</Text>
              <View style={[styles.friendSearchBox, { backgroundColor: currentTheme.inputBackground }]}>
                <Ionicons name="search" size={16} color={currentTheme.textMuted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.friendSearchInput, { color: currentTheme.textPrimary }]}
                  placeholder="Search contacts..."
                  placeholderTextColor={currentTheme.textMuted}
                  value={friendSearchQuery}
                  onChangeText={setFriendSearchQuery}
                />
              </View>
            </View>

            {/* Friends Selection List */}
            {friends
              .filter((f) => f.fullName?.toLowerCase().includes(friendSearchQuery.toLowerCase()))
              .map((f) => {
                const isSelected = selectedFriends.includes(f._id);
                return (
                  <TouchableOpacity
                    key={`select_${f._id}`}
                    style={[
                      styles.friendSelectRow,
                      { borderBottomColor: currentTheme.border },
                      isSelected && (themeMode === 'dark' ? { backgroundColor: '#0F2D37' } : styles.friendSelectRowActive),
                    ]}
                    activeOpacity={0.7}
                    onPress={() => toggleSelectFriend(f._id)}
                  >
                    <View style={styles.avatarWrap}>
                      {f.profilePic ? (
                        <Image source={{ uri: f.profilePic }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitial}>{f.fullName?.charAt(0)}</Text>
                        </View>
                      )}
                      {f.isOnline && <View style={styles.onlineDot} />}
                    </View>

                    <View style={styles.friendSelectInfo}>
                      <Text style={[styles.friendSelectName, { color: currentTheme.textPrimary }]}>{f.fullName}</Text>
                      <Text style={[styles.friendSelectAbout, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                        {f.isOnline ? 'Online now' : f.about || 'PulseChat User'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.checkboxCircle,
                        { borderColor: currentTheme.border },
                        isSelected && styles.checkboxCircleChecked,
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}

            {friends.length === 0 && (
              <View style={styles.noFriendsInGroup}>
                <Ionicons name="person-outline" size={36} color="#CBD5E1" />
                <Text style={styles.noFriendsInGroupText}>
                  You need accepted friends to add them to a group. Connect in Discover first!
                </Text>
              </View>
            )}
          </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginLeft: 16,
    padding: 2,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  tabFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.accent,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  incomingBannerContainer: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 12,
    elevation: 2,
  },
  incomingBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incomingBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incomingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  incomingBadgeCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  incomingBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#14532D',
    letterSpacing: 0.3,
  },
  viewAllRequestsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  incomingRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    elevation: 1,
  },
  incomingAvatarWrap: {
    marginRight: 10,
  },
  incomingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  incomingAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  incomingInfoWrap: {
    flex: 1,
    marginRight: 8,
  },
  incomingSenderName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  incomingSenderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  incomingActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incomingAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 6,
    elevation: 1,
  },
  incomingAcceptText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  incomingRejectBtn: {
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 8,
  },
  onlineTrayContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FBFDFD',
  },
  onlineTrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  onlineIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FAF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pulsingGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00C49F',
    marginRight: 6,
  },
  onlineTrayTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  onlineScrollList: {
    paddingHorizontal: 14,
  },
  onlineAvatarItem: {
    alignItems: 'center',
    marginRight: 14,
    width: 58,
  },
  onlineRingWrap: {
    position: 'relative',
    padding: 2,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#00C49F',
  },
  onlineTrayAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  onlineTrayAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineTrayAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineTrayGreenDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00C49F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  onlineTrayName: {
    fontSize: 11.5,
    color: '#1E293B',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 90,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineBadgeGlow: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C49F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  offlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#94A3B8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  groupBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatDetails: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameWithStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  liveOnlineTag: {
    backgroundColor: '#E6FAF5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  liveOnlineTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00C49F',
  },
  groupMemberCountTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  groupMemberCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  timeText: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tick: {
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 13.5,
    color: '#64748B',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardCallActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  cardCallBtn: {
    padding: 8,
    marginLeft: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 50,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E6FAF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F2D37',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  findFriendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 3,
  },
  findFriendsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fabColumn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
  },
  fabSecondary: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  modalCreateBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  modalCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  modalBody: {
    flex: 1,
  },
  groupInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  groupPicPicker: {
    marginRight: 14,
  },
  groupPicPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  groupPicPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  groupPicPickerText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  groupInputWrap: {
    flex: 1,
  },
  groupNameInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    borderBottomWidth: 1.5,
    borderBottomColor: theme.accent,
    paddingVertical: 6,
    marginBottom: 8,
  },
  groupDescInput: {
    fontSize: 13,
    color: '#475569',
    paddingVertical: 4,
  },
  selectedChipsSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FAF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
  selectFriendsHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  selectFriendsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  friendSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  friendSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
  },
  friendSelectRowActive: {
    backgroundColor: '#F0FDF4',
  },
  friendSelectInfo: {
    flex: 1,
  },
  friendSelectName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  friendSelectAbout: {
    fontSize: 12.5,
    color: '#64748B',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircleChecked: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  noFriendsInGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 20,
  },
  noFriendsInGroupText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});

export default ChatsScreen;
