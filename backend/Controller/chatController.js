const Message = require('../Modal/Message');
const User = require('../Modal/RegisterModal');
const { checkCanChat } = require('./connenctonReq');

// 1. Get Conversation Messages between Current User and Recipient
exports.getMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { recipientId } = req.params;

    // Security check: Must be mutual accepted friends
    const canChat = await checkCanChat(currentUserId, recipientId);
    if (!canChat) {
      return res.status(403).json({
        success: false,
        canChat: false,
        message: 'Chatting is restricted. You must be accepted friends to chat with this user.',
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: recipientId },
        { sender: recipientId, receiver: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    // Mark all unread messages from recipient as 'seen'
    const unreadFromRecipient = messages.filter(
      (m) => m.sender.toString() === recipientId.toString() && m.status !== 'seen'
    );

    if (unreadFromRecipient.length > 0) {
      const now = new Date();
      await Message.updateMany(
        {
          sender: recipientId,
          receiver: currentUserId,
          status: { $ne: 'seen' },
        },
        {
          $set: { status: 'seen', seenAt: now },
        }
      );

      // Emit socket event to sender so ticks turn green in real-time
      const io = req.app.get('io');
      if (io) {
        io.to(recipientId.toString()).emit('messages-seen', {
          byUserId: currentUserId.toString(),
          seenAt: now,
        });
      }
    }

    return res.status(200).json({
      success: true,
      canChat: true,
      messages,
    });
  } catch (error) {
    console.error('Error in getMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages.',
    });
  }
};

// 2. Send Message (Text / Image / Media)
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId, content, messageType } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID is required.',
      });
    }

    // Security check: Verify friendship
    const canChat = await checkCanChat(senderId, receiverId);
    if (!canChat) {
      return res.status(403).json({
        success: false,
        canChat: false,
        message: 'Cannot send message. You must be accepted friends and not unfollowed.',
      });
    }

    let mediaUrl = '';
    if (req.file) {
      mediaUrl = `/uploads/chats/${req.file.filename}`;
    } else if (req.body.mediaUrl) {
      mediaUrl = req.body.mediaUrl;
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver user not found.',
      });
    }

    // If receiver is online, status can be 'delivered', else 'sent'
    const status = receiver.isOnline ? 'delivered' : 'sent';
    const deliveredAt = receiver.isOnline ? new Date() : null;

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content: content || '',
      messageType: messageType || (mediaUrl ? 'image' : 'text'),
      mediaUrl,
      status,
      deliveredAt,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'fullName profilePic')
      .populate('receiver', 'fullName profilePic');

    // Emit real-time message to recipient
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('receive-message', populatedMessage);
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message.',
    });
  }
};

// 3. Mark Messages as Seen (Triggered when user opens/focuses chat)
exports.markAsSeen = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { senderId } = req.body;

    if (!senderId) {
      return res.status(400).json({ success: false, message: 'Sender ID is required.' });
    }

    const now = new Date();
    const result = await Message.updateMany(
      {
        sender: senderId,
        receiver: currentUserId,
        status: { $ne: 'seen' },
      },
      {
        $set: { status: 'seen', seenAt: now },
      }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(senderId.toString()).emit('messages-seen', {
        byUserId: currentUserId.toString(),
        seenAt: now,
      });
    }

    return res.status(200).json({
      success: true,
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error in markAsSeen:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark messages as seen.',
    });
  }
};

// 4. Get Call History Logs
exports.getCallHistory = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const callLogs = await Message.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      messageType: { $in: ['video_call_log', 'audio_call_log'] },
    })
      .populate('sender', 'fullName profilePic')
      .populate('receiver', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      callLogs,
    });
  } catch (error) {
    console.error('Error in getCallHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch call history.',
    });
  }
};
