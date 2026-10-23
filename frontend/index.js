/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Register Firebase background message handler (when app is in background or closed)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📬 Background FCM Message received:', remoteMessage);
});

// Register for both myapp and PulseChat so native Android activity always finds it
AppRegistry.registerComponent('myapp', () => App);
if (appName !== 'myapp') {
  AppRegistry.registerComponent(appName, () => App);
}
