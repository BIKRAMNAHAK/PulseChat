import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Platform,
  PermissionsAndroid,
  NativeModules,
} from 'react-native';
import { useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import socketService from '../Services/socketService';
import { getImageUrl } from '../Services/helper';

// Safely require WebRTC to prevent app crash if native module is not present in old APK build
let webrtcLib = null;
try {
  webrtcLib = require('react-native-webrtc');
} catch (e) {
  console.warn('⚠️ react-native-webrtc require error:', e);
}

const RTCPeerConnection = webrtcLib?.RTCPeerConnection;
const RTCIceCandidate = webrtcLib?.RTCIceCandidate;
const RTCSessionDescription = webrtcLib?.RTCSessionDescription;
const RTCView = webrtcLib?.RTCView;
const mediaDevices = webrtcLib?.mediaDevices;

const hasNativeWebRTC = !!(NativeModules.WebRTCModule && RTCPeerConnection && mediaDevices);

const { width, height } = Dimensions.get('window');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const VideoCallModal = ({
  visible,
  callType = 'video', // 'video' | 'audio'
  isIncoming = false,
  targetUser,
  recipient,
  currentUser,
  incomingSignal = null,
  onClose,
}) => {
  const authUser = useSelector((state) => state.auth?.user);
  const target = targetUser || recipient;
  const me = currentUser || authUser;

  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // WebRTC Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const incomingOfferRef = useRef(incomingSignal);

  useEffect(() => {
    if (incomingSignal) {
      incomingOfferRef.current = incomingSignal;
    }
  }, [incomingSignal]);

  // Request Permissions safely
  const requestCallPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (callType === 'video') {
          perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        }
        const granted = await PermissionsAndroid.requestMultiple(perms);
        return (
          granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  // 1. Safe cleanup
  const cleanupCall = useCallback(() => {
    clearInterval(timerRef.current);

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current.release && localStreamRef.current.release();
      } catch (e) {}
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const endCallLocally = useCallback(
    (status = 'completed') => {
      cleanupCall();
      if (target?._id) {
        socketService.endCall({
          to: target._id,
          callDuration: callSeconds,
          callType,
          callStatus: status,
        });
      }
      onClose && onClose();
    },
    [cleanupCall, target?._id, callSeconds, callType, onClose]
  );

  // 2. Initialize Peer Connection (only if native module exists)
  const initPeerConnection = useCallback(() => {
    if (!hasNativeWebRTC) {
      console.log('ℹ️ Running in fallback signaling mode (WebRTC native module not available in this APK build).');
      return null;
    }

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && target?._id) {
          socketService.sendIceCandidate({
            to: target._id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          endCallLocally('completed');
        }
      };

      return pc;
    } catch (err) {
      console.warn('RTCPeerConnection init error:', err);
      return null;
    }
  }, [target?._id, endCallLocally]);

  // 3. Capture Local Media Stream
  const getLocalMediaStream = useCallback(async () => {
    if (!hasNativeWebRTC || !mediaDevices?.getUserMedia) return null;

    const hasPerm = await requestCallPermissions();
    if (!hasPerm) {
      Alert.alert('Permission Required', 'Microphone permission is required to make calls.');
      endCallLocally('failed');
      return null;
    }

    try {
      const isVoiceOnly = callType === 'audio';
      const constraints = {
        audio: true,
        video: isVoiceOnly
          ? false
          : {
              facingMode: 'user',
              width: 640,
              height: 480,
              frameRate: 30,
            },
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.warn('getUserMedia error, trying audio only:', err);
      try {
        const audioStream = await mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(audioStream);
        localStreamRef.current = audioStream;
        return audioStream;
      } catch (e) {
        console.warn('Audio capture failed:', e);
        return null;
      }
    }
  }, [callType, endCallLocally]);

  // 4. Main Call Setup Effect
  useEffect(() => {
    if (!visible) {
      cleanupCall();
      return;
    }

    // Inform user if APK was not re-built after adding WebRTC
    if (!hasNativeWebRTC) {
      Alert.alert(
        'Fresh APK Required for WebRTC',
        'Calling requires native WebRTC libraries. Please generate and install the new APK (`./gradlew assembleRelease`) for full audio/video streaming.',
        [{ text: 'OK' }]
      );
    }

    const setupCall = async () => {
      const pc = initPeerConnection();
      let stream = null;

      if (hasNativeWebRTC) {
        stream = await getLocalMediaStream();
        if (stream && pc) {
          stream.getTracks().forEach((track) => {
            try {
              pc.addTrack(track, stream);
            } catch (e) {}
          });
        }
      }

      // If OUTGOING CALL: create offer and send via socket
      if (!isIncoming && target?._id) {
        try {
          let signalData = { type: 'offer' };
          if (pc) {
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: callType === 'video',
            });
            await pc.setLocalDescription(offer);
            signalData = offer;
          }

          socketService.callUser({
            userToCall: target._id,
            signalData,
            from: me?._id,
            fromName: me?.fullName,
            fromPic: me?.profilePic,
            callType,
          });
        } catch (offerErr) {
          console.warn('Error creating offer:', offerErr);
        }
      }
    };

    setupCall();

    // Socket Event Listeners
    const handleCallAccepted = async (data) => {
      setCallStatus('connected');

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);

      if (data?.signal && pcRef.current && RTCSessionDescription) {
        try {
          const desc = new RTCSessionDescription(data.signal);
          await pcRef.current.setRemoteDescription(desc);
        } catch (e) {
          console.warn('Error setting remote description:', e);
        }
      }
    };

    const handleIceCandidate = async (data) => {
      if (data?.candidate && pcRef.current && RTCIceCandidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {}
      }
    };

    const handleCallEnded = () => {
      endCallLocally('completed');
    };

    const handleCallRejected = () => {
      Alert.alert('Call Declined', 'User declined your call.');
      endCallLocally('declined');
    };

    const handleCallFailed = (data) => {
      Alert.alert('Call Failed', data?.message || 'User is unavailable.');
      endCallLocally('failed');
    };

    socketService.on('call-accepted', handleCallAccepted);
    socketService.on('ice-candidate', handleIceCandidate);
    socketService.on('call-ended', handleCallEnded);
    socketService.on('call-rejected', handleCallRejected);
    socketService.on('call-failed', handleCallFailed);

    return () => {
      cleanupCall();
      socketService.off('call-accepted', handleCallAccepted);
      socketService.off('ice-candidate', handleIceCandidate);
      socketService.off('call-ended', handleCallEnded);
      socketService.off('call-rejected', handleCallRejected);
      socketService.off('call-failed', handleCallFailed);
    };
  }, [visible, isIncoming, target?._id, me, callType, cleanupCall, initPeerConnection, getLocalMediaStream, endCallLocally]);

  // 5. User Controls
  const acceptCall = async () => {
    setCallStatus('connected');
    timerRef.current = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);

    const pc = pcRef.current;
    if (pc && RTCSessionDescription) {
      try {
        const offerSignal = incomingOfferRef.current;
        if (offerSignal?.type === 'offer') {
          const desc = new RTCSessionDescription(offerSignal);
          await pc.setRemoteDescription(desc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socketService.answerCall({
            to: target?._id,
            signal: answer,
          });
          return;
        }
      } catch (err) {
        console.warn('Error answering WebRTC offer:', err);
      }
    }

    // Fallback answer
    socketService.answerCall({
      to: target?._id,
      signal: { type: 'answer' },
    });
  };

  const declineCall = () => {
    if (target?._id) {
      socketService.rejectCall({ to: target._id });
    }
    endCallLocally('declined');
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(!isMuted);
  };

  // Toggle Speakerphone
  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  // Flip Camera
  const switchCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track._switchCamera && track._switchCamera();
      });
      setIsFrontCamera(!isFrontCamera);
    }
  };

  const formatCallDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <StatusBar backgroundColor="#07161A" barStyle="light-content" />
      <View style={styles.modalBackdrop}>
        {/* Fullscreen Video Stream or Audio Avatar Background */}
        {callType === 'video' && remoteStream && callStatus === 'connected' && RTCView ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.fullVideoFeed}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <View style={styles.audioBackgroundWrap}>
            <View style={styles.avatarRippleWrap}>
              <View style={styles.rippleOuter}>
                {target?.profilePic ? (
                  <Image source={{ uri: getImageUrl(target.profilePic) }} style={styles.bigAvatar} />
                ) : (
                  <View style={styles.bigAvatarPlaceholder}>
                    <Text style={styles.bigAvatarText}>
                      {target?.fullName?.charAt(0) || 'U'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Floating Header Info */}
        <View style={styles.topInfo}>
          <Text style={styles.targetName}>{target?.fullName || 'Contact'}</Text>
          <Text style={styles.statusLabel}>
            {callStatus === 'connected'
              ? formatCallDuration(callSeconds)
              : callStatus === 'ringing'
              ? `Incoming WhatsApp ${callType === 'audio' ? 'Voice' : 'Video'} Call...`
              : `Calling ${callType === 'audio' ? 'Voice' : 'Video'}...`}
          </Text>
          <View style={styles.encryptionBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>End-to-End Encrypted</Text>
          </View>
        </View>

        {/* Picture-in-Picture Local Video Preview (Video calls only) */}
        {callType === 'video' && isVideoEnabled && localStream && RTCView && (
          <View style={styles.pipBox}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.pipVideo}
              objectFit="cover"
              mirror={isFrontCamera}
            />
          </View>
        )}

        {/* Floating Controls */}
        {callStatus === 'ringing' ? (
          <View style={styles.incomingControls}>
            <TouchableOpacity
              style={[styles.callActionBtn, styles.declineBtn]}
              onPress={declineCall}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.callActionBtn, styles.acceptBtn]}
              onPress={acceptCall}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={28} color="#FFFFFF" />
              <Text style={styles.btnLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeControls}>
            {/* 1. Mic Mute */}
            <TouchableOpacity
              style={[styles.toolBtn, isMuted && styles.toolBtnActive]}
              onPress={toggleMute}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={22}
                color={isMuted ? '#EF4444' : '#FFFFFF'}
              />
              <Text style={styles.toolBtnText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            {/* 2. Speaker Controller */}
            <TouchableOpacity
              style={[styles.toolBtn, isSpeakerOn && styles.toolBtnHighlight]}
              onPress={toggleSpeaker}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
                size={22}
                color={isSpeakerOn ? '#10B981' : '#FFFFFF'}
              />
              <Text style={styles.toolBtnText}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
            </TouchableOpacity>

            {/* 3. Video Controls (if video call) */}
            {callType === 'video' && (
              <>
                <TouchableOpacity
                  style={[styles.toolBtn, !isVideoEnabled && styles.toolBtnActive]}
                  onPress={toggleVideo}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                    size={22}
                    color={!isVideoEnabled ? '#EF4444' : '#FFFFFF'}
                  />
                  <Text style={styles.toolBtnText}>{isVideoEnabled ? 'Video' : 'No Video'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={switchCamera}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
                  <Text style={styles.toolBtnText}>Flip</Text>
                </TouchableOpacity>
              </>
            )}

            {/* 4. End Call */}
            <TouchableOpacity
              style={[styles.callActionBtn, styles.declineBtn]}
              onPress={() => endCallLocally('completed')}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#07161A',
    justifyContent: 'space-between',
  },
  audioBackgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07161A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullVideoFeed: {
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  topInfo: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    zIndex: 10,
    backgroundColor: 'rgba(7, 22, 26, 0.65)',
    paddingVertical: 12,
    marginHorizontal: 20,
    borderRadius: 20,
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
    marginTop: 4,
    fontWeight: '600',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  avatarRippleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0, 196, 159, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00C49F',
  },
  bigAvatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  bigAvatarPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#0F2D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pipBox: {
    position: 'absolute',
    top: 140,
    right: 20,
    width: 100,
    height: 145,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#00C49F',
    overflow: 'hidden',
    backgroundColor: '#0F2D37',
    elevation: 8,
    zIndex: 20,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 50,
    paddingHorizontal: 40,
    zIndex: 30,
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginBottom: 40,
    marginHorizontal: 16,
    backgroundColor: 'rgba(15, 45, 55, 0.92)',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 35,
    elevation: 10,
    zIndex: 30,
  },
  callActionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 50,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
  },
  toolBtnHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
  },
  toolBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
});

export default VideoCallModal;
