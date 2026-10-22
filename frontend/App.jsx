import React, { useEffect } from 'react';
import { ActivityIndicator, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import store, { persistor } from './src/Services/store';
import SatckNavigation from './src/NavigationStacks/SatckNavigation';
import { theme } from './src/Services/helper';
import socketService from './src/Services/socketService';
import { logoutAction } from './src/Services/Actions/authActions';

const Loader = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2D37' }}>
    <ActivityIndicator size="large" color={theme.accent} />
  </View>
);

const AppContent = () => {
  useEffect(() => {
    const handleForceLogout = (data) => {
      Alert.alert(
        'Session Expired',
        data?.message || 'Aapka account kisi doosre device par login ho gaya hai. Aap yahan se logout ho rahe hain.',
        [
          {
            text: 'OK',
            onPress: () => store.dispatch(logoutAction()),
          },
        ],
        { cancelable: false }
      );
      store.dispatch(logoutAction());
    };

    socketService.on('force-logout', handleForceLogout);
    return () => {
      socketService.off('force-logout', handleForceLogout);
    };
  }, []);

  return (
    <NavigationContainer>
      <SatckNavigation />
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;