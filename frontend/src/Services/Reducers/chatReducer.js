import {
  SET_FRIENDS,
  SET_SUGGESTIONS,
  SET_REQUESTS,
  SET_ACTIVE_MESSAGES,
  ADD_MESSAGE,
  UPDATE_MESSAGE_SEEN,
  UPDATE_USER_STATUS,
  USER_UNFOLLOWED,
  SET_STATUSES,
  SET_CALL_STATE,
  SET_GROUPS,
  ADD_GROUP,
  UPDATE_GROUP_LAST_MESSAGE,
} from '../Actions/chatActions';
import { LOGOUT } from '../Actions/authActions';

const initialState = {
  friends: [],
  groups: [],
  suggestions: [],
  incomingRequests: [],
  sentRequests: [],
  activeConversation: {
    recipientId: null,
    messages: [],
    canChat: true,
  },
  statuses: {
    myStatuses: [],
    friendsStatuses: [],
  },
  callState: {
    isIncoming: false,
    isActive: false,
    callType: 'video', // 'video' | 'audio'
    caller: null,
    receiver: null,
    signal: null,
  },
  typingUsers: {}, // userId -> boolean
};

const chatReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_FRIENDS:
      return {
        ...state,
        friends: action.payload,
      };

    case SET_SUGGESTIONS:
      return {
        ...state,
        suggestions: action.payload,
      };

    case SET_REQUESTS:
      return {
        ...state,
        incomingRequests: action.payload.incomingRequests || [],
        sentRequests: action.payload.sentRequests || [],
      };

    case SET_ACTIVE_MESSAGES:
      return {
        ...state,
        activeConversation: {
          recipientId: action.payload.recipientId,
          messages: action.payload.messages,
          canChat: action.payload.canChat,
        },
      };

    case ADD_MESSAGE: {
      const msg = action.payload;
      const isForActiveChat =
        state.activeConversation.recipientId &&
        (msg.sender._id === state.activeConversation.recipientId ||
          msg.receiver._id === state.activeConversation.recipientId ||
          msg.sender === state.activeConversation.recipientId ||
          msg.receiver === state.activeConversation.recipientId);

      const updatedMessages = isForActiveChat
        ? [...state.activeConversation.messages, msg]
        : state.activeConversation.messages;

      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: updatedMessages,
        },
      };
    }

    case UPDATE_MESSAGE_SEEN: {
      // Turn all sent messages in active conversation to 'seen' (green ticks!)
      const updatedMessages = state.activeConversation.messages.map((m) => {
        return { ...m, status: 'seen', seenAt: new Date() };
      });

      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: updatedMessages,
        },
      };
    }

    case UPDATE_USER_STATUS: {
      const { userId, isOnline, lastSeen } = action.payload;
      const updatedFriends = state.friends.map((f) => {
        if (f._id === userId) {
          return { ...f, isOnline, lastSeen };
        }
        return f;
      });

      return {
        ...state,
        friends: updatedFriends,
      };
    }

    case USER_UNFOLLOWED: {
      const targetUserId = action.payload;
      return {
        ...state,
        friends: state.friends.filter((f) => f._id !== targetUserId),
        activeConversation: {
          ...state.activeConversation,
          canChat:
            state.activeConversation.recipientId === targetUserId
              ? false
              : state.activeConversation.canChat,
        },
      };
    }

    case SET_STATUSES:
      return {
        ...state,
        statuses: {
          myStatuses: action.payload.myStatuses || [],
          friendsStatuses: action.payload.friendsStatuses || [],
        },
      };

    case SET_CALL_STATE:
      return {
        ...state,
        callState: {
          ...state.callState,
          ...action.payload,
        },
      };

    case SET_GROUPS:
      return {
        ...state,
        groups: action.payload || [],
      };

    case ADD_GROUP:
      return {
        ...state,
        groups: [action.payload, ...state.groups.filter((g) => g._id !== action.payload._id)],
      };

    case UPDATE_GROUP_LAST_MESSAGE: {
      const { groupId, lastMessage } = action.payload;
      const updatedGroups = state.groups.map((grp) => {
        if (grp._id === groupId) {
          return { ...grp, lastMessage };
        }
        return grp;
      });
      return {
        ...state,
        groups: updatedGroups,
      };
    }

    case LOGOUT:
      return initialState;

    default:
      return state;
  }
};

export default chatReducer;
