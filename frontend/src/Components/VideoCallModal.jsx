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

// SAFE WebRTC load - check NativeModules first before require()
let RTCPeerConnection = null;
let RTCIceCandidate = null;
let RTCSessionDescription = null;
let RTCView = null;
let mediaDevices = null;

const hasNativeWebRTCModule = !!(
  NativeModules.WebRTCModule &&
  typeof NativeModules.WebRTCModule === 'object'
);

if (hasNativeWebRTCModule) {
  try {
    const lib = require('react-native-webrtc');
    RTCPeerConnection = lib.RTCPeerConnection || null;
    RTCIceCandidate = lib.RTCIceCandidate || null;
    RTCSessionDescription = lib.RTCSessionDescription || null;
    RTCView = lib.RTCView || null;
    mediaDevices = lib.mediaDevices || null;
  } catch (e) {
    console.warn('react-native-webrtc load error:', e.message);
  }
}

const hasNativeWebRTC = !!(hasNativeWebRTCModule && RTCPeerConnection && mediaDevices);

const { width, height } = Dimensions.get('window');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoCallModal = ({ visible, callType = 'video', isIncoming = false, targetUser, recipient, currentUser, incomingSignal = null, onClose }) => {
  const authUser = useSelector((state) => state.auth?.user);
  const target = targetUser || recipient;
  const me = currentUser || authUser;

  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const incomingOfferRef = useRef(incomingSignal);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (incomingSignal) incomingOfferRef.current = incomingSignal;
  }, [incomingSignal]);

  const requestCallPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (callType === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      const granted = await PermissionsAndroid.requestMultiple(perms);
      return granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  }, [callType]);

  const cleanupCall = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    if (localStreamRef.current) {
      try {
        (localStreamRef.current.getTracks?.() || []).forEach((t) => { try { t.stop?.(); } catch (_) {} });
        localStreamRef.current.release?.();
      } catch (e) {}
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close?.(); } catch (e) {}
      pcRef.current = null;
    }
    if (isMountedRef.current) {
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, []);

  const endCallLocally = useCallback((status = 'completed') => {
    cleanupCall();
    try {
      if (target?._id) socketService.endCall({ to: target._id, callDuration: callSeconds, callType, callStatus: status });
    } catch (e) {}
    onClose?.();
  }, [cleanupCall, target?._id, callSeconds, callType, onClose]);

  const initPeerConnection = useCallback(() => {
    if (!hasNativeWebRTC || !RTCPeerConnection) return null;
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      pc.onicecandidate = (event) => {
        try { if (event?.candidate && target?._id) socketService.sendIceCandidate({ to: target._id, candidate: event.candidate }); } catch (e) {}
      };
      pc.ontrack = (event) => {
        try { if (event?.streams?.[0] && isMountedRef.current) setRemoteStream(event.streams[0]); } catch (e) {}
      };
      pc.onconnectionstatechange = () => {
        try {
          if (!isMountedRef.current) return;
          if (pc.connectionState === 'connected') setCallStatus('connected');
          else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) endCallLocally('completed');
        } catch (e) {}
      };
      return pc;
    } catch (err) {
      console.warn('RTCPeerConnection error:', err?.message);
      return null;
    }
  }, [target?._id, endCallLocally]);

  const getLocalMediaStream = useCallback(async () => {
    if (!hasNativeWebRTC || !mediaDevices?.getUserMedia) return null;
    const hasPerm = await requestCallPermissions();
    if (!hasPerm) {
      Alert.alert('Permission Required', 'Microphone/Camera permission needed for calls.');
      return null;
    }
    const tryList = callType === 'video'
      ? [{ audio: true, video: { facingMode: 'user', width: 640, height: 480 } }, { audio: true, video: true }, { audio: true, video: false }]
      : [{ audio: true, video: false }];
    for (const constraints of tryList) {
      try {
        const stream = await mediaDevices.getUserMedia(constraints);
        if (stream && isMountedRef.current) { setLocalStream(stream); localStreamRef.current = stream; }
        return stream;
      } catch (e) { console.warn('getUserMedia failed:', e?.message); }
    }
    return null;
  }, [callType, requestCallPermissions]);

  const getStreamURL = (stream) => {
    if (!stream) return null;
    try { return typeof stream.toURL === 'function' ? stream.toURL() : (stream._reactTag || null); } catch (e) { return null; }
  };

  useEffect(() => {
    if (!visible) { cleanupCall(); return; }
    setCallSeconds(0);
    setCallStatus(isIncoming ? 'ringing' : 'calling');
    setLocalStream(null);
    setRemoteStream(null);

    const setupCall = async () => {
      try {
        const pc = initPeerConnection();
        if (hasNativeWebRTC) {
          const stream = await getLocalMediaStream();
          if (stream && pc) {
            (stream.getTracks?.() || []).forEach((track) => { try { pc.addTrack(track, stream); } catch (e) { console.warn('addTrack:', e?.message); } });
          }
        }
        if (!isIncoming && target?._id) {
          let signalData = { type: 'offer', sdp: '' };
          if (pc && RTCSessionDescription) {
            try {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
              await pc.setLocalDescription(offer);
              signalData = offer;
            } catch (offerErr) { console.warn('createOffer error:', offerErr?.message); }
          }
          socketService.callUser({ userToCall: target._id, signalData, from: me?._id, fromName: me?.fullName, fromPic: me?.profilePic, callType });
        }
      } catch (e) { console.warn('setupCall error:', e?.message); }
    };

    setupCall();

    const handleCallAccepted = async (data) => {
      try {
        if (!isMountedRef.current) return;
        setCallStatus('connected');
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => { if (isMountedRef.current) setCallSeconds((s) => s + 1); }, 1000);
        if (data?.signal && pcRef.current && RTCSessionDescription) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
        }
      } catch (e) { console.warn('call-accepted error:', e?.message); }
    };
    const handleIceCandidate = async (data) => {
      try { if (data?.candidate && pcRef.current && RTCIceCandidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
    };
    const handleCallEnded = () => { try { endCallLocally('completed'); } catch (e) {} };
    const handleCallRejected = () => { try { Alert.alert('Call Declined', 'User declined your call.'); endCallLocally('declined'); } catch (e) {} };
    const handleCallFailed = (data) => { try { Alert.alert('Call Failed', data?.message || 'User unavailable.'); endCallLocally('failed'); } catch (e) {} };

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
  }, [visible, isIncoming, target?._id, callType]);

  const acceptCall = useCallback(async () => {
    try {
      setCallStatus('connected');
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => { if (isMountedRef.current) setCallSeconds((s) => s + 1); }, 1000);
      if (hasNativeWebRTC && !localStreamRef.current) {
        const stream = await getLocalMediaStream();
        const pc = pcRef.current;
        if (stream && pc) (stream.getTracks?.() || []).forEach((t) => { try { pc.addTrack(t, stream); } catch (e) {} });
      }
      const pc = pcRef.current;
      const offerSignal = incomingOfferRef.current;
      if (pc && RTCSessionDescription && offerSignal?.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSignal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.answerCall({ to: target?._id, signal: answer });
      } else {
        socketService.answerCall({ to: target?._id, signal: { type: 'answer', sdp: '' } });
      }
    } catch (err) {
      console.warn('acceptCall error:', err?.message);
      socketService.answerCall({ to: target?._id, signal: { type: 'answer', sdp: '' } });
    }
  }, [getLocalMediaStream, target?._id]);

  const declineCall = useCallback(() => {
    try { if (target?._id) socketService.rejectCall({ to: target._id }); endCallLocally('declined'); } catch (e) {}
  }, [target?._id, endCallLocally]);

  const toggleMute = useCallback(() => { try { (localStreamRef.current?.getAudioTracks?.() || []).forEach((t) => { t.enabled = !t.enabled; }); } catch (e) {} setIsMuted((p) => !p); }, []);
  const toggleSpeaker = useCallback(() => setIsSpeakerOn((p) => !p), []);
  const toggleVideo = useCallback(() => { try { (localStreamRef.current?.getVideoTracks?.() || []).forEach((t) => { t.enabled = !t.enabled; }); } catch (e) {} setIsVideoEnabled((p) => !p); }, []);
  const switchCamera = useCallback(() => { try { (localStreamRef.current?.getVideoTracks?.() || []).forEach((t) => { t._switchCamera?.(); }); setIsFrontCamera((p) => !p); } catch (e) {} }, []);

  const formatCallDuration = (secs) => {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!visible) return null;
  const remoteURL = getStreamURL(remoteStream);
  const localURL = getStreamURL(localStream);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <StatusBar backgroundColor="#07161A" barStyle="light-content" />
      <View style={styles.container}>

        {callType === 'video' && remoteURL && callStatus === 'connected' && RTCView ? (
          <RTCView streamURL={remoteURL} style={styles.fullVideo} objectFit="cover" mirror={false} zOrder={0} />
        ) : (
          <View style={styles.avatarBg}>
            <View style={styles.ring}>
              {target?.profilePic ? (
                <Image source={{ uri: getImageUrl(target.profilePic) }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{target?.fullName?.charAt(0)?.toUpperCase() || 'U'}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.nameText}>{target?.fullName || 'Contact'}</Text>
          <Text style={styles.statusText}>
            {callStatus === 'connected' ? formatCallDuration(callSeconds) : callStatus === 'ringing' ? `Incoming ${callType === 'audio' ? 'Voice' : 'Video'} Call...` : `Calling ${callType === 'audio' ? 'Voice' : 'Video'}...`}
          </Text>
          <View style={styles.encBadge}><View style={styles.dot} /><Text style={styles.encText}>End-to-End Encrypted</Text></View>
        </View>

        {callType === 'video' && isVideoEnabled && localURL && RTCView && (
          <View style={styles.pip}>
            <RTCView streamURL={localURL} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isFrontCamera} zOrder={1} />
          </View>
        )}

        {callStatus === 'ringing' ? (
          <View style={styles.incomingRow}>
            <TouchableOpacity style={[styles.roundBtn, styles.red]} onPress={declineCall}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roundBtn, styles.green]} onPress={acceptCall}>
              <Ionicons name="call" size={28} color="#fff" />
              <Text style={styles.btnLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeRow}>
            <TouchableOpacity style={[styles.ctrl, isMuted && styles.ctrlRed]} onPress={toggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#EF4444' : '#fff'} />
              <Text style={styles.ctrlText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrl, isSpeakerOn && styles.ctrlGreen]} onPress={toggleSpeaker}>
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={22} color={isSpeakerOn ? '#10B981' : '#fff'} />
              <Text style={styles.ctrlText}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
            </TouchableOpacity>
            {callType === 'video' && (
              <>
                <TouchableOpacity style={[styles.ctrl, !isVideoEnabled && styles.ctrlRed]} onPress={toggleVideo}>
                  <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={22} color={!isVideoEnabled ? '#EF4444' : '#fff'} />
                  <Text style={styles.ctrlText}>{isVideoEnabled ? 'Video' : 'Off'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctrl} onPress={switchCamera}>
                  <Ionicons name="camera-reverse" size={22} color="#fff" />
                  <Text style={styles.ctrlText}>Flip</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.roundBtn, styles.red]} onPress={() => endCallLocally('completed')}>
              <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07161A', justifyContent: 'space-between' },
  avatarBg: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  fullVideo: { width, height, position: 'absolute', top: 0, left: 0 },
  ring: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,196,159,0.15)', borderWidth: 2, borderColor: '#00C49F', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 130, height: 130, borderRadius: 65 },
  avatarFallback: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#0F2D37', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 52, fontWeight: '700', color: '#fff' },
  header: { alignItems: 'center', marginTop: Platform.OS === 'ios' ? 60 : 44, zIndex: 10, backgroundColor: 'rgba(7,22,26,0.70)', paddingVertical: 14, marginHorizontal: 20, borderRadius: 20 },
  nameText: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  statusText: { fontSize: 14, color: '#00C49F', marginTop: 4, fontWeight: '600' },
  encBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  encText: { color: '#CBD5E1', fontSize: 11, fontWeight: '500' },
  pip: { position: 'absolute', top: 140, right: 20, width: 100, height: 145, borderRadius: 14, borderWidth: 2, borderColor: '#00C49F', overflow: 'hidden', backgroundColor: '#0F2D37', elevation: 8, zIndex: 20 },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 50, paddingHorizontal: 40 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 40, marginHorizontal: 16, backgroundColor: 'rgba(15,45,55,0.92)', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 35, elevation: 10 },
  roundBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  red: { backgroundColor: '#EF4444' },
  green: { backgroundColor: '#10B981' },
  btnLabel: { color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' },
  ctrl: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 8, minWidth: 50 },
  ctrlRed: { backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 12 },
  ctrlGreen: { backgroundColor: 'rgba(16,185,129,0.25)', borderRadius: 12 },
  ctrlText: { color: '#fff', fontSize: 10, marginTop: 3, fontWeight: '600' },
});

export default VideoCallModal;
