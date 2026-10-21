import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme, getApi, getThemeColors } from '../Services/helper';

const CallsScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const themeMode = useSelector((state) => state.theme?.mode || 'dark');
  const currentTheme = getThemeColors(themeMode);

  const [callLogs, setCallLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCallLogs = useCallback(async () => {
    try {
      const res = await getApi('/chat/call-history');
      if (res.success && res.callLogs) {
        setCallLogs(res.callLogs);
      }
    } catch (e) {
      console.warn('Call history fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCallLogs();
    setRefreshing(false);
  };

  const formatCallTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const formatDuration = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `(${m > 0 ? `${m}m ` : ''}${s}s)`;
  };

  const renderCallItem = ({ item }) => {
    const isOutgoing = item.sender?._id === user?._id || item.sender === user?._id;
    const contact = isOutgoing ? item.receiver : item.sender;
    const isVideo = item.messageType === 'video_call_log';
    const isMissed = item.callStatus === 'missed' || item.callStatus === 'declined';

    return (
      <View style={[styles.callRow, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
        <View style={styles.avatarWrap}>
          {contact?.profilePic ? (
            <Image source={{ uri: contact.profilePic }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{contact?.fullName?.charAt(0) || 'U'}</Text>
            </View>
          )}
        </View>

        <View style={styles.callDetails}>
          <Text
            style={[
              styles.callerName,
              { color: currentTheme.textPrimary },
              isMissed && !isOutgoing && styles.missedName,
            ]}
            numberOfLines={1}
          >
            {contact?.fullName || 'Contact'}
          </Text>

          <View style={styles.callInfoRow}>
            {/* Arrow indicating direction */}
            {isOutgoing ? (
              <Ionicons name="arrow-up" size={14} color="#10B981" style={styles.arrowIcon} />
            ) : isMissed ? (
              <Ionicons name="arrow-down" size={14} color="#EF4444" style={styles.arrowIcon} />
            ) : (
              <Ionicons name="arrow-down" size={14} color="#10B981" style={styles.arrowIcon} />
            )}

            <Text style={[styles.callTime, { color: currentTheme.textSecondary }]}>
              {formatCallTime(item.createdAt)} {formatDuration(item.callDuration)}
            </Text>
          </View>
        </View>

        {/* Re-dial / Call Back button */}
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() =>
            navigation.navigate('Chat', {
              recipient: contact,
              initiateCall: isVideo ? 'video' : 'audio',
            })
          }
        >
          <Ionicons
            name={isVideo ? 'videocam' : 'call'}
            size={22}
            color={theme.accent}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Call History</Text>
      </View>

      <FlatList
        data={callLogs}
        keyExtractor={(item, idx) => item._id || String(idx)}
        contentContainerStyle={styles.listContent}
        renderItem={renderCallItem}
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
            <View style={[styles.emptyIconCircle, { backgroundColor: themeMode === 'dark' ? '#112A26' : '#F1F5F9' }]}>
              <Ionicons name="call-outline" size={44} color={currentTheme.textSecondary} />
            </View>
            <Text style={[styles.emptyText, { color: currentTheme.textPrimary }]}>No Call History</Text>
            <Text style={[styles.emptySubtext, { color: currentTheme.textSecondary }]}>
              All incoming, outgoing, and video call logs will be recorded here automatically.
            </Text>
          </View>
        }
      />
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
  listContent: {
    paddingVertical: 10,
    flexGrow: 1,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrap: {
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  callDetails: {
    flex: 1,
  },
  callerName: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  missedName: {
    color: '#EF4444',
  },
  callInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  arrowIcon: {
    marginRight: 4,
  },
  callTime: {
    fontSize: 12.5,
    color: '#64748B',
  },
  callBtn: {
    padding: 10,
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F2D37',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 18,
  },
});

export default CallsScreen;
