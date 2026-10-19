import { getApi, postApi } from '../helper';
import socketService from '../socketService';

export const SET_FRIENDS = 'SET_FRIENDS';
export const SET_SUGGESTIONS = 'SET_SUGGESTIONS';
export const SET_REQUESTS = 'SET_REQUESTS';
export const SET_ACTIVE_MESSAGES = 'SET_ACTIVE_MESSAGES';
export const ADD_MESSAGE = 'ADD_MESSAGE';
export const UPDATE_MESSAGE_SEEN = 'UPDATE_MESSAGE_SEEN';
export const UPDATE_USER_STATUS = 'UPDATE_USER_STATUS';
export const USER_UNFOLLOWED = 'USER_UNFOLLOWED';
export const SET_STATUSES = 'SET_STATUSES';
export const SET_CALL_STATE = 'SET_CALL_STATE';

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
