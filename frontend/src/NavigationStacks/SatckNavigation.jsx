import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';

import BottomTabNavigation from './BottomTabNavigation';
import ChatScreen from '../Screens/ChatScreen';
import ProfileScreen from '../Screens/ProfileScreen';
import LoginScreen from '../Screens/LoginScreen';
import RegisterScreen from '../Screens/RegisterScreen';
import OtpScreen from '../Screens/OtpScreen';
import DocsScreen from '../Screens/DocsScreen';
import { loadUserAction } from '../Services/Actions/authActions';
import { theme } from '../Services/helper';

const Stack = createNativeStackNavigator();

const SatckNavigation = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(loadUserAction());
  }, [dispatch]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        animation: 'slide_from_right',
      }}
    >
      {isAuthenticated ? (
        // Authenticated Stack
        <>
          <Stack.Screen
            name="Main"
            component={BottomTabNavigation}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Docs"
            component={DocsScreen}
            options={{ title: 'Documentation' }}
          />
        </>
      ) : (
        // Auth Stack
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Otp"
            component={OtpScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default SatckNavigation;
