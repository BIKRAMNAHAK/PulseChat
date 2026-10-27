import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Safely register Firebase background message handler (supports Modular API v27+)
try {
  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  if (typeof getMessaging === 'function' && typeof setBackgroundMessageHandler === 'function') {
    const messaging = getMessaging();
    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
      console.log('📬 Background FCM Message received:', remoteMessage);
    });
  }
} catch (e) {
  console.log('ℹ️ Firebase background messaging not initialized:', e.message);
}

// Register for both myapp and PulseChat so native Android activity always finds it
AppRegistry.registerComponent('myapp', () => App);
if (appName !== 'myapp') {
  AppRegistry.registerComponent(appName, () => App);
}
