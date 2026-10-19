/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register for both myapp and PulseChat so native Android activity always finds it
AppRegistry.registerComponent('myapp', () => App);
if (appName !== 'myapp') {
  AppRegistry.registerComponent(appName, () => App);
}
