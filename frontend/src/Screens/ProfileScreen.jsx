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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutAction, UPDATE_USER } from '../Services/Actions/authActions';
import { putApi, theme } from '../Services/helper';

const ProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [about, setAbout] = useState(user?.about || 'Hey there! I am using PulseChat.');
  const [profilePic, setProfilePic] = useState(user?.profilePic || '');
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
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section with Camera Edit Button */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{fullName?.charAt(0) || 'U'}</Text>
              </View>
            )}

            {/* Edit Photo Icon Button */}
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={() => setPickerModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setPickerModalVisible(true)}>
            <Text style={styles.changePicHint}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Info Cards */}
        <View style={styles.card}>
          {/* Full Name */}
          <View style={styles.itemRow}>
            <Ionicons name="person-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Name</Text>
              <TextInput
                style={styles.itemInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* About / Bio */}
          <View style={styles.itemRow}>
            <Ionicons name="information-circle-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>About</Text>
              <TextInput
                style={styles.itemInput}
                value={about}
                onChangeText={setAbout}
                placeholder="About status"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.itemRow}>
            <Ionicons name="call-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Phone Number</Text>
              <Text style={styles.itemValue}>{user?.mobileNumber || 'Not available'}</Text>
            </View>
          </View>

          {/* Email */}
          <View style={styles.itemRow}>
            <Ionicons name="mail-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Email</Text>
              <Text style={styles.itemValue}>{user?.email || 'Not available'}</Text>
            </View>
          </View>

          {/* Location / Address */}
          <View style={styles.itemRow}>
            <Ionicons name="location-outline" size={22} color={theme.accent} style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Location (Auto-detected)</Text>
              <Text style={styles.itemValue}>
                {user?.address?.formattedAddress || user?.address?.city || 'Local Area'}
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
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

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
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
