import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import store, { persistor } from './src/Services/store';
import SatckNavigation from './src/NavigationStacks/SatckNavigation';
import { theme } from './src/Services/helper';

const Loader = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2D37' }}>
    <ActivityIndicator size="large" color={theme.accent} />
  </View>
);

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <SafeAreaProvider>
          <NavigationContainer>
            <SatckNavigation />
          </NavigationContainer>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;