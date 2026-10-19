import AsyncStorage from '@react-native-async-storage/async-storage';
import { postApi, getApi } from '../helper';
import socketService from '../socketService';

export const AUTH_START = 'AUTH_START';
export const AUTH_SUCCESS = 'AUTH_SUCCESS';
export const AUTH_FAIL = 'AUTH_FAIL';
export const LOGOUT = 'LOGOUT';
export const UPDATE_USER = 'UPDATE_USER';

// 1. Send OTP
export const sendOtpAction = (email) => async (dispatch) => {
  try {
    dispatch({ type: AUTH_START });
    const res = await postApi('/auth/send-otp', { email });
    return res;
  } catch (error) {
    const msg = error.response?.data?.message || 'Failed to send OTP.';
    dispatch({ type: AUTH_FAIL, payload: msg });
    throw new Error(msg);
  }
};

// 2. Register
export const registerAction = (formData) => async (dispatch) => {
  try {
    dispatch({ type: AUTH_START });
    const isMultipart = typeof FormData !== 'undefined' && formData instanceof FormData;
    const res = await postApi('/auth/register', formData, isMultipart);
    return res;
  } catch (error) {
    const msg = error.response?.data?.message || 'Registration failed.';
    dispatch({ type: AUTH_FAIL, payload: msg });
    throw new Error(msg);
  }
};

// 3. Verify OTP
export const verifyOtpAction = (email, otp) => async (dispatch) => {
  try {
    dispatch({ type: AUTH_START });
    const res = await postApi('/auth/verify-otp', { email, otp });

    if (res.success && res.token) {
      await AsyncStorage.setItem('user_token', res.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(res.user));

      // Connect socket
      socketService.connect(res.user._id);

      dispatch({
        type: AUTH_SUCCESS,
        payload: { token: res.token, user: res.user },
      });
    }
    return res;
  } catch (error) {
    const msg = error.response?.data?.message || 'OTP verification failed.';
    dispatch({ type: AUTH_FAIL, payload: msg });
    throw new Error(msg);
  }
};

// 4. Login
export const loginAction = (loginId, password) => async (dispatch) => {
  try {
    dispatch({ type: AUTH_START });
    const res = await postApi('/auth/login', { loginId, password });

    if (res.success && res.token) {
      await AsyncStorage.setItem('user_token', res.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(res.user));

      // Connect socket
      socketService.connect(res.user._id);

      dispatch({
        type: AUTH_SUCCESS,
        payload: { token: res.token, user: res.user },
      });
    }
    return res;
  } catch (error) {
    const msg = error.response?.data?.message || 'Login failed.';
    dispatch({ type: AUTH_FAIL, payload: msg });
    throw error;
  }
};

// 5. Restore Session / Load User
export const loadUserAction = () => async (dispatch) => {
  try {
    const token = await AsyncStorage.getItem('user_token');
    const userData = await AsyncStorage.getItem('user_data');

    if (token && userData) {
      const user = JSON.parse(userData);
      socketService.connect(user._id);

      dispatch({
        type: AUTH_SUCCESS,
        payload: { token, user },
      });

      // Fetch fresh profile in background
      try {
        const fresh = await getApi('/auth/me');
        if (fresh.success && fresh.user) {
          await AsyncStorage.setItem('user_data', JSON.stringify(fresh.user));
          dispatch({ type: UPDATE_USER, payload: fresh.user });
        }
      } catch (e) {
        // token expired
        if (e.response?.status === 401) {
          dispatch(logoutAction());
        }
      }
    }
  } catch (error) {
    console.warn('Error loading user session:', error);
  }
};

// 6. Logout
export const logoutAction = () => async (dispatch) => {
  try {
    await AsyncStorage.removeItem('user_token');
    await AsyncStorage.removeItem('user_data');
    socketService.disconnect();
    dispatch({ type: LOGOUT });
  } catch (error) {
    console.error('Logout error:', error);
  }
};
