const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let isInitialized = false;

try {
  let credential = null;

  // 1. Check if FIREBASE_SERVICE_ACCOUNT is provided in environment variables (Render / production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT JSON from env:', e.message);
    }
  }

  // 2. Fallback: Check local service account json file
  if (!credential) {
    const localKeyPath = path.join(__dirname, '..', 'firebase-service-account.json');
    if (fs.existsSync(localKeyPath)) {
      credential = admin.credential.cert(require(localKeyPath));
    }
  }

  if (credential) {
    admin.initializeApp({ credential });
    isInitialized = true;
    console.log('🔥 Firebase Admin initialized successfully!');
  } else {
    console.log('ℹ️ Firebase Admin not initialized: FIREBASE_SERVICE_ACCOUNT env or firebase-service-account.json not found yet.');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin init warning:', error.message);
}

/**
 * Send push notification to a device via FCM
 * @param {string} fcmToken - Device token of the recipient
 * @param {object} payload - { title, body, data }
 */
const sendPushNotification = async ({ fcmToken, title, body, data = {} }) => {
  if (!isInitialized || !fcmToken) return null;

  try {
    const stringData = {};
    for (const [key, val] of Object.entries(data)) {
      stringData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
    }

    const message = {
      token: fcmToken,
      notification: {
        title: title || 'PulseChat',
        body: body || '',
      },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'pulsechat_high_importance',
          priority: 'high',
        },
      },
    };

    const response = await admin.messaging().send(message);
    return response;
  } catch (error) {
    console.warn('⚠️ FCM send error:', error.message);
    return null;
  }
};

/**
 * Send high-priority Incoming Call notification
 */
const sendCallPushNotification = async ({ fcmToken, callerName, callerPic, callType, callId, callerId }) => {
  return sendPushNotification({
    fcmToken,
    title: `Incoming ${callType === 'audio' ? 'Voice' : 'Video'} Call`,
    body: `${callerName || 'Someone'} is calling you on PulseChat...`,
    data: {
      type: 'incoming_call',
      callerName: callerName || 'PulseChat User',
      callerPic: callerPic || '',
      callType: callType || 'video',
      callerId: callerId ? String(callerId) : '',
      callId: callId ? String(callId) : '',
    },
  });
};

/**
 * Send Chat Message notification
 */
const sendMessagePushNotification = async ({ fcmToken, senderName, content, senderId, conversationId }) => {
  return sendPushNotification({
    fcmToken,
    title: senderName || 'New Message',
    body: content || 'Sent an attachment',
    data: {
      type: 'chat_message',
      senderId: senderId ? String(senderId) : '',
      conversationId: conversationId ? String(conversationId) : '',
    },
  });
};

module.exports = {
  sendPushNotification,
  sendCallPushNotification,
  sendMessagePushNotification,
};
