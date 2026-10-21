const Message = require('../Modal/Message');
const User = require('../Modal/RegisterModal');
const { checkCanChat } = require('./connenctonReq');
const fs = require('fs');

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

    const rawMessages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: recipientId },
        { sender: recipientId, receiver: currentUserId },
      ],
      deletedFor: { $nin: [currentUserId] },
    }).sort({ createdAt: 1 });

    const serverBase = `${req.protocol}://${req.get('host')}`;
    const messages = rawMessages.map((m) => {
      const obj = m.toObject();
      if (obj.mediaUrl && !obj.mediaUrl.startsWith('http://') && !obj.mediaUrl.startsWith('https://')) {
        obj.mediaUrl = `${serverBase}${obj.mediaUrl.startsWith('/') ? '' : '/'}${obj.mediaUrl}`;
      }
      return obj;
    });

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

    const activeUsers = req.app.get('activeUsers');
    const recipientUser = await User.findById(recipientId).select('fullName profilePic isOnline lastSeen');
    let recipientData = null;
    if (recipientUser) {
      recipientData = {
        ...recipientUser.toObject(),
        isOnline: activeUsers ? activeUsers.has(recipientId.toString()) : !!recipientUser.isOnline,
      };
    }

    return res.status(200).json({
      success: true,
      canChat: true,
      messages,
      recipient: recipientData,
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
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        mediaUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;
        fs.unlinkSync(req.file.path);
      } catch (err) {
        mediaUrl = `${req.protocol}://${req.get('host')}/uploads/chats/${req.file.filename}`;
      }
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

// 5. Edit Message (Sender can edit text messages)
exports.editMessage = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    if (message.sender.toString() !== currentUserId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages.' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted message.' });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'fullName profilePic')
      .populate('receiver', 'fullName profilePic');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        messageId: message._id,
        content: message.content,
        isEdited: true,
        editedAt: message.editedAt,
        message: populatedMessage,
      };

      if (message.groupId) {
        io.to(`group_${message.groupId}`).emit('message-edited', payload);
      } else {
        if (message.receiver) {
          io.to(message.receiver.toString()).emit('message-edited', payload);
        }
        io.to(currentUserId.toString()).emit('message-edited', payload);
      }
    }

    return res.status(200).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('Error in editMessage:', error);
    return res.status(500).json({ success: false, message: 'Failed to edit message.' });
  }
};

// 6. Delete Message ('everyone' or 'me')
exports.deleteMessage = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { messageId } = req.params;
    const { deleteType } = req.body; // 'everyone' | 'me'

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const io = req.app.get('io');

    if (deleteType === 'everyone') {
      // Must be sender
      if (message.sender.toString() !== currentUserId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages for everyone.',
        });
      }

      message.isDeleted = true;
      message.content = 'This message was deleted';
      message.mediaUrl = '';
      await message.save();

      const payload = {
        messageId: message._id,
        deleteType: 'everyone',
        isDeleted: true,
        content: 'This message was deleted',
        mediaUrl: '',
      };

      if (io) {
        if (message.groupId) {
          io.to(`group_${message.groupId}`).emit('message-deleted', payload);
        } else {
          if (message.receiver) {
            io.to(message.receiver.toString()).emit('message-deleted', payload);
          }
          io.to(currentUserId.toString()).emit('message-deleted', payload);
        }
      }

      return res.status(200).json({
        success: true,
        messageId: message._id,
        deleteType: 'everyone',
        message: 'Message deleted for everyone.',
      });
    } else {
      // 'me' - add user to deletedFor
      const alreadyDeletedForUser = message.deletedFor.some(
        (id) => id.toString() === currentUserId.toString()
      );
      if (!alreadyDeletedForUser) {
        message.deletedFor.push(currentUserId);
        await message.save();
      }

      return res.status(200).json({
        success: true,
        messageId: message._id,
        deleteType: 'me',
        message: 'Message deleted for you.',
      });
    }
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
};

