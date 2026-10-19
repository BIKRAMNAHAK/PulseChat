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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { fetchFriendsAction } from '../Services/Actions/chatActions';
import socketService from '../Services/socketService';
import { theme } from '../Services/helper';

const ChatsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { friends } = useSelector((state) => state.chat);
  const { user } = useSelector((state) => state.auth);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    dispatch(fetchFriendsAction());

    // Listen to real-time events on socket
    const handleReceiveMsg = (newMsg) => {
      dispatch(fetchFriendsAction());
    };

    const handleSeen = () => {
      dispatch(fetchFriendsAction());
    };

    const handleStatusChanged = () => {
      dispatch(fetchFriendsAction());
    };

    socketService.on('receive-message', handleReceiveMsg);
    socketService.on('messages-seen', handleSeen);
    socketService.on('user-status-changed', handleStatusChanged);
    socketService.on('friend-request-accepted', () => dispatch(fetchFriendsAction()));

    return () => {
      socketService.off('receive-message', handleReceiveMsg);
      socketService.off('messages-seen', handleSeen);
      socketService.off('user-status-changed', handleStatusChanged);
    };
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchFriendsAction());
    setRefreshing(false);
  };

  const filteredFriends = friends.filter((f) =>
    f.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const renderItem = ({ item }) => {
    const isMyLastMessage = item.lastMessage?.sender === user?._id;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('Chat', {
            recipient: item,
          });
        }}
      >
        {/* Avatar with Online Green Dot */}
        <View style={styles.avatarWrap}>
          {item.profilePic ? (
            <Image source={{ uri: item.profilePic }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{item.fullName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>

        {/* Chat Details */}
        <View style={styles.chatDetails}>
          <View style={styles.topRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.fullName}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.lastMessage?.createdAt)}</Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.messagePreviewWrap}>
              {renderTick(item.lastMessage?.status, isMyLastMessage)}
              {item.lastMessage?.messageType === 'image' && (
                <Ionicons name="image-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
              )}
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage?.content || (item.lastMessage?.messageType === 'image' ? 'Photo' : item.about || 'Start conversation')}
              </Text>
            </View>

            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* WhatsApp-style Direct Call Buttons on Card */}
        <View style={styles.cardCallActions}>
          <TouchableOpacity
            style={styles.cardCallBtn}
            onPress={() =>
              navigation.navigate('Chat', { recipient: item, initiateCall: 'audio' })
            }
          >
            <Ionicons name="call" size={18} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardCallBtn}
            onPress={() =>
              navigation.navigate('Chat', { recipient: item, initiateCall: 'video' })
            }
          >
            <Ionicons name="videocam" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* WhatsApp App Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandIconCircle}>
            <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>PulseChat</Text>
        </View>
        <View style={styles.topIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar (Expandable) */}
      {showSearch && (
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Friends / Chats List */}
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.accent} />
            </View>
            <Text style={styles.emptyTitle}>No Chats Yet</Text>
            <Text style={styles.emptySubtitle}>
              You need to connect with friends first! Go to Discover to find registered friends and send connection requests.
            </Text>
            <TouchableOpacity
              style={styles.findFriendsBtn}
              onPress={() => navigation.navigate('Discover')}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.findFriendsBtnText}>Find Friend Suggestions</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* WhatsApp Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Discover')}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
      </TouchableOpacity>
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
  cardCallActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  cardCallBtn: {
    padding: 8,
    marginLeft: 2,
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginLeft: 18,
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
  listContent: {
    flexGrow: 1,
    paddingBottom: 80,
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
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.onlineBadge,
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
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 60,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
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
});

export default ChatsScreen;
