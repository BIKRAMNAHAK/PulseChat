import axios from 'axios';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* =====================================================
   1. SERVER CONFIGURATION
   ===================================================== */
// Live Render Cloud URL (Commented out):
// export const SERVER_URL = 'https://pulsechat-hoid.onrender.com';

// Local Development Server (connected to local MongoDB on port 5000):
// export const SERVER_URL = 'http://localhost:5000'; 
export const SERVER_URL = 'https://pulsechat-backend-szl8.onrender.com'
export const BASE_URL = `${SERVER_URL}/api`;

export const SOCKET_URL = SERVER_URL;

export const getImageUrl = (url) => {
  if (!url) return '';
  if (
    url.startsWith('http://localhost') ||
    url.startsWith('http://10.0.2.2') ||
    url.startsWith('http://127.0.0.1')
  ) {
    const path = url.replace(/^https?:\/\/[^\/]+/, '');
    return `${SERVER_URL}${path}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
    return url;
  }
  return `${SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

/* =====================================================
   2. AXIOS INSTANCE & INTERCEPTORS
   ===================================================== */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s to accommodate Render free-tier cold-start wakeups
});

// Auto attach token from storage
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Error reading token from storage:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getApi = async (url = '', params = {}) => {
  const res = await api.get(url, { params });
  return res.data;
};

export const postApi = async (url = '', data = {}, isMultipart = false) => {
  const headers = isMultipart ? { 'Content-Type': 'multipart/form-data' } : {};
  const res = await api.post(url, data, { headers });
  return res.data;
};

export const putApi = async (url = '', data = {}, isMultipart = false) => {
  const headers = isMultipart ? { 'Content-Type': 'multipart/form-data' } : {};
  const res = await api.put(url, data, { headers });
  return res.data;
};

export const deleteApi = async (url = '', data = {}) => {
  const res = await api.delete(url, { data });
  return res.data;
};

/* =====================================================
   3. MODERN WHATSAPP-STYLE THEME PALETTES
   (Dark Mode & Light Mode)
   ===================================================== */
export const darkTheme = {
  mode: 'dark',
  primary: '#0B2228',         // Deep Obsidian Teal Header
  primaryDark: '#07161A',     // Status bar
  primaryLight: '#143842',
  accent: '#00C49F',          // Vibrant Emerald Mint
  accentSecondary: '#00A8E8',

  background: '#0B141B',      // Dark background
  card: '#111B21',            // Dark card
  surface: '#182229',
  border: '#1F2C34',

  // Chat Wallpaper & Bubbles
  wallpaperBg: '#0B141B',
  senderBubble: '#005C4B',
  outgoingBubble: '#005C4B',
  receiverBubble: '#202C33',
  incomingBubble: '#202C33',
  chatBackground: '#0B141B',
  chatBackgroundAlt: '#111B21',

  // Text - HIGH CONTRAST WHITE & LIGHT COLORS FOR DARK MODE
  textPrimary: '#FFFFFF',
  textSecondary: '#CBD5E1',
  textLight: '#FFFFFF',
  textMuted: '#94A3B8',
  messageText: '#FFFFFF',
  myMessageText: '#FFFFFF',
  theirMessageText: '#FFFFFF',
  bubbleTime: '#CBD5E1',

  // Inputs
  inputContainerBg: '#111B21',
  inputBarBg: '#1F2C34',
  inputBackground: '#1F2C34',
  inputBorder: '#2A3942',
  inputText: '#FFFFFF',
  inputPlaceholder: '#94A3B8',

  // Read Receipts & Indicators
  tickSent: '#8696A0',
  tickDelivered: '#8696A0',
  tickSeen: '#53BDEB',
  onlineBadge: '#00C49F',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  unfollowWarning: '#DC2626',

  statusUnviewed: '#00C49F',
  statusViewed: '#8696A0',

  tabBarBg: '#0B141B',
  tabBarBorder: '#1F2C34',
  tabInactive: '#94A3B8',
};

export const lightTheme = {
  mode: 'light',
  primary: '#0B2228',         // Deep Obsidian Teal Header
  primaryDark: '#07161A',
  primaryLight: '#143842',
  accent: '#00C49F',
  accentSecondary: '#00A8E8',

  background: '#F8FAFC',      // Crisp light slate
  card: '#FFFFFF',            // Crisp clean white card
  surface: '#FFFFFF',
  border: '#E2E8F0',

  // Chat Wallpaper & Bubbles
  wallpaperBg: '#EFEAE2',
  senderBubble: '#E2F7F2',
  outgoingBubble: '#E2F7F2',
  receiverBubble: '#FFFFFF',
  incomingBubble: '#FFFFFF',
  chatBackground: '#EFEAE2',
  chatBackgroundAlt: '#F3F5F7',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textLight: '#FFFFFF',
  textMuted: '#94A3B8',
  messageText: '#0F172A',
  myMessageText: '#0F172A',
  theirMessageText: '#0F172A',
  bubbleTime: '#64748B',

  // Inputs
  inputContainerBg: '#F1F5F9',
  inputBarBg: '#FFFFFF',
  inputBackground: '#F1F5F9',
  inputBorder: '#E2E8F0',
  inputText: '#0F172A',
  inputPlaceholder: '#94A3B8',

  // Read Receipts & Indicators
  tickSent: '#8696A0',
  tickDelivered: '#8696A0',
  tickSeen: '#10B981',
  onlineBadge: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  unfollowWarning: '#DC2626',

  statusUnviewed: '#00C49F',
  statusViewed: '#8696A0',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabInactive: '#64748B',
};

// Default export alias for backward compatibility
export const theme = darkTheme;

export const getThemeColors = (mode) => (mode === 'light' ? lightTheme : darkTheme);

export const textColor = {
  primary: theme.textPrimary,
  secondary: theme.textSecondary,
  light: theme.textLight,
  muted: theme.textMuted,
  link: theme.accentSecondary,
  success: theme.success,
  error: theme.danger,
  warning: theme.warning,
};

export const bgColor = {
  primary: theme.primary,
  secondary: '#E8F5F1',
  body: '#F0F2F5',
  card: '#FFFFFF',
  dark: '#07161A',
  success: theme.success,
  error: theme.danger,
};

/* =====================================================
   FONT UTILITIES (Sizes, Styles, Variants)
   ===================================================== */
export const fontSize = {
  xs: 10,
  small: 12,
  medium: 14,
  large: 18,
  xl: 24,
  custom: (size) => size,
};

export const fontStyle = {
  normal: { fontStyle: 'normal' },
  italic: { fontStyle: 'italic' },
};

export const fontVariant = {
  normal: { fontWeight: '400' },
  bold: { fontWeight: '700' },
  exbold: { fontWeight: '800' },
};

/* =====================================================
   4. SILENT LOCATION FETCHER (Autofetch current location)
   ===================================================== */
export const autoFetchLocation = async () => {
  try {
    // 1. First try silent reverse geolocation via IP lookup (does not prompt or alert)
    const ipRes = await fetch('https://ipapi.co/json/').then((r) => r.json()).catch(() => null);
    if (ipRes && ipRes.city) {
      return {
        formattedAddress: `${ipRes.city}, ${ipRes.region || ''}, ${ipRes.country_name || ''}`.trim(),
        city: ipRes.city,
        state: ipRes.region || '',
        country: ipRes.country_name || 'India',
        latitude: ipRes.latitude || null,
        longitude: ipRes.longitude || null,
      };
    }
  } catch (err) {
    console.log('IP location fallback attempt failed:', err.message);
  }

  // Fallback default
  return {
    formattedAddress: 'Auto-detected Location',
    city: 'Local Area',
    state: '',
    country: 'India',
    latitude: null,
    longitude: null,
  };
};

/* =====================================================
   5. PERMISSION UTILITIES (Android)
   ===================================================== */
const P = PermissionsAndroid.PERMISSIONS;

const ANDROID_PERMISSIONS = {
  camera: P.CAMERA,
  location: P.ACCESS_FINE_LOCATION,
  notification: P.POST_NOTIFICATIONS,
  storage: Platform.Version >= 33 ? P.READ_MEDIA_IMAGES : P.READ_EXTERNAL_STORAGE,
  microphone: P.RECORD_AUDIO,
};

export const checkPermission = async (name) => {
  if (Platform.OS !== 'android') return true;
  if (name === 'notification' && Platform.Version < 33) return true;

  const permission = ANDROID_PERMISSIONS[name];
  if (!permission) return false;

  try {
    const already = await PermissionsAndroid.check(permission);
    if (already) return true;

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Permission check error:', error);
    return false;
  }
};