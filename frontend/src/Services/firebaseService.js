import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postApi } from './helper';

let messagingModule = null;
try {
  messagingModule = require('@react-native-firebase/messaging');
} catch (e) {
  console.log('ℹ️ @react-native-firebase/messaging module not loaded:', e.message);
}

class FirebaseService {
  constructor() {
    this.unsubscribeTokenRefresh = null;
    this.unsubscribeOnMessage = null;
  }

  getMessagingInstance() {
    if (!messagingModule || typeof messagingModule.getMessaging !== 'function') {
      return null;
    }
    try {
      return messagingModule.getMessaging();
    } catch (e) {
      console.warn('getMessaging error:', e.message);
      return null;
    }
  }

  async init() {
    try {
      const messaging = this.getMessagingInstance();
      if (!messaging) {
        console.log('ℹ️ Firebase Messaging instance not available.');
        return;
      }

      await this.requestPermission(messaging);
      await this.registerToken(messaging);

      // Listen for token refresh
      if (typeof messagingModule.onTokenRefresh === 'function') {
        this.unsubscribeTokenRefresh = messagingModule.onTokenRefresh(messaging, async (newToken) => {
          console.log('🔄 FCM Token refreshed:', newToken);
          await this.syncTokenToServer(newToken);
        });
      }

      // Foreground message listener
      if (typeof messagingModule.onMessage === 'function') {
        this.unsubscribeOnMessage = messagingModule.onMessage(messaging, async (remoteMessage) => {
          console.log('📩 Foreground FCM Notification:', remoteMessage);
          const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'PulseChat';
          const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'New message';

          if (remoteMessage.data?.type === 'incoming_call') {
            Alert.alert(title, body, [{ text: 'OK' }]);
          }
        });
      }
    } catch (e) {
      console.warn('FirebaseService init error:', e);
    }
  }

  async requestPermission(messagingParam) {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        }
      }

      const messaging = messagingParam || this.getMessagingInstance();
      if (messaging && typeof messagingModule.requestPermission === 'function') {
        const authStatus = await messagingModule.requestPermission(messaging);
        const { AuthorizationStatus } = messagingModule;
        const enabled =
          authStatus === AuthorizationStatus?.AUTHORIZED ||
          authStatus === AuthorizationStatus?.PROVISIONAL ||
          authStatus === 1;
        return enabled;
      }
      return true;
    } catch (e) {
      console.warn('Notification permission error:', e.message);
      return false;
    }
  }

  async registerToken(messagingParam) {
    try {
      const messaging = messagingParam || this.getMessagingInstance();
      if (messaging && typeof messagingModule.getToken === 'function') {
        const fcmToken = await messagingModule.getToken(messaging);
        if (fcmToken) {
          console.log('🔥 Device FCM Token obtained successfully');
          await AsyncStorage.setItem('fcm_token', fcmToken);
          await this.syncTokenToServer(fcmToken);
        }
      }
    } catch (e) {
      console.warn('Error fetching FCM token:', e.message);
    }
  }

  async syncTokenToServer(fcmToken) {
    try {
      const tokenToUse = fcmToken || (await AsyncStorage.getItem('fcm_token'));
      const userToken = await AsyncStorage.getItem('user_token');
      if (userToken && tokenToUse) {
        await postApi('/auth/fcm-token', { fcmToken: tokenToUse });
        console.log('✅ FCM Token synced with server.');
      }
    } catch (e) {
      // User may not be logged in yet; will sync upon login
    }
  }
}

export default new FirebaseService();
