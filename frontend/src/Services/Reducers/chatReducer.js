import {
  SET_FRIENDS,
  CLEAR_UNREAD_COUNT,
  SET_SUGGESTIONS,
  SET_REQUESTS,
  SET_ACTIVE_MESSAGES,
  ADD_MESSAGE,
  UPDATE_MESSAGE_SEEN,
  MESSAGE_EDITED,
  MESSAGE_DELETED,
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
    case 'persist/REHYDRATE': {
      if (action.payload && action.payload.chat) {
        return {
          ...state,
          ...action.payload.chat,
          callState: initialState.callState,
          typingUsers: {},
        };
      }
      return state;
    }

    case SET_FRIENDS:
      return {
        ...state,
        friends: action.payload,
      };

    case CLEAR_UNREAD_COUNT: {
      const friendId = action.payload;
      const updatedFriends = state.friends.map((f) => {
        if (f._id === friendId) {
          return { ...f, unreadCount: 0 };
        }
        return f;
      });
      return {
        ...state,
        friends: updatedFriends,
      };
    }

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
        (msg.sender?._id === state.activeConversation.recipientId ||
          msg.receiver?._id === state.activeConversation.recipientId ||
          msg.sender === state.activeConversation.recipientId ||
          msg.receiver === state.activeConversation.recipientId);

      if (!isForActiveChat) return state;

      // Prevent duplicate messages with same _id
      const alreadyExists = state.activeConversation.messages.some(
        (m) => m._id && msg._id && m._id.toString() === msg._id.toString()
      );
      if (alreadyExists) return state;

      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: [...state.activeConversation.messages, msg],
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

    case MESSAGE_EDITED: {
      const { messageId, content, isEdited, editedAt, message } = action.payload;
      const targetId = messageId || message?._id;
      const newContent = content !== undefined ? content : message?.content;
      const updatedMessages = state.activeConversation.messages.map((m) => {
        if (m._id && targetId && m._id.toString() === targetId.toString()) {
          return {
            ...m,
            content: newContent,
            isEdited: true,
            editedAt: editedAt || message?.editedAt || new Date(),
          };
        }
        return m;
      });
      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: updatedMessages,
        },
      };
    }

    case MESSAGE_DELETED: {
      const { messageId, deleteType } = action.payload;
      if (deleteType === 'everyone') {
        const updatedMessages = state.activeConversation.messages.map((m) => {
          if (m._id && messageId && m._id.toString() === messageId.toString()) {
            return {
              ...m,
              isDeleted: true,
              content: 'This message was deleted',
              mediaUrl: '',
            };
          }
          return m;
        });
        return {
          ...state,
          activeConversation: {
            ...state.activeConversation,
            messages: updatedMessages,
          },
        };
      } else {
        // deleteType === 'me'
        const updatedMessages = state.activeConversation.messages.filter(
          (m) => !(m._id && messageId && m._id.toString() === messageId.toString())
        );
        return {
          ...state,
          activeConversation: {
            ...state.activeConversation,
            messages: updatedMessages,
          },
        };
      }
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
