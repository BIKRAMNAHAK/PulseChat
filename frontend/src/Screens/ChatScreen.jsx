import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  fetchMessagesAction,
  sendMessageAction,
  unfollowUserAction,
} from '../Services/Actions/chatActions';
import socketService from '../Services/socketService';
import { theme } from '../Services/helper';
import VideoCallModal from '../Components/VideoCallModal';

const ChatScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const { recipient, initiateCall } = route.params || {};
  const { user } = useSelector((state) => state.auth);
  const { activeConversation } = useSelector((state) => state.chat);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [canChat, setCanChat] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(recipient?.isOnline || false);
  const [sending, setSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

  // Call Modal State
  const [callVisible, setCallVisible] = useState(!!initiateCall);
  const [callType, setCallType] = useState(initiateCall || 'video');
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1. Load Messages & Sync Status on Mount
  useEffect(() => {
    if (!recipient?._id) return;

    // Fetch conversation from server
    dispatch(fetchMessagesAction(recipient._id))
      .then((res) => {
        if (res) {
          setCanChat(res.canChat);
          setMessages(res.messages || []);
        }
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setCanChat(false);
        }
      });

    // Mark as seen immediately
    socketService.markSeen(recipient._id, user?._id);

    // Socket Listeners
    const handleReceiveMsg = (newMsg) => {
      if (
        newMsg.sender?._id === recipient._id ||
        newMsg.sender === recipient._id
      ) {
        setMessages((prev) => [...prev, newMsg]);
        // Mark as seen immediately since user is actively on this chat screen
        socketService.markSeen(recipient._id, user?._id);
      }
    };

    const handleMessagesSeen = (data) => {
      if (data.byUserId === recipient._id) {
        // Turns sender's ticks to double GREEN
        setMessages((prev) =>
          prev.map((m) =>
            m.sender === user?._id || m.sender?._id === user?._id
              ? { ...m, status: 'seen', seenAt: data.seenAt }
              : m
          )
        );
      }
    };

    const handleUserTyping = (data) => {
      if (data.senderId === recipient._id) {
        setIsTyping(data.isTyping);
      }
    };

    const handleStatusChanged = (data) => {
      if (data.userId === recipient._id) {
        setIsRecipientOnline(data.isOnline);
      }
    };

    const handleUserUnfollowed = (data) => {
      if (data.userId === recipient._id) {
        setCanChat(false);
        Alert.alert(
          'Chat Locked',
          'This user has unfollowed you. Chatting is now disabled.'
        );
      }
    };

    // Incoming Call Listener
    const handleIncomingCall = (callData) => {
      if (callData.from === recipient._id) {
        setCallType(callData.callType || 'video');
        setIsIncomingCall(true);
        setCallVisible(true);
      }
    };

    socketService.on('receive-message', handleReceiveMsg);
    socketService.on('messages-seen', handleMessagesSeen);
    socketService.on('user-typing', handleUserTyping);
    socketService.on('user-status-changed', handleStatusChanged);
    socketService.on('user-unfollowed', handleUserUnfollowed);
    socketService.on('incoming-call', handleIncomingCall);

    return () => {
      socketService.off('receive-message', handleReceiveMsg);
      socketService.off('messages-seen', handleMessagesSeen);
      socketService.off('user-typing', handleUserTyping);
      socketService.off('user-status-changed', handleStatusChanged);
      socketService.off('user-unfollowed', handleUserUnfollowed);
      socketService.off('incoming-call', handleIncomingCall);
    };
  }, [recipient?._id, user?._id, dispatch]);

  // Sync Redux active messages
  useEffect(() => {
    if (activeConversation.recipientId === recipient?._id) {
      setMessages(activeConversation.messages);
      setCanChat(activeConversation.canChat);
    }
  }, [activeConversation, recipient?._id]);

  // Handle typing indicator emission
  const handleInputChange = (text) => {
    setInputText(text);

    if (text.length > 0) {
      socketService.emitTyping(user?._id, recipient?._id, user?.fullName);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emitStopTyping(user?._id, recipient?._id);
      }, 2000);
    } else {
      socketService.emitStopTyping(user?._id, recipient?._id);
    }
  };

  // Send Text or Image Message
  const handleSendMessage = async (mediaUrl = '') => {
    if (!inputText.trim() && !mediaUrl) return;

    if (!canChat) {
      Alert.alert(
        'Chat Locked',
        'You cannot send messages because you are not mutual friends or this user has unfollowed.'
      );
      return;
    }

    const payload = {
      receiverId: recipient._id,
      content: inputText.trim(),
      messageType: mediaUrl ? 'image' : 'text',
      mediaUrl: mediaUrl || '',
    };

    setInputText('');
    socketService.emitStopTyping(user?._id, recipient?._id);

    try {
      setSending(true);
      const res = await dispatch(sendMessageAction(payload));
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Handle Unfollow / Unfriend
  const handleUnfollow = () => {
    setMenuVisible(false);
    Alert.alert(
      'Unfollow Contact?',
      `Are you sure you want to unfollow ${recipient?.fullName}? Chatting will be completely locked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow & Lock Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(unfollowUserAction(recipient._id));
              setCanChat(false);
              Alert.alert('Unfollowed', 'You have unfollowed this user. Chatting is disabled.');
            } catch (e) {
              Alert.alert('Error', 'Failed to unfollow user.');
            }
          },
        },
      ]
    );
  };

  // Render Green / Grey Ticks
  const renderReadTick = (status) => {
    if (status === 'seen') {
      // GREEN DOUBLE TICK - exactly as requested!
      return <Ionicons name="checkmark-done" size={16} color={theme.tickSeen} style={styles.bubbleTick} />;
    } else if (status === 'delivered') {
      return <Ionicons name="checkmark-done" size={16} color={theme.tickDelivered} style={styles.bubbleTick} />;
    } else {
      return <Ionicons name="checkmark" size={16} color={theme.tickSent} style={styles.bubbleTick} />;
    }
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageItem = ({ item }) => {
    const isMine = item.sender === user?._id || item.sender?._id === user?._id;

    return (
      <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.theirMessageRow]}>
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {/* Image Attachment (if image message) */}
          {item.mediaUrl ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setSelectedImageUrl(item.mediaUrl);
                setImageModalVisible(true);
              }}
            >
              <Image source={{ uri: item.mediaUrl }} style={styles.bubbleImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}

          {/* Message Text */}
          {item.content ? (
            <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
          ) : null}

          {/* Timestamp & Seen Tick */}
          <View style={styles.bubbleFooter}>
            <Text style={styles.bubbleTime}>{formatMessageTime(item.createdAt)}</Text>
            {isMine && renderReadTick(item.status)}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* WhatsApp Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Avatar & Online status */}
        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Profile', { userId: recipient?._id })}
        >
          <View style={styles.headerAvatarWrap}>
            {recipient?.profilePic ? (
              <Image source={{ uri: recipient.profilePic }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerPlaceholder}>
                <Text style={styles.headerInitial}>
                  {recipient?.fullName?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            {isRecipientOnline && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerName} numberOfLines={1}>
              {recipient?.fullName}
            </Text>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {isTyping
                ? 'typing...'
                : isRecipientOnline
                ? 'online'
                : 'offline'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Video Call & Audio Call & Options */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setCallType('video');
              setIsIncomingCall(false);
              setCallVisible(true);
            }}
          >
            <Ionicons name="videocam" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setCallType('audio');
              setIsIncomingCall(false);
              setCallVisible(true);
            }}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setMenuVisible(!menuVisible)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* WhatsApp Options Menu Modal */}
      {menuVisible && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}
          />
          <View style={styles.menuDropdown}>
            <TouchableOpacity style={styles.menuItem} onPress={handleUnfollow}>
              <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
              <Text style={styles.menuItemTextDanger}>Unfollow Contact</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setMessages([]);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#64748B" />
              <Text style={styles.menuItemText}>Clear Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chat Messages List (Wallpaper Background) */}
      <View style={styles.wallpaperBg}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item._id || String(index)}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View style={styles.encryptedBanner}>
              <Ionicons name="lock-closed" size={12} color="#64748B" />
              <Text style={styles.encryptedText}>
                Messages and calls are end-to-end encrypted and restricted to accepted friends.
              </Text>
            </View>
          }
        />
      </View>

      {/* Bottom Bar: Enabled if friends, LOCKED if unfollowed */}
      {canChat ? (
        <View style={styles.inputContainer}>
          <View style={styles.inputBar}>
            {/* Quick image sample attachment */}
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() =>
                handleSendMessage(
                  'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600'
                )
              }
            >
              <Ionicons name="image-outline" size={22} color={theme.accent} />
            </TouchableOpacity>

            <TextInput
              style={styles.chatInput}
              placeholder="Message..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
            />
          </View>

          {/* Send / Mic button */}
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => handleSendMessage()}
            disabled={sending || !inputText.trim()}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons
                name={inputText.trim() ? 'send' : 'mic'}
                size={20}
                color="#FFFFFF"
                style={inputText.trim() ? { marginLeft: 2 } : {}}
              />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Chat Locked Banner (When Unfollowed) */
        <View style={styles.unfollowedBanner}>
          <Ionicons name="lock-closed-outline" size={20} color="#DC2626" />
          <Text style={styles.unfollowedText}>
            Chatting is locked. You can only chat after sending and accepting a friend request.
          </Text>
        </View>
      )}

      {/* Video / Audio Call Modal */}
      <VideoCallModal
        visible={callVisible}
        callType={callType}
        isIncoming={isIncomingCall}
        targetUser={recipient}
        currentUser={user}
        onClose={() => setCallVisible(false)}
      />

      {/* Image Preview Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageViewerBackdrop}>
          <TouchableOpacity
            style={styles.closeImageBtn}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImageUrl ? (
            <Image
              source={{ uri: selectedImageUrl }}
              style={styles.fullPreviewImg}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F2D37',
  },
  chatHeader: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    elevation: 4,
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#07161A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInitial: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: theme.onlineBadge,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerStatus: {
    fontSize: 11.5,
    color: '#00C49F',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 6,
  },
  menuOverlay: {
    position: 'absolute',
    top: 55,
    right: 10,
    zIndex: 999,
  },
  menuBackdrop: {
    position: 'absolute',
    top: -100,
    left: -400,
    right: -100,
    bottom: -1000,
  },
  menuDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    minWidth: 180,
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#0F172A',
    marginLeft: 10,
  },
  menuItemTextDanger: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 10,
  },
  wallpaperBg: {
    flex: 1,
    backgroundColor: '#EFEAE2',
  },
  messagesList: {
    padding: 14,
    paddingBottom: 20,
  },
  encryptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  encryptedText: {
    fontSize: 11.5,
    color: '#78350F',
    marginLeft: 6,
    textAlign: 'center',
  },
  messageRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: theme.senderBubble,
    borderTopRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: theme.receiverBubble,
    borderTopLeftRadius: 2,
  },
  bubbleImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  myText: {
    color: '#0F2D37',
  },
  theirText: {
    color: '#0F172A',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  bubbleTime: {
    fontSize: 10,
    color: '#64748B',
  },
  bubbleTick: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  inputBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 12,
    elevation: 2,
    minHeight: 46,
    maxHeight: 100,
  },
  attachBtn: {
    padding: 6,
    marginRight: 4,
  },
  chatInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    paddingVertical: 8,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    elevation: 3,
  },
  unfollowedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  unfollowedText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  imageViewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullPreviewImg: {
    width: '100%',
    height: '80%',
  },
});

export default ChatScreen;
