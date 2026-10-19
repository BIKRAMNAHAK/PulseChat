import { io } from 'socket.io-client';
import { SOCKET_URL } from './helper';

class SocketService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.listeners = new Map();
  }

  // Connect socket with userId
  connect(userId) {
    if (this.socket && this.socket.connected && this.userId === userId) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.userId = userId;
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { userId },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('🟢 Socket connected successfully! ID:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('⚠️ Socket connection error:', error.message);
    });

    return this.socket;
  }

  // Send real-time chat message
  sendMessage(data, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('send-message', data, callback);
    }
  }

  // Mark messages as seen (triggers green double tick)
  markSeen(senderId, receiverId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('mark-seen', { senderId, receiverId });
    }
  }

  // Typing status
  emitTyping(senderId, receiverId, senderName) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing', { senderId, receiverId, senderName });
    }
  }

  emitStopTyping(senderId, receiverId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('stop-typing', { senderId, receiverId });
    }
  }

  // WebRTC Video / Audio Calling
  callUser({ userToCall, signalData, from, fromName, fromPic, callType = 'video' }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call-user', {
        userToCall,
        signalData,
        from,
        fromName,
        fromPic,
        callType,
      });
    }
  }

  answerCall({ to, signal }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('answer-call', { to, signal });
    }
  }

  sendIceCandidate({ to, candidate }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('ice-candidate', { to, candidate });
    }
  }

  endCall({ to, callDuration, callType, callStatus }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('end-call', { to, callDuration, callType, callStatus });
    }
  }

  rejectCall({ to }) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('reject-call', { to });
    }
  }

  // Generic Event Listener registration
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
    }
  }
}

const socketService = new SocketService();
export default socketService;
