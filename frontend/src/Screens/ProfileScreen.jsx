import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutAction, UPDATE_USER } from '../Services/Actions/authActions';
import { putApi, theme, getImageUrl, getThemeColors } from '../Services/helper';
import { TOGGLE_THEME } from '../Services/Reducers/themeReducer';

const ProfileScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);
  const themeMode = useSelector((state) => state.theme?.mode || 'dark');
  const currentTheme = getThemeColors(themeMode);

  const targetUser =
    route?.params?.profileUser ||
    (route?.params?.userId && route?.params?.userId !== currentUser?._id
      ? { _id: route.params.userId }
      : currentUser);

  const isSelf = !route?.params?.userId || route.params.userId === currentUser?._id;

  const [fullName, setFullName] = useState(isSelf ? currentUser?.fullName || '' : targetUser?.fullName || '');
  const [about, setAbout] = useState(
    isSelf ? currentUser?.about || 'Hey there! I am using PulseChat.' : targetUser?.about || 'Available'
  );
  const [profilePic, setProfilePic] = useState(isSelf ? currentUser?.profilePic || '' : targetUser?.profilePic || '');
  const [saving, setSaving] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  // 1. Pick Image from Gallery
  const handlePickFromGallery = async () => {
    setPickerModalVisible(false);
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (!res.didCancel && res.assets && res.assets.length > 0) {
        await uploadProfilePhoto(res.assets[0]);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  // 2. Take Photo with Camera
  const handleTakePhoto = async () => {
    setPickerModalVisible(false);
    try {
      const res = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (!res.didCancel && res.assets && res.assets.length > 0) {
        await uploadProfilePhoto(res.assets[0]);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  // 3. Upload Photo to Backend
  const uploadProfilePhoto = async (asset) => {
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('profilePic', {
        uri: asset.uri,
        name: asset.fileName || 'profile.jpg',
        type: asset.type || 'image/jpeg',
      });

      const res = await putApi('/profile/update', formData, true);
      if (res.success && res.user) {
        setProfilePic(res.user.profilePic);
        dispatch({ type: UPDATE_USER, payload: res.user });
        await AsyncStorage.setItem('user_data', JSON.stringify(res.user));
        Alert.alert('Success', 'Profile photo updated successfully!');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile photo.');
    } finally {
      setSaving(false);
    }
  };

  // 4. Save Text Details (Name, About)
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const res = await putApi('/profile/update', {
        fullName: fullName.trim(),
        about: about.trim(),
      });
      if (res.success && res.user) {
        dispatch({ type: UPDATE_USER, payload: res.user });
        await AsyncStorage.setItem('user_data', JSON.stringify(res.user));
        Alert.alert('Saved', 'Profile updated successfully!');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out of PulseChat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => dispatch(logoutAction()),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top > 0 ? insets.top + 8 : 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isSelf ? 'My Profile' : targetUser?.fullName || 'Contact Info'}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {profilePic ? (
              <Image source={{ uri: getImageUrl(profilePic) }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{fullName?.charAt(0) || 'U'}</Text>
              </View>
            )}

            {/* Edit Photo Icon Button (Self only) */}
            {isSelf && (
              <TouchableOpacity
                style={styles.cameraBadge}
                onPress={() => setPickerModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {isSelf ? (
            <TouchableOpacity onPress={() => setPickerModalVisible(true)}>
              <Text style={styles.changePicHint}>Change Profile Photo</Text>
            </TouchableOpacity>
          ) : targetUser?.isOnline ? (
            <View style={styles.onlineBadgePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineBadgeText}>ONLINE NOW</Text>
            </View>
          ) : null}
        </View>

        {/* Quick Actions (Message, Audio Call, Video Call) for other users */}
        {!isSelf && (
          <View style={styles.actionRowContainer}>
            <TouchableOpacity
              style={styles.actionBtnCard}
              onPress={() => navigation.navigate('Chat', { recipient: targetUser })}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#E6FAF5' }]}>
                <Ionicons name="chatbubbles" size={20} color={theme.accent} />
              </View>
              <Text style={styles.actionBtnLabel}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnCard}
              onPress={() => navigation.navigate('Chat', { recipient: targetUser, initiateCall: 'audio' })}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="call" size={20} color="#2563EB" />
              </View>
              <Text style={styles.actionBtnLabel}>Audio Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnCard}
              onPress={() => navigation.navigate('Chat', { recipient: targetUser, initiateCall: 'video' })}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="videocam" size={20} color="#16A34A" />
              </View>
              <Text style={styles.actionBtnLabel}>Video Call</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info Cards */}
        <View style={styles.card}>
          {/* Full Name */}
          <View style={styles.itemRow}>
            <Ionicons name="person-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Name</Text>
              {isSelf ? (
                <TextInput
                  style={styles.itemInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <Text style={styles.itemValue}>{targetUser?.fullName || 'User'}</Text>
              )}
            </View>
          </View>

          {/* About / Bio */}
          <View style={styles.itemRow}>
            <Ionicons name="information-circle-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>About</Text>
              {isSelf ? (
                <TextInput
                  style={styles.itemInput}
                  value={about}
                  onChangeText={setAbout}
                  placeholder="About status"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <Text style={styles.itemValue}>{targetUser?.about || 'Hey there! I am using PulseChat.'}</Text>
              )}
            </View>
          </View>

          {/* Phone */}
          <View style={styles.itemRow}>
            <Ionicons name="call-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Phone Number</Text>
              <Text style={styles.itemValue}>
                {isSelf ? currentUser?.mobileNumber : (targetUser?.mobileNumber || 'Private')}
              </Text>
            </View>
          </View>

          {/* Email */}
          <View style={styles.itemRow}>
            <Ionicons name="mail-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Email</Text>
              <Text style={styles.itemValue}>
                {isSelf ? currentUser?.email : (targetUser?.email || 'Private')}
              </Text>
            </View>
          </View>

          {/* Location / Address */}
          <View style={styles.itemRow}>
            <Ionicons name="location-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Location</Text>
              <Text style={styles.itemValue}>
                {(isSelf ? currentUser : targetUser)?.address?.formattedAddress ||
                  (isSelf ? currentUser : targetUser)?.address?.city ||
                  'Local Area'}
              </Text>
            </View>
          </View>
        </View>

        {/* Appearance / Theme Settings Card */}
        {isSelf && (
          <View style={[styles.card, { backgroundColor: currentTheme.card }]}>
            <TouchableOpacity
              style={styles.themeToggleRow}
              activeOpacity={0.8}
              onPress={() => dispatch({ type: TOGGLE_THEME })}
            >
              <View style={[styles.themeIconCircle, { backgroundColor: themeMode === 'dark' ? '#0F2D37' : '#E6FAF5' }]}>
                <Ionicons
                  name={themeMode === 'dark' ? 'moon' : 'sunny'}
                  size={20}
                  color={theme.accent}
                />
              </View>
              <View style={styles.themeTextWrap}>
                <Text style={[styles.themeLabel, { color: currentTheme.textPrimary }]}>
                  App Theme Mode
                </Text>
                <Text style={[styles.themeSubtext, { color: currentTheme.textSecondary }]}>
                  {themeMode === 'dark' ? 'Dark Mode (Oceanic Slate)' : 'Light Mode (Crisp Clean)'}
                </Text>
              </View>
              <View
                style={[
                  styles.themePill,
                  { backgroundColor: themeMode === 'dark' ? '#0F2D37' : '#E2F7F2' },
                ]}
              >
                <Text
                  style={[
                    styles.themePillText,
                    { color: themeMode === 'dark' ? theme.accent : '#0F5132' },
                  ]}
                >
                  {themeMode === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Save & Logout Buttons (Self only) */}
        {isSelf && (
          <>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" style={styles.logoutIcon} />
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Profile Photo Picker Options Modal */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Update Profile Photo</Text>

            <TouchableOpacity style={styles.pickerOption} onPress={handlePickFromGallery}>
              <Ionicons name="images-outline" size={22} color={theme.accent} />
              <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickerOption} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={22} color={theme.accent} />
              <Text style={styles.pickerOptionText}>Take Photo with Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setPickerModalVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
  },
  backBtn: {
    padding: 4,
    marginRight: 14,
  },
  topTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrap: {
    position: 'relative',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: theme.accent,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  changePicHint: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.accent,
    marginTop: 10,
  },
  onlineBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FAF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  actionRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  actionBtnCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 2,
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  itemIcon: {
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  itemInput: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
  },
  itemValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    height: 48,
  },
  logoutIcon: {
    marginRight: 6,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  themeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  themeTextWrap: {
    flex: 1,
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  themeSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  themePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  themePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F2D37',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#0F172A',
    marginLeft: 12,
    fontWeight: '600',
  },
  pickerCancel: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  pickerCancelText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
});

export default ProfileScreen;
