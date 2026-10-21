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
  ScrollView,
  Keyboard,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  fetchMessagesAction,
  sendMessageAction,
  unfollowUserAction,
  fetchGroupMessagesAction,
  sendGroupMessageAction,
  acceptRequestAction,
  sendFriendRequestAction,
  clearUnreadCountAction,
  editMessageAction,
  deleteMessageAction,
} from '../Services/Actions/chatActions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import socketService from '../Services/socketService';
import { theme, postApi, getImageUrl, getThemeColors } from '../Services/helper';
import VideoCallModal from '../Components/VideoCallModal';

const ChatScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { recipient, group, initiateCall } = route.params || {};
  const isGroup = !!group;

  const { user } = useSelector((state) => state.auth);
  const { activeConversation, incomingRequests = [], sentRequests = [] } = useSelector((state) => state.chat);
  const themeMode = useSelector((state) => state.theme?.mode || 'dark');
  const currentTheme = getThemeColors(themeMode);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [canChat, setCanChat] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(recipient?.isOnline || false);
  const [sending, setSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [groupInfoModal, setGroupInfoModal] = useState(false);

  // Message Action Sheet & Edit States
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Call Modal State (1-on-1)
  const [callVisible, setCallVisible] = useState(!!initiateCall && !isGroup);
  const [callType, setCallType] = useState(initiateCall || 'video');
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll on keyboard popup
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Deduplicate and append message
  const appendUniqueMessage = (newMsg) => {
    if (!newMsg) return;
    setMessages((prev) => {
      const exists = prev.some((m) => {
        if (m._id && newMsg._id) {
          return m._id.toString() === newMsg._id.toString();
        }
        return false;
      });
      if (exists) return prev;
      return [...prev, newMsg];
    });
  };

  const incomingReqFromThisRecipient = !isGroup && incomingRequests.find(
    (r) => r.sender?._id === recipient?._id || r.sender === recipient?._id
  );
  const sentReqToThisRecipient = !isGroup && sentRequests.find(
    (r) => r.receiver?._id === recipient?._id || r.receiver === recipient?._id
  );

  // 1. Load Messages & Sync Status on Mount
  useEffect(() => {
    const handleMessageEdited = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id && data.messageId && m._id.toString() === data.messageId.toString()
            ? {
                ...m,
                content: data.content,
                isEdited: true,
                editedAt: data.editedAt || new Date(),
              }
            : m
        )
      );
    };

    const handleMessageDeleted = (data) => {
      if (data.deleteType === 'everyone') {
        setMessages((prev) =>
          prev.map((m) =>
            m._id && data.messageId && m._id.toString() === data.messageId.toString()
              ? {
                  ...m,
                  isDeleted: true,
                  content: 'This message was deleted',
                  mediaUrl: '',
                }
              : m
          )
        );
      }
    };

    if (isGroup) {
      // Group Chat Setup
      socketService.joinGroup(group._id);

      dispatch(fetchGroupMessagesAction(group._id))
        .then((res) => {
          if (res?.messages) {
            setMessages(res.messages);
          }
        })
        .catch((err) => {
          Alert.alert('Error', err?.message || 'Could not load group messages.');
        });

      const handleReceiveGroupMsg = (data) => {
        if (data.groupId === group._id) {
          appendUniqueMessage(data.message);
        }
      };

      socketService.on('receive-group-message', handleReceiveGroupMsg);
      socketService.on('message-edited', handleMessageEdited);
      socketService.on('message-deleted', handleMessageDeleted);

      return () => {
        socketService.off('receive-group-message', handleReceiveGroupMsg);
        socketService.off('message-edited', handleMessageEdited);
        socketService.off('message-deleted', handleMessageDeleted);
        socketService.leaveGroup(group._id);
      };
    } else {
      // Direct 1-on-1 Chat Setup
      if (!recipient?._id) return;

      // Immediately clear unread badge in Redux
      dispatch(clearUnreadCountAction(recipient._id));

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

      const handleReceiveMsg = (newMsg) => {
        if (
          newMsg.sender?._id === recipient._id ||
          newMsg.sender === recipient._id
        ) {
          appendUniqueMessage(newMsg);
          socketService.markSeen(recipient._id, user?._id);
        }
      };

      const handleMessagesSeen = (data) => {
        if (data.byUserId === recipient._id) {
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
      socketService.on('message-edited', handleMessageEdited);
      socketService.on('message-deleted', handleMessageDeleted);

      return () => {
        socketService.off('receive-message', handleReceiveMsg);
        socketService.off('messages-seen', handleMessagesSeen);
        socketService.off('user-typing', handleUserTyping);
        socketService.off('user-status-changed', handleStatusChanged);
        socketService.off('user-unfollowed', handleUserUnfollowed);
        socketService.off('incoming-call', handleIncomingCall);
        socketService.off('message-edited', handleMessageEdited);
        socketService.off('message-deleted', handleMessageDeleted);
      };
    }
  }, [recipient?._id, group?._id, user?._id, isGroup, dispatch]);

  // Sync Redux active messages for 1-on-1 chat with deduplication
  useEffect(() => {
    if (!isGroup && activeConversation.recipientId === recipient?._id) {
      if (activeConversation.messages && activeConversation.messages.length > 0) {
        setMessages(() => {
          const seen = new Set();
          const unique = [];
          for (const m of activeConversation.messages) {
            const key = m._id ? m._id.toString() : null;
            if (!key || !seen.has(key)) {
              if (key) seen.add(key);
              unique.push(m);
            }
          }
          return unique;
        });
      }
      setCanChat(activeConversation.canChat);
    }
  }, [activeConversation.messages, activeConversation.recipientId, activeConversation.canChat, recipient?._id, isGroup]);

  // Handle typing indicator emission (1-on-1 only)
  const handleInputChange = (text) => {
    setInputText(text);

    if (!isGroup && recipient?._id) {
      if (text.length > 0) {
        socketService.emitTyping(user?._id, recipient._id, user?.fullName);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socketService.emitStopTyping(user?._id, recipient._id);
        }, 2000);
      } else {
        socketService.emitStopTyping(user?._id, recipient._id);
      }
    }
  };

  // Pick Image from Gallery
  const handlePickAndSendImage = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (!res.didCancel && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const formData = new FormData();
        formData.append('media', {
          uri: asset.uri,
          name: asset.fileName || 'chat_image.jpg',
          type: asset.type || 'image/jpeg',
        });
        formData.append('messageType', 'image');

        if (isGroup) {
          formData.append('groupId', group._id);
          formData.append('content', inputText.trim() || 'Photo');
          setSending(true);
          const response = await dispatch(sendGroupMessageAction(formData, true));
          if (response?.message) {
            appendUniqueMessage(response.message);
          }
        } else {
          formData.append('receiverId', recipient._id);
          formData.append('content', inputText.trim() || 'Photo');
          setSending(true);
          const response = await dispatch(sendMessageAction(formData, true));
          if (response?.message) {
            appendUniqueMessage(response.message);
          }
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setSending(false);
    }
  };

  // Send Text Message
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    if (!isGroup && !canChat) {
      Alert.alert(
        'Chat Locked',
        'You cannot send messages because you are not mutual friends or this user has unfollowed.'
      );
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');

    try {
      setSending(true);
      if (isGroup) {
        const res = await dispatch(
          sendGroupMessageAction({
            groupId: group._id,
            content: textToSend,
            messageType: 'text',
          })
        );
        if (res?.message) {
          appendUniqueMessage(res.message);
        }
      } else {
        socketService.emitStopTyping(user?._id, recipient._id);
        const res = await dispatch(
          sendMessageAction({
            receiverId: recipient._id,
            content: textToSend,
            messageType: 'text',
          })
        );
        if (res?.message) {
          appendUniqueMessage(res.message);
        }
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = () => {
    setMenuVisible(false);
    Alert.alert('Leave Group', `Are you sure you want to leave ${group?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave Group',
        style: 'destructive',
        onPress: async () => {
          try {
            await postApi('/group/leave', { groupId: group._id });
            socketService.leaveGroup(group._id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', 'Failed to leave group.');
          }
        },
      },
    ]);
  };

  // Handle Unfollow (1-on-1)
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

  // Render Green / Grey Ticks for direct chat
  const renderReadTick = (status) => {
    if (status === 'seen') {
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

  // Message Action Handlers (Edit / Delete)
  const handleMessageLongPress = (item) => {
    setSelectedMessage(item);
    setMessageActionModalVisible(true);
  };

  const handleStartEdit = () => {
    setMessageActionModalVisible(false);
    if (!selectedMessage) return;
    setEditingText(selectedMessage.content || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingText.trim()) {
      Alert.alert('Empty', 'Message content cannot be empty.');
      return;
    }
    if (!selectedMessage) return;

    try {
      setActionLoading(true);
      await dispatch(editMessageAction(selectedMessage._id, editingText.trim()));
      setMessages((prev) =>
        prev.map((m) =>
          m._id && selectedMessage._id && m._id.toString() === selectedMessage._id.toString()
            ? { ...m, content: editingText.trim(), isEdited: true, editedAt: new Date() }
            : m
        )
      );
      setEditModalVisible(false);
      setSelectedMessage(null);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err?.message || 'Failed to edit message.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteForEveryone = () => {
    setMessageActionModalVisible(false);
    if (!selectedMessage) return;

    Alert.alert(
      'Delete for everyone?',
      'This message will be deleted for everyone in this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for Everyone',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await dispatch(deleteMessageAction(selectedMessage._id, 'everyone'));
              setMessages((prev) =>
                prev.map((m) =>
                  m._id && selectedMessage._id && m._id.toString() === selectedMessage._id.toString()
                    ? { ...m, isDeleted: true, content: 'This message was deleted', mediaUrl: '' }
                    : m
                )
              );
              setSelectedMessage(null);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err?.message || 'Failed to delete message.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteForMe = () => {
    setMessageActionModalVisible(false);
    if (!selectedMessage) return;

    Alert.alert(
      'Delete for me?',
      'This message will be removed from your chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for Me',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await dispatch(deleteMessageAction(selectedMessage._id, 'me'));
              setMessages((prev) =>
                prev.filter(
                  (m) => !(m._id && selectedMessage._id && m._id.toString() === selectedMessage._id.toString())
                )
              );
              setSelectedMessage(null);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err?.message || 'Failed to delete message.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderMessageItem = ({ item }) => {
    const isMine = item.sender === user?._id || item.sender?._id === user?._id;
    const senderName = item.sender?.fullName || 'Member';
    const isDeleted = !!item.isDeleted;

    return (
      <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.theirMessageRow]}>
        <TouchableOpacity
          activeOpacity={0.88}
          onLongPress={() => handleMessageLongPress(item)}
          delayLongPress={300}
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myBubble, { backgroundColor: currentTheme.outgoingBubble }]
              : [styles.theirBubble, { backgroundColor: currentTheme.incomingBubble }],
            isDeleted && [styles.deletedBubble, themeMode === 'dark' && { backgroundColor: currentTheme.surface }],
          ]}
        >
          {/* In Group Chat: Show Sender Name on Left Bubble */}
          {isGroup && !isMine && (
            <Text style={styles.groupSenderName}>{senderName}</Text>
          )}

          {isDeleted ? (
            <View style={styles.deletedRow}>
              <Ionicons name="ban-outline" size={14} color={currentTheme.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.deletedText, { color: currentTheme.textMuted }]}>This message was deleted</Text>
            </View>
          ) : (
            <>
              {/* Image Attachment (if image message) */}
              {item.mediaUrl ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedImageUrl(getImageUrl(item.mediaUrl));
                    setImageModalVisible(true);
                  }}
                  onLongPress={() => handleMessageLongPress(item)}
                  delayLongPress={300}
                >
                  <Image
                    source={{ uri: getImageUrl(item.mediaUrl) }}
                    style={styles.bubbleImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : null}

              {/* Message Text */}
              {item.content ? (
                <Text
                  style={[
                    styles.messageText,
                    { color: isMine ? currentTheme.myMessageText : currentTheme.theirMessageText },
                  ]}
                >
                  {item.content}
                </Text>
              ) : null}
            </>
          )}

          {/* Timestamp, Edited Tag & Seen Tick */}
          <View style={styles.bubbleFooter}>
            {item.isEdited && !isDeleted && (
              <Text style={[styles.editedLabel, { color: currentTheme.bubbleTime }]}>edited</Text>
            )}
            <Text style={[styles.bubbleTime, { color: currentTheme.bubbleTime }]}>{formatMessageTime(item.createdAt)}</Text>
            {isMine && !isGroup && !isDeleted && renderReadTick(item.status)}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
    >
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* WhatsApp Chat Header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top > 0 ? insets.top + 6 : 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Avatar & Online status or Group info */}
        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.8}
          onPress={() => {
            if (isGroup) {
              setGroupInfoModal(true);
            } else {
              navigation.navigate('Profile', { userId: recipient?._id, profileUser: recipient });
            }
          }}
        >
          <View style={styles.headerAvatarWrap}>
            {isGroup ? (
              group?.groupPic ? (
                <Image source={{ uri: group.groupPic }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerPlaceholder, { backgroundColor: '#0B2228' }]}>
                  <Ionicons name="people" size={22} color={theme.accent} />
                </View>
              )
            ) : recipient?.profilePic ? (
              <Image source={{ uri: recipient.profilePic }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerPlaceholder}>
                <Text style={styles.headerInitial}>{recipient?.fullName?.charAt(0) || 'U'}</Text>
              </View>
            )}
            {!isGroup && isRecipientOnline && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerName} numberOfLines={1}>
              {isGroup ? group?.name : recipient?.fullName}
            </Text>
            {isGroup ? (
              <Text style={styles.headerGroupSubtitle} numberOfLines={1}>
                {group?.members?.length || 0} participants
              </Text>
            ) : (
              <Text
                style={[
                  styles.headerStatus,
                  isRecipientOnline && styles.headerStatusOnline,
                ]}
                numberOfLines={1}
              >
                {isTyping ? 'typing...' : isRecipientOnline ? 'Online' : 'Offline'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          {!isGroup && (
            <>
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
            </>
          )}

          {isGroup && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setGroupInfoModal(true)}
            >
              <Ionicons name="information-circle-outline" size={23} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setMenuVisible(!menuVisible)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Options Menu Modal */}
      {menuVisible && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}
          />
          <View style={[styles.menuDropdown, { backgroundColor: currentTheme.card }]}>
            {isGroup ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    setGroupInfoModal(true);
                  }}
                >
                  <Ionicons name="people-outline" size={18} color={currentTheme.textPrimary} />
                  <Text style={[styles.menuItemText, { color: currentTheme.textPrimary }]}>Group Info</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleLeaveGroup}>
                  <Ionicons name="exit-outline" size={18} color="#EF4444" />
                  <Text style={styles.menuItemTextDanger}>Leave Group</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
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
                  <Ionicons name="trash-outline" size={18} color={currentTheme.textSecondary} />
                  <Text style={[styles.menuItemText, { color: currentTheme.textPrimary }]}>Clear Chat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Chat Messages List (Wallpaper Background) */}
      <View style={[styles.wallpaperBg, { backgroundColor: currentTheme.wallpaperBg }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item._id ? `${item._id}_${index}` : String(index)}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View
              style={[
                styles.encryptedBanner,
                themeMode === 'dark' && { backgroundColor: currentTheme.surface, borderWidth: 1, borderColor: currentTheme.border },
              ]}
            >
              <Ionicons name="lock-closed" size={12} color={currentTheme.textMuted} />
              <Text
                style={[
                  styles.encryptedText,
                  themeMode === 'dark' && { color: currentTheme.textSecondary },
                ]}
              >
                {isGroup
                  ? 'Group messages are end-to-end encrypted among participants.'
                  : 'Messages and calls are end-to-end encrypted and restricted to accepted friends.'}
              </Text>
            </View>
          }
        />
      </View>

      {/* Bottom Input Bar */}
      {canChat ? (
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: currentTheme.inputContainerBg, paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom, 8) },
          ]}
        >
          <View
            style={[
              styles.inputBar,
              { backgroundColor: currentTheme.inputBarBg, borderColor: currentTheme.border, borderWidth: themeMode === 'dark' ? 1 : 0 },
            ]}
          >
            {/* Gallery Image Picker */}
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={handlePickAndSendImage}
            >
              <Ionicons name="camera-outline" size={22} color={theme.accent} />
            </TouchableOpacity>

            <TextInput
              style={[styles.chatInput, { color: currentTheme.inputText }]}
              placeholder="Message..."
              placeholderTextColor={currentTheme.inputPlaceholder}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSendMessage}
            disabled={sending || !inputText.trim()}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.lockedBarActionContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {incomingReqFromThisRecipient ? (
            <View style={styles.lockedBarContent}>
              <View style={styles.lockedBarTextRow}>
                <Ionicons name="person-add" size={18} color="#16A34A" style={{ marginRight: 8 }} />
                <Text style={styles.lockedBarActionTitle} numberOfLines={1}>
                  {recipient?.fullName || 'User'} sent you a friend request!
                </Text>
              </View>
              <TouchableOpacity
                style={styles.lockedBarAcceptBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    await dispatch(acceptRequestAction(incomingReqFromThisRecipient._id));
                    setCanChat(true);
                    Alert.alert('Request Accepted! 🎉', 'You are now friends and can chat.');
                  } catch (e) {
                    Alert.alert('Error', e?.message || 'Failed to accept request.');
                  }
                }}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.lockedBarAcceptBtnText}>Accept Request Now</Text>
              </TouchableOpacity>
            </View>
          ) : sentReqToThisRecipient ? (
            <View style={styles.lockedBarTextRowCenter}>
              <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.lockedBarPendingText}>
                Friend request sent. Waiting for {recipient?.fullName?.split(' ')[0] || 'them'} to accept.
              </Text>
            </View>
          ) : (
            <View style={styles.lockedBarContent}>
              <View style={styles.lockedBarTextRow}>
                <Ionicons name="lock-closed" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={styles.lockedBarText}>
                  Chat is locked. Connect as friends to start chatting.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.lockedBarSendReqBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    await dispatch(sendFriendRequestAction(recipient?._id));
                    Alert.alert('Request Sent! 🚀', `Friend request sent to ${recipient?.fullName || 'user'}.`);
                  } catch (e) {
                    Alert.alert('Notice', e.response?.data?.message || 'Request could not be sent.');
                  }
                }}
              >
                <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.lockedBarAcceptBtnText}>Send Friend Request</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalBg}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImageUrl ? (
            <Image
              source={{ uri: getImageUrl(selectedImageUrl) }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* Message Action Sheet Modal (WhatsApp style) */}
      <Modal
        visible={messageActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMessageActionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMessageActionModalVisible(false)}
        >
          <View style={[styles.actionSheetContainer, { backgroundColor: currentTheme.card }]}>
            <View style={styles.dragHandle} />
            <View style={styles.actionSheetHeader}>
              <Text style={[styles.actionSheetTitle, { color: currentTheme.textSecondary }]}>MESSAGE OPTIONS</Text>
            </View>

            {/* Edit Option: only for sender, if not deleted, and not an image/call log */}
            {selectedMessage &&
              (selectedMessage.sender === user?._id || selectedMessage.sender?._id === user?._id) &&
              !selectedMessage.isDeleted &&
              selectedMessage.messageType !== 'image' && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={handleStartEdit}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: themeMode === 'dark' ? '#0F2D37' : '#E0F2FE' }]}>
                    <Ionicons name="pencil" size={18} color={theme.accent} />
                  </View>
                  <Text style={[styles.actionSheetText, { color: currentTheme.textPrimary }]}>Edit Message</Text>
                </TouchableOpacity>
              )}

            {/* Delete for Everyone: only for sender and if not already deleted */}
            {selectedMessage &&
              (selectedMessage.sender === user?._id || selectedMessage.sender?._id === user?._id) &&
              !selectedMessage.isDeleted && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={handleDeleteForEveryone}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: themeMode === 'dark' ? '#3B1219' : '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.actionSheetText, { color: '#EF4444' }]}>
                    Delete for Everyone
                  </Text>
                </TouchableOpacity>
              )}

            {/* Delete for Me: always available */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={handleDeleteForMe}
            >
              <View style={[styles.actionIconBox, { backgroundColor: themeMode === 'dark' ? '#1F2C34' : '#F1F5F9' }]}>
                <Ionicons name="trash-bin-outline" size={18} color={currentTheme.textSecondary} />
              </View>
              <Text style={[styles.actionSheetText, { color: currentTheme.textPrimary }]}>Delete for Me</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.actionSheetItem, styles.cancelActionItem]}
              onPress={() => setMessageActionModalVisible(false)}
            >
              <Text style={[styles.cancelActionText, { color: currentTheme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.editModalContainer, { backgroundColor: currentTheme.card }]}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.editModalTitle, { color: currentTheme.textPrimary }]}>Edit Message</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color={currentTheme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.editTextInput, { backgroundColor: currentTheme.inputBackground, color: currentTheme.textPrimary }]}
              value={editingText}
              onChangeText={setEditingText}
              multiline
              autoFocus
              placeholder="Edit your message..."
              placeholderTextColor={currentTheme.textMuted}
            />

            <View style={styles.editModalBtnRow}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.editCancelText, { color: currentTheme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={handleSaveEdit}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editSaveText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Group Info Modal */}
      {isGroup && (
        <Modal
          visible={groupInfoModal}
          animationType="slide"
          onRequestClose={() => setGroupInfoModal(false)}
        >
          <View style={[styles.groupModalContainer, { backgroundColor: currentTheme.background }]}>
            <View style={styles.groupModalHeader}>
              <TouchableOpacity onPress={() => setGroupInfoModal(false)}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.groupModalTitle}>Group Info</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.groupModalContent}>
              <View style={styles.groupModalAvatarWrap}>
                {group.groupPic ? (
                  <Image source={{ uri: group.groupPic }} style={styles.groupModalAvatar} />
                ) : (
                  <View style={[styles.groupModalAvatarPlaceholder, { backgroundColor: '#0B2228' }]}>
                    <Ionicons name="people" size={48} color={theme.accent} />
                  </View>
                )}
                <Text style={[styles.groupModalName, { color: currentTheme.textPrimary }]}>{group.name}</Text>
                <Text style={[styles.groupModalSubtitle, { color: currentTheme.textSecondary }]}>
                  Group • {group.members?.length || 0} participants
                </Text>
                {group.description ? (
                  <Text style={[styles.groupModalDesc, { color: currentTheme.textSecondary }]}>{group.description}</Text>
                ) : null}
              </View>

              <View style={styles.groupMembersSection}>
                <Text style={[styles.groupMembersTitle, { color: currentTheme.textSecondary }]}>PARTICIPANTS</Text>
                {group.members?.map((member) => (
                  <View key={member._id} style={[styles.memberRow, { borderBottomColor: currentTheme.border }]}>
                    <View style={styles.memberAvatarWrap}>
                      {member.profilePic ? (
                        <Image source={{ uri: member.profilePic }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                          <Text style={styles.memberAvatarInitial}>{member.fullName?.charAt(0)}</Text>
                        </View>
                      )}
                      {member.isOnline && <View style={styles.onlineDot} />}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: currentTheme.textPrimary }]}>
                        {member.fullName} {member._id === user?._id ? '(You)' : ''}
                      </Text>
                      <Text style={[styles.memberStatus, { color: currentTheme.textSecondary }]}>
                        {member.isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    {group.admin === member._id || group.admin?._id === member._id ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Group Admin</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.leaveGroupBtn} onPress={handleLeaveGroup}>
                <Ionicons name="exit-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.leaveGroupBtnText}>Exit Group</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Video / Audio WebRTC Call Modal (1-on-1 only) */}
      {!isGroup && recipient && (
        <VideoCallModal
          visible={callVisible}
          callType={callType}
          targetUser={recipient}
          recipient={recipient}
          currentUser={user}
          isIncoming={isIncomingCall}
          onClose={() => setCallVisible(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  chatHeader: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    elevation: 4,
  },
  backBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
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
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#00C49F',
    borderWidth: 2,
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
    fontSize: 12,
    color: '#CBD5E1',
  },
  headerStatusOnline: {
    color: '#00C49F',
    fontWeight: '700',
  },
  headerGroupSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  menuOverlay: {
    position: 'absolute',
    top: 55,
    right: 12,
    zIndex: 999,
  },
  menuBackdrop: {
    position: 'absolute',
    top: -60,
    left: -400,
    right: -20,
    bottom: -1000,
  },
  menuDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    width: 170,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  menuItemTextDanger: {
    marginLeft: 10,
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  wallpaperBg: {
    flex: 1,
    backgroundColor: '#EFEAE2',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  encryptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 10,
    marginHorizontal: 16,
  },
  encryptedText: {
    fontSize: 11,
    color: '#92400E',
    marginLeft: 6,
    textAlign: 'center',
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: theme.outgoingBubble,
    borderTopRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: theme.incomingBubble,
    borderTopLeftRadius: 2,
  },
  groupSenderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
    marginBottom: 2,
  },
  bubbleImage: {
    width: 220,
    height: 180,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myText: {
    color: '#0F172A',
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
    fontSize: 10.5,
    color: '#64748B',
    marginRight: 4,
  },
  bubbleTick: {
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
  },
  inputBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginRight: 6,
    elevation: 1,
  },
  attachBtn: {
    padding: 6,
    marginRight: 4,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  lockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  lockedBarActionContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lockedBarContent: {
    alignItems: 'center',
  },
  lockedBarTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockedBarTextRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  lockedBarActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  lockedBarAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    elevation: 2,
  },
  lockedBarSendReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    elevation: 2,
  },
  lockedBarAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedBarPendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
  },
  lockedBarText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  imageModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '94%',
    height: '75%',
  },
  groupModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  groupModalHeader: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  groupModalContent: {
    paddingBottom: 40,
  },
  groupModalAvatarWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  groupModalAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
  },
  groupModalAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupModalName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  groupModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  groupModalDesc: {
    fontSize: 13.5,
    color: '#475569',
    marginTop: 8,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  groupMembersSection: {
    paddingTop: 16,
  },
  groupMembersTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    paddingHorizontal: 16,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
  },
  memberAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C49F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  memberStatus: {
    fontSize: 12,
    color: '#64748B',
  },
  adminBadge: {
    backgroundColor: '#E6FAF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  leaveGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  leaveGroupBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  // Deleted & Edited Message Styles
  deletedBubble: {
    backgroundColor: '#F1F5F9',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#64748B',
  },
  editedLabel: {
    fontSize: 10,
    color: '#64748B',
    marginRight: 4,
    fontStyle: 'italic',
  },
  // Modal & Action Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    elevation: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  actionSheetHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  actionSheetTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionSheetText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  cancelActionItem: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  cancelActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  // Edit Modal Styles
  editModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    elevation: 10,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  editTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 70,
    maxHeight: 140,
    textAlignVertical: 'top',
  },
  editModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
  },
  editCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  editCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  editSaveBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 84,
    alignItems: 'center',
    elevation: 2,
  },
  editSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ChatScreen;
