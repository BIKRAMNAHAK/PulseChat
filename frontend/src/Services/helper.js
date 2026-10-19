import axios from 'axios';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* =====================================================
   1. SERVER CONFIGURATION
   ===================================================== */
export const SERVER_IP = '192.168.54.97';
export const PORT = 5000;

export const SERVER_URL = Platform.select({
  android: `http://${SERVER_IP}:${PORT}`,
  ios: `http://localhost:${PORT}`,
  default: `http://localhost:${PORT}`,
});

export const BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

/* =====================================================
   2. AXIOS INSTANCE & INTERCEPTORS
   ===================================================== */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
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
   3. MODERN WHATSAPP-STYLE THEME PALETTE
   (Distinct modern Oceanic Slate & Electric Cyan)
   ===================================================== */
export const theme = {
  // Brand / Header Colors
  primary: '#0B2228',         // Deep Obsidian Teal (WhatsApp top bar alternate)
  primaryDark: '#07161A',     // Status bar color
  primaryLight: '#143842',    // Header light shade
  accent: '#00C49F',          // Vibrant Emerald / Electric Mint
  accentSecondary: '#00A8E8', // Cyan highlights

  // Chat Bubbles
  senderBubble: '#E2F7F2',    // WhatsApp-like subtle soft mint on right
  senderBubbleDark: '#0D3833',
  receiverBubble: '#FFFFFF',  // Clean white on left
  receiverBubbleDark: '#1E293B',
  chatBackground: '#EFEAE2',  // WhatsApp-like background wallpaper tone
  chatBackgroundAlt: '#F3F5F7',

  // Read Receipts & Indicators
  tickSent: '#8696A0',        // Single grey tick (Sent)
  tickDelivered: '#8696A0',   // Double grey tick (Delivered)
  tickSeen: '#10B981',        // Double Emerald Green tick (Seen/Read!)
  onlineBadge: '#10B981',     // Green online dot

  // Text
  textPrimary: '#111B21',     // High contrast dark text
  textSecondary: '#667781',   // Subtitle / timestamp text
  textLight: '#FFFFFF',
  textMuted: '#8696A0',

  // UI Elements
  inputBackground: '#FFFFFF',
  border: '#E2E8F0',
  card: '#FFFFFF',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  unfollowWarning: '#DC2626',

  // Status / Story Rings
  statusUnviewed: '#00C49F',  // Green ring around new status
  statusViewed: '#8696A0',    // Grey ring around viewed status
};

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