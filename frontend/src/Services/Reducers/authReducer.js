import {
  AUTH_START,
  AUTH_SUCCESS,
  AUTH_FAIL,
  LOGOUT,
  UPDATE_USER,
} from '../Actions/authActions';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authReducer = (state = initialState, action) => {
  switch (action.type) {
    case AUTH_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case AUTH_SUCCESS:
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
      };

    case AUTH_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case LOGOUT:
      return {
        ...initialState,
      };

    default:
      return state;
  }
};

export default authReducer;
