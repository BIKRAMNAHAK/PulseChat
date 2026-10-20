import { getApi, postApi, putApi, deleteApi } from '../helper';
import socketService from '../socketService';

export const SET_FRIENDS = 'SET_FRIENDS';
export const CLEAR_UNREAD_COUNT = 'CLEAR_UNREAD_COUNT';
export const SET_SUGGESTIONS = 'SET_SUGGESTIONS';
export const SET_REQUESTS = 'SET_REQUESTS';
export const SET_ACTIVE_MESSAGES = 'SET_ACTIVE_MESSAGES';
export const ADD_MESSAGE = 'ADD_MESSAGE';
export const UPDATE_MESSAGE_SEEN = 'UPDATE_MESSAGE_SEEN';
export const MESSAGE_EDITED = 'MESSAGE_EDITED';
export const MESSAGE_DELETED = 'MESSAGE_DELETED';
export const UPDATE_USER_STATUS = 'UPDATE_USER_STATUS';
export const USER_UNFOLLOWED = 'USER_UNFOLLOWED';
export const SET_STATUSES = 'SET_STATUSES';
export const SET_CALL_STATE = 'SET_CALL_STATE';
export const SET_GROUPS = 'SET_GROUPS';
export const ADD_GROUP = 'ADD_GROUP';
export const UPDATE_GROUP_LAST_MESSAGE = 'UPDATE_GROUP_LAST_MESSAGE';

// 1. Fetch Friends List (Chat screen list)
export const fetchFriendsAction = () => async (dispatch) => {
  try {
    const res = await getApi('/connection/friends');
    if (res.success) {
      dispatch({ type: SET_FRIENDS, payload: res.friends });
    }
    return res;
  } catch (error) {
    console.error('fetchFriendsAction error:', error);
  }
};

// 2. Fetch Suggestions (User suggestions list)
export const fetchSuggestionsAction = () => async (dispatch) => {
  try {
    const res = await getApi('/connection/suggestions');
    if (res.success) {
      dispatch({ type: SET_SUGGESTIONS, payload: res.suggestions });
    }
    return res;
  } catch (error) {
    console.error('fetchSuggestionsAction error:', error);
  }
};

// 3. Fetch Pending Requests
export const fetchRequestsAction = () => async (dispatch) => {
  try {
    const res = await getApi('/connection/requests');
    if (res.success) {
      dispatch({ type: SET_REQUESTS, payload: res });
    }
    return res;
  } catch (error) {
    console.error('fetchRequestsAction error:', error);
  }
};

// 4. Send Friend Request
export const sendFriendRequestAction = (receiverId) => async (dispatch) => {
  try {
    const res = await postApi('/connection/send-request', { receiverId });
    if (res.success) {
      // Refresh suggestions and sent requests
      dispatch(fetchSuggestionsAction());
      dispatch(fetchRequestsAction());
    }
    return res;
  } catch (error) {
    throw error;
  }
};

// 5. Accept Friend Request -> Unlocks Chat
export const acceptRequestAction = (requestId) => async (dispatch) => {
  try {
    const res = await postApi('/connection/accept-request', { requestId });
    if (res.success) {
      dispatch(fetchRequestsAction());
      dispatch(fetchFriendsAction());
    }
    return res;
  } catch (error) {
    throw error;
  }
};

// 6. Reject Friend Request
export const rejectRequestAction = (requestId) => async (dispatch) => {
  try {
    const res = await postApi('/connection/reject-request', { requestId });
    if (res.success) {
      dispatch(fetchRequestsAction());
    }
    return res;
  } catch (error) {
    throw error;
  }
};

// 7. Unfollow User -> Immediately Locks Chatting
export const unfollowUserAction = (targetUserId) => async (dispatch) => {
  try {
    const res = await postApi('/connection/unfollow', { targetUserId });
    if (res.success) {
      dispatch({ type: USER_UNFOLLOWED, payload: targetUserId });
      dispatch(fetchFriendsAction());
      dispatch(fetchSuggestionsAction());
    }
    return res;
  } catch (error) {
    throw error;
  }
};

// 8. Fetch Messages in Conversation
export const fetchMessagesAction = (recipientId) => async (dispatch) => {
  try {
    const res = await getApi(`/chat/messages/${recipientId}`);
    if (res.success) {
      dispatch({
        type: SET_ACTIVE_MESSAGES,
        payload: { recipientId, messages: res.messages, canChat: res.canChat },
      });
      // Mark seen on server & notify via socket
      socketService.markSeen(recipientId, res.messages[0]?.receiver);
    }
    return res;
  } catch (error) {
    if (error.response?.status === 403) {
      dispatch({
        type: SET_ACTIVE_MESSAGES,
        payload: { recipientId, messages: [], canChat: false },
      });
    }
    throw error;
  }
};

// 9. Send Message
export const sendMessageAction = (data, isMultipart = false) => async (dispatch) => {
  try {
    const res = await postApi('/chat/send', data, isMultipart);
    if (res.success && res.message) {
      dispatch({ type: ADD_MESSAGE, payload: res.message });
      dispatch(fetchFriendsAction()); // update last message in chat list
    }
    return res;
  } catch (error) {
    throw error;
  }
};

// 10. Mark Seen & Green Tick Update
export const markSeenAction = (senderId, receiverId) => async (dispatch) => {
  try {
    socketService.markSeen(senderId, receiverId);
    dispatch({ type: UPDATE_MESSAGE_SEEN, payload: { byUserId: receiverId } });
  } catch (error) {
    console.error('markSeenAction error:', error);
  }
};

// 11. Fetch Statuses / Shorts
export const fetchStatusesAction = () => async (dispatch) => {
  try {
    const res = await getApi('/status/all');
    if (res.success) {
      dispatch({ type: SET_STATUSES, payload: res });
    }
    return res;
  } catch (error) {
    console.error('fetchStatusesAction error:', error);
  }
};

// 12. Upload Status / Shorts
export const uploadStatusAction = (formData) => async (dispatch) => {
  try {
    const res = await postApi('/status/upload', formData, true);
    if (res.success) {
      dispatch(fetchStatusesAction());
    }
    return res;
  } catch (error) {
    throw error;
  }
};

// 13. Call State Actions
export const setCallStateAction = (callData) => ({
  type: SET_CALL_STATE,
  payload: callData,
});

// 14. Real-time User Status Action
export const updateUserStatusAction = (payload) => ({
  type: UPDATE_USER_STATUS,
  payload,
});

// 15. Fetch Groups Action
export const fetchGroupsAction = () => async (dispatch) => {
  try {
    const res = await getApi('/group/my-groups');
    if (res.success) {
      dispatch({ type: SET_GROUPS, payload: res.groups });
    }
    return res;
  } catch (error) {
    console.error('fetchGroupsAction error:', error);
  }
};

// 16. Create Group Action
export const createGroupAction = (formData) => async (dispatch) => {
  try {
    const res = await postApi('/group/create', formData, true);
    if (res.success && res.group) {
      dispatch({ type: ADD_GROUP, payload: res.group });
      socketService.joinGroup(res.group._id);
    }
    return res;
  } catch (error) {
    console.error('createGroupAction error:', error);
    throw error;
  }
};

// 17. Fetch Group Messages Action
export const fetchGroupMessagesAction = (groupId) => async (dispatch) => {
  try {
    const res = await getApi(`/group/messages/${groupId}`);
    return res;
  } catch (error) {
    console.error('fetchGroupMessagesAction error:', error);
    throw error;
  }
};

// 18. Send Group Message Action
export const sendGroupMessageAction = (formData, isMultipart = false) => async (dispatch) => {
  try {
    const res = await postApi('/group/send', formData, isMultipart);
    return res;
  } catch (error) {
    console.error('sendGroupMessageAction error:', error);
    throw error;
  }
};

// 19. Immediately Clear Unread Count on Chat Open
export const clearUnreadCountAction = (friendId) => ({
  type: CLEAR_UNREAD_COUNT,
  payload: friendId,
});

// 20. Edit Message
export const editMessageAction = (messageId, content) => async (dispatch) => {
  try {
    const res = await putApi(`/chat/message/${messageId}`, { content });
    if (res.success && res.message) {
      dispatch({ type: MESSAGE_EDITED, payload: res.message });
    }
    return res;
  } catch (error) {
    console.error('editMessageAction error:', error);
    throw error;
  }
};

// 21. Delete Message ('everyone' or 'me')
export const deleteMessageAction = (messageId, deleteType) => async (dispatch) => {
  try {
    const res = await deleteApi(`/chat/message/${messageId}`, { deleteType });
    if (res.success) {
      dispatch({
        type: MESSAGE_DELETED,
        payload: { messageId, deleteType, content: 'This message was deleted' },
      });
    }
    return res;
  } catch (error) {
    console.error('deleteMessageAction error:', error);
    throw error;
  }
};

// 22. Real-time Socket Event Handlers for Edit & Delete
export const onMessageEditedAction = (payload) => ({
  type: MESSAGE_EDITED,
  payload,
});

export const onMessageDeletedAction = (payload) => ({
  type: MESSAGE_DELETED,
  payload,
});


