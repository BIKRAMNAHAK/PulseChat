import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';

import ChatsScreen from '../Screens/ChatsScreen';
import StatusScreen from '../Screens/StatusScreen';
import DiscoverScreen from '../Screens/DiscoverScreen';
import CallsScreen from '../Screens/CallsScreen';
import { fetchRequestsAction } from '../Services/Actions/chatActions';
import socketService from '../Services/socketService';
import { theme } from '../Services/helper';

import VideoCallModal from '../Components/VideoCallModal';

const Tab = createBottomTabNavigator();

const ICONS = {
  Chats: ['chatbubbles', 'chatbubbles-outline'],
  Status: ['radio-button-on', 'radio-button-off-outline'],
  Discover: ['people', 'people-outline'],
  Calls: ['call', 'call-outline'],
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { incomingRequests = [] } = useSelector((state) => state.chat);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;
        const [activeIcon, inactiveIcon] = ICONS[route.name] || ['ellipse', 'ellipse-outline'];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const showBadge = route.name === 'Discover' && incomingRequests.length > 0;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            activeOpacity={0.8}
            style={styles.tab}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={isFocused ? activeIcon : inactiveIcon}
                size={22}
                color={isFocused ? theme.accent : '#94A3B8'}
              />
              {showBadge && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{incomingRequests.length}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: isFocused ? theme.accent : '#94A3B8', fontWeight: isFocused ? '700' : '500' },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const BottomTabNavigation = () => {
  const dispatch = useDispatch();
  const [incomingCallData, setIncomingCallData] = React.useState(null);
  const [incomingCallModalVisible, setIncomingCallModalVisible] = React.useState(false);

  useEffect(() => {
    dispatch(fetchRequestsAction());

    const handleReqUpdate = () => {
      dispatch(fetchRequestsAction());
    };

    const handleGlobalIncomingCall = (callData) => {
      setIncomingCallData(callData);
      setIncomingCallModalVisible(true);
    };

    socketService.on('friend-request-received', handleReqUpdate);
    socketService.on('friend-request-accepted', handleReqUpdate);
    socketService.on('incoming-call', handleGlobalIncomingCall);

    return () => {
      socketService.off('friend-request-received', handleReqUpdate);
      socketService.off('friend-request-accepted', handleReqUpdate);
      socketService.off('incoming-call', handleGlobalIncomingCall);
    };
  }, [dispatch]);

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="Chats" component={ChatsScreen} />
        <Tab.Screen name="Status" component={StatusScreen} />
        <Tab.Screen name="Discover" component={DiscoverScreen} />
        <Tab.Screen name="Calls" component={CallsScreen} />
      </Tab.Navigator>

      {/* Global Incoming Video / Audio Call Ringing Modal */}
      {incomingCallModalVisible && incomingCallData && (
        <VideoCallModal
          visible={incomingCallModalVisible}
          callType={incomingCallData.callType || 'video'}
          isIncoming={true}
          targetUser={{
            _id: incomingCallData.from,
            fullName: incomingCallData.fromName,
            profilePic: incomingCallData.fromPic,
          }}
          onClose={() => {
            setIncomingCallModalVisible(false);
            setIncomingCallData(null);
          }}
        />
      )}
    </>
  );
};

export default BottomTabNavigation;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#0F2D37',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    marginTop: 4,
    fontSize: 11.5,
  },
});