import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  fetchSuggestionsAction,
  fetchRequestsAction,
  sendFriendRequestAction,
  acceptRequestAction,
  rejectRequestAction,
} from '../Services/Actions/chatActions';
import { theme } from '../Services/helper';

const DiscoverScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { suggestions, incomingRequests, sentRequests } = useSelector((state) => state.chat);

  const [refreshing, setRefreshing] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    await Promise.all([
      dispatch(fetchSuggestionsAction()),
      dispatch(fetchRequestsAction()),
    ]);
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSendRequest = async (receiverId) => {
    try {
      setLoadingActionId(receiverId);
      await dispatch(sendFriendRequestAction(receiverId));
    } catch (e) {
      console.warn('Send request error:', e);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleAcceptRequest = async (requestId, friend) => {
    try {
      setLoadingActionId(requestId);
      await dispatch(acceptRequestAction(requestId));
      // Navigate to chat with newly added friend!
      if (friend) {
        navigation.navigate('Chat', { recipient: friend });
      }
    } catch (e) {
      console.warn('Accept request error:', e);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      setLoadingActionId(requestId);
      await dispatch(rejectRequestAction(requestId));
    } catch (e) {
      console.warn('Reject request error:', e);
    } finally {
      setLoadingActionId(null);
    }
  };

  const filteredSuggestions = suggestions.filter((s) =>
    s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address?.formattedAddress?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Find Friends & Requests</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or location..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredSuggestions}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Incoming Requests Section */}
            {incomingRequests.length > 0 && (
              <View style={styles.sectionWrap}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="notifications" size={18} color={theme.accent} />
                  <Text style={styles.sectionTitle}>
                    Friend Requests ({incomingRequests.length})
                  </Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Accept request to open and enable chat
                </Text>

                {incomingRequests.map((req) => (
                  <View key={req._id} style={styles.requestCard}>
                    <View style={styles.avatarWrap}>
                      {req.sender?.profilePic ? (
                        <Image source={{ uri: req.sender.profilePic }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitial}>
                            {req.sender?.fullName?.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.reqDetails}>
                      <Text style={styles.reqName}>{req.sender?.fullName}</Text>
                      <Text style={styles.reqAbout} numberOfLines={1}>
                        {req.sender?.about || 'Wants to connect with you'}
                      </Text>
                    </View>

                    <View style={styles.reqActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAcceptRequest(req._id, req.sender)}
                        disabled={loadingActionId === req._id}
                        activeOpacity={0.8}
                      >
                        {loadingActionId === req._id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            <Text style={styles.btnText}>Accept</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleRejectRequest(req._id)}
                        disabled={loadingActionId === req._id}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Suggestions Header */}
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={18} color={theme.accent} />
              <Text style={styles.sectionTitle}>Registered People Suggestions</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Connect with users to start chatting and video calling
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const isPending =
            item.connectionStatus === 'pending' ||
            sentRequests.some((r) => r.receiver?._id === item._id || r.receiver === item._id);
          const isAccepted = item.connectionStatus === 'accepted';
          const isReceived = item.connectionStatus === 'received';

          return (
            <View style={styles.suggestionCard}>
              <View style={styles.avatarWrap}>
                {item.profilePic ? (
                  <Image source={{ uri: item.profilePic }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {item.fullName?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {item.isOnline && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.suggestDetails}>
                <Text style={styles.suggestName}>{item.fullName}</Text>
                {item.address?.city || item.address?.formattedAddress ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color="#00C49F" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {item.address.city || item.address.formattedAddress}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.suggestAbout} numberOfLines={1}>
                  {item.about || 'Available'}
                </Text>
              </View>

              {/* Action Buttons based on status */}
              {isAccepted ? (
                /* Chat Option (Unlocked) */
                <TouchableOpacity
                  style={styles.chatActionBtn}
                  onPress={() => navigation.navigate('Chat', { recipient: item })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubbles" size={15} color="#FFFFFF" />
                  <Text style={styles.btnText}>Chat</Text>
                </TouchableOpacity>
              ) : isReceived ? (
                /* Incoming Request: Accept / Reject */
                <View style={styles.reqActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAcceptRequest(item.requestId, item)}
                    disabled={loadingActionId === item.requestId}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    <Text style={styles.btnText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              ) : isPending ? (
                /* Pending Request state */
                <View style={styles.pendingBadge}>
                  <Ionicons name="time" size={13} color="#64748B" />
                  <Text style={styles.pendingText}>Pending ⏳</Text>
                </View>
              ) : (
                /* Add Friend */
                <TouchableOpacity
                  style={styles.addFriendBtn}
                  onPress={() => handleSendRequest(item._id)}
                  disabled={loadingActionId === item._id}
                  activeOpacity={0.8}
                >
                  {loadingActionId === item._id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={44} color="#CBD5E1" />
            <Text style={styles.emptyText}>No suggestions found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
  },
  topTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F2D37',
    marginLeft: 6,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  reqDetails: {
    flex: 1,
  },
  reqName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  reqAbout: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  reqActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
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
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.onlineBadge,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  suggestDetails: {
    flex: 1,
    marginRight: 8,
  },
  suggestName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: '#00C49F',
    marginLeft: 3,
  },
  suggestAbout: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sentBtn: {
    backgroundColor: '#F1F5F9',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  pendingText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  sentBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
  },
});

export default DiscoverScreen;
