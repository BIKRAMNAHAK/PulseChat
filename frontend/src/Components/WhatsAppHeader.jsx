import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../Services/helper';

const WhatsAppHeader = ({
  title = 'MyChat',
  onCameraPress,
  onSearchPress,
  onMenuPress,
  unreadCount = 0,
}) => {
  return (
    <>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.actions}>
            {onCameraPress && (
              <TouchableOpacity onPress={onCameraPress} style={styles.iconBtn}>
                <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {onSearchPress && (
              <TouchableOpacity onPress={onSearchPress} style={styles.iconBtn}>
                <Ionicons name="search" size={21} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {onMenuPress && (
              <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn}>
                <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.primary,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginLeft: 18,
    padding: 4,
  },
});

export default WhatsAppHeader;
