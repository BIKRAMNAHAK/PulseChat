import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postApi } from './helper';

class FirebaseService {
  constructor() {
    this.unsubscribeTokenRefresh = null;
    this.unsubscribeOnMessage = null;
  }

  async init() {
    try {
      await this.requestPermission();
      await this.registerToken();

      // Listen for token refresh
      this.unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 FCM Token refreshed:', newToken);
        await this.syncTokenToServer(newToken);
      });

      // Foreground message listener
      this.unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
        console.log('📩 Foreground FCM Notification:', remoteMessage);
        const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'PulseChat';
        const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'New message';

        if (remoteMessage.data?.type === 'incoming_call') {
          Alert.alert(title, body, [{ text: 'OK' }]);
        }
      });
    } catch (e) {
      console.warn('FirebaseService init error:', e);
    }
  }

  async requestPermission() {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        }
      }
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      return enabled;
    } catch (e) {
      console.warn('Notification permission error:', e);
      return false;
    }
  }

  async registerToken() {
    try {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        console.log('🔥 Device FCM Token obtained successfully');
        await AsyncStorage.setItem('fcm_token', fcmToken);
        await this.syncTokenToServer(fcmToken);
      }
    } catch (e) {
      console.warn('Error fetching FCM token:', e);
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
