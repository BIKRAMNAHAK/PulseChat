import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import socketService from '../Services/socketService';

const { width, height } = Dimensions.get('window');

const VideoCallModal = ({
  visible,
  callType = 'video', // 'video' | 'audio'
  isIncoming = false,
  targetUser,
  currentUser,
  onClose,
}) => {
  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const timerRef = useRef(null);

  const endCallLocally = React.useCallback((status = 'completed') => {
    clearInterval(timerRef.current);
    if (callStatus === 'connected') {
      socketService.endCall({
        to: targetUser?._id,
        callDuration: callSeconds,
        callType,
        callStatus: status,
      });
    }
    onClose && onClose();
  }, [callStatus, callSeconds, callType, targetUser?._id, onClose]);

  useEffect(() => {
    if (!visible) {
      setCallStatus(isIncoming ? 'ringing' : 'calling');
      setCallSeconds(0);
      clearInterval(timerRef.current);
      return;
    }

    if (!isIncoming) {
      // Initiate call to target user
      socketService.callUser({
        userToCall: targetUser?._id,
        signalData: { type: 'offer' },
        from: currentUser?._id,
        fromName: currentUser?.fullName,
        fromPic: currentUser?.profilePic,
        callType,
      });
    }

    const handleCallAccepted = () => {
      setCallStatus('connected');
      timerRef.current = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    };

    const handleCallEnded = () => {
      endCallLocally('completed');
    };

    const handleCallRejected = () => {
      endCallLocally('declined');
    };

    const handleCallFailed = (data) => {
      Alert.alert('Call Failed', data.message || 'Call failed. User is unavailable.');
      endCallLocally('failed');
    };

    socketService.on('call-accepted', handleCallAccepted);
    socketService.on('call-ended', handleCallEnded);
    socketService.on('call-rejected', handleCallRejected);
    socketService.on('call-failed', handleCallFailed);

    return () => {
      clearInterval(timerRef.current);
      socketService.off('call-accepted', handleCallAccepted);
      socketService.off('call-ended', handleCallEnded);
      socketService.off('call-rejected', handleCallRejected);
      socketService.off('call-failed', handleCallFailed);
    };
  }, [visible, isIncoming, targetUser, currentUser, callType, endCallLocally]);

  const acceptCall = () => {
    socketService.answerCall({
      to: targetUser?._id,
      signal: { type: 'answer' },
    });
    setCallStatus('connected');
    timerRef.current = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
  };

  const declineCall = () => {
    socketService.rejectCall({ to: targetUser?._id });
    endCallLocally('declined');
  };

  const formatCallDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <StatusBar backgroundColor="#0B192C" barStyle="light-content" />
      <View style={styles.modalBackdrop}>
        {/* Fullscreen Video / Call Background */}
        <View style={styles.callContent}>
          {/* Header Info */}
          <View style={styles.topInfo}>
            <Text style={styles.targetName}>{targetUser?.fullName || 'Contact'}</Text>
            <Text style={styles.statusLabel}>
              {callStatus === 'connected'
                ? formatCallDuration(callSeconds)
                : callStatus === 'ringing'
                ? 'Incoming WhatsApp Call...'
                : 'Calling...'}
            </Text>
          </View>

          {/* Center Avatar or Video Stream View */}
          <View style={styles.streamCenter}>
            {callType === 'video' && callStatus === 'connected' && isVideoEnabled ? (
              <View style={styles.simulatedVideo}>
                <Image
                  source={{
                    uri:
                      targetUser?.profilePic ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
                  }}
                  style={styles.fullVideoFeed}
                  resizeMode="cover"
                />
                <View style={styles.overlayLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>HD Video • Encrypted</Text>
                </View>
              </View>
            ) : (
              <View style={styles.avatarRippleWrap}>
                <View style={styles.rippleOuter}>
                  {targetUser?.profilePic ? (
                    <Image source={{ uri: targetUser.profilePic }} style={styles.bigAvatar} />
                  ) : (
                    <View style={styles.bigAvatarPlaceholder}>
                      <Text style={styles.bigAvatarText}>
                        {targetUser?.fullName?.charAt(0) || 'U'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Picture-in-Picture Local Preview (if connected and video call) */}
          {callType === 'video' && callStatus === 'connected' && isVideoEnabled && (
            <View style={styles.pipBox}>
              {currentUser?.profilePic ? (
                <Image source={{ uri: currentUser.profilePic }} style={styles.pipImg} />
              ) : (
                <View style={styles.pipPlaceholder}>
                  <Text style={{ color: '#FFF', fontSize: 10 }}>You</Text>
                </View>
              )}
            </View>
          )}

          {/* Controls */}
          {callStatus === 'ringing' ? (
            /* Incoming Call Controls (Accept / Decline) */
            <View style={styles.incomingControls}>
              <TouchableOpacity
                style={[styles.callActionBtn, styles.declineBtn]}
                onPress={declineCall}
              >
                <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.btnLabel}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callActionBtn, styles.acceptBtn]}
                onPress={acceptCall}
              >
                <Ionicons name="call" size={26} color="#FFFFFF" />
                <Text style={styles.btnLabel}>Accept</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Connected / Calling Controls */
            <View style={styles.activeControls}>
              <TouchableOpacity
                style={[styles.toolBtn, isMuted && styles.toolBtnActive]}
                onPress={() => setIsMuted(!isMuted)}
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={22}
                  color={isMuted ? '#EF4444' : '#FFFFFF'}
                />
              </TouchableOpacity>

              {callType === 'video' && (
                <>
                  <TouchableOpacity
                    style={[styles.toolBtn, !isVideoEnabled && styles.toolBtnActive]}
                    onPress={() => setIsVideoEnabled(!isVideoEnabled)}
                  >
                    <Ionicons
                      name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                      size={22}
                      color={!isVideoEnabled ? '#EF4444' : '#FFFFFF'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toolBtn}
                    onPress={() => setIsFrontCamera(!isFrontCamera)}
                  >
                    <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              )}

              {/* End Call Button */}
              <TouchableOpacity
                style={[styles.callActionBtn, styles.declineBtn]}
                onPress={() => endCallLocally('completed')}
              >
                <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#07161A',
  },
  callContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 20,
    zIndex: 10,
  },
  targetName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  statusLabel: {
    fontSize: 14,
    color: '#00C49F',
    marginTop: 6,
    fontWeight: '600',
  },
  streamCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRippleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 196, 159, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00C49F',
  },
  bigAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  bigAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  simulatedVideo: {
    width: width,
    height: height,
    position: 'absolute',
    top: -50,
  },
  fullVideoFeed: {
    width: width,
    height: height,
  },
  overlayLiveBadge: {
    position: 'absolute',
    top: 100,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  pipBox: {
    position: 'absolute',
    top: 120,
    right: 20,
    width: 90,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#0F2D37',
    elevation: 6,
  },
  pipImg: {
    width: '100%',
    height: '100%',
  },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 30,
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'rgba(15, 45, 55, 0.85)',
    paddingVertical: 14,
    borderRadius: 30,
  },
  callActionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  toolBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: '#FFFFFF',
  },
});

export default VideoCallModal;
