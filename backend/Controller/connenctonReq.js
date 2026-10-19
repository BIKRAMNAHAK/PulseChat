const FriendRequest = require('../Modal/FriendRequest');
const User = require('../Modal/RegisterModal');
const Message = require('../Modal/Message');

// 1. Get Friend Suggestions
// Returns verified users with connection status (none, pending, received, accepted, unfollowed)
exports.getSuggestions = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all existing requests involving current user
    const existingConnections = await FriendRequest.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
    });

    const connectionMap = new Map();
    existingConnections.forEach((conn) => {
      const isSender = conn.sender.toString() === currentUserId.toString();
      const otherUserId = isSender ? conn.receiver.toString() : conn.sender.toString();

      let status = conn.status;
      if (status === 'pending') {
        status = isSender ? 'pending' : 'received';
      }

      connectionMap.set(otherUserId, {
        status,
        requestId: conn._id,
      });
    });

    const users = await User.find({
      _id: { $ne: currentUserId },
      isVerified: true,
    })
      .select('fullName mobileNumber email profilePic address about isOnline lastSeen')
      .limit(50)
      .sort({ createdAt: -1 });

    const suggestions = users.map((u) => {
      const conn = connectionMap.get(u._id.toString());
      return {
        ...u.toObject(),
        connectionStatus: conn ? conn.status : 'none',
        requestId: conn ? conn.requestId : null,
      };
    });

    return res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error in getSuggestions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friend suggestions.',
      error: error.message,
    });
  }
};

// 2. Send Friend Request
exports.sendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID is required.',
      });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself.',
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found.',
      });
    }

    // Check existing connection
    let connection = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    });

    if (connection) {
      if (connection.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'You are already friends with this user.',
        });
      }
      if (connection.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'A connection request is already pending.',
        });
      }

      // If unfollowed or rejected previously, re-initiate
      connection.sender = senderId;
      connection.receiver = receiverId;
      connection.status = 'pending';
      await connection.save();
    } else {
      connection = await FriendRequest.create({
        sender: senderId,
        receiver: receiverId,
        status: 'pending',
      });
    }

    // Real-time socket notification if receiver online
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('friend-request-received', {
        requestId: connection._id,
        sender: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
          about: req.user.about,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Friend request sent successfully.',
      connection,
    });
  } catch (error) {
    console.error('Error in sendRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send friend request.',
      error: error.message,
    });
  }
};

// 3. Get Pending Requests (Received & Sent)
exports.getRequests = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Incoming requests for current user
    const incomingRequests = await FriendRequest.find({
      receiver: currentUserId,
      status: 'pending',
    }).populate('sender', 'fullName mobileNumber email profilePic about isOnline lastSeen');

    // Sent requests by current user
    const sentRequests = await FriendRequest.find({
      sender: currentUserId,
      status: 'pending',
    }).populate('receiver', 'fullName mobileNumber email profilePic about isOnline lastSeen');

    return res.status(200).json({
      success: true,
      incomingRequests,
      sentRequests,
    });
  } catch (error) {
    console.error('Error in getRequests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friend requests.',
    });
  }
};

// 4. Accept Friend Request -> Unlocks Chatting
exports.acceptRequest = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { requestId } = req.body;

    const connection = await FriendRequest.findOne({
      _id: requestId,
      receiver: currentUserId,
      status: 'pending',
    }).populate('sender', 'fullName profilePic isOnline');

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Pending friend request not found.',
      });
    }

    connection.status = 'accepted';
    await connection.save();

    // Notify sender via socket
    const io = req.app.get('io');
    if (io) {
      io.to(connection.sender._id.toString()).emit('friend-request-accepted', {
        friendId: currentUserId,
        friendName: req.user.fullName,
        friendPic: req.user.profilePic,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Friend request accepted! You can now start chatting.',
      friend: connection.sender,
    });
  } catch (error) {
    console.error('Error in acceptRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept friend request.',
    });
  }
};

// 5. Reject Friend Request
exports.rejectRequest = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { requestId } = req.body;

    const connection = await FriendRequest.findOneAndDelete({
      _id: requestId,
      receiver: currentUserId,
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Friend request rejected.',
    });
  } catch (error) {
    console.error('Error in rejectRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject request.',
    });
  }
};

// 6. Unfollow / Unfriend -> Immediately Locks and Disables Chat
exports.unfollowUser = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required.',
      });
    }

    const connection = await FriendRequest.findOne({
      $or: [
        { sender: currentUserId, receiver: targetUserId, status: 'accepted' },
        { sender: targetUserId, receiver: currentUserId, status: 'accepted' },
      ],
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Active friendship connection not found.',
      });
    }

    // Set status to unfollowed
    connection.status = 'unfollowed';
    await connection.save();

    // Notify via socket to immediately lock chat UI
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId.toString()).emit('user-unfollowed', {
        userId: currentUserId.toString(),
        message: `${req.user.fullName} has unfollowed you. Chatting is now disabled.`,
      });
      io.to(currentUserId.toString()).emit('user-unfollowed', {
        userId: targetUserId.toString(),
        message: `You unfollowed this user. Chatting is now disabled.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User unfollowed successfully. Chatting has been disabled.',
    });
  } catch (error) {
    console.error('Error in unfollowUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unfollow user.',
    });
  }
};

// 7. Get Friends List (Only accepted friendships for WhatsApp-like chats)
exports.getFriendsList = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const connections = await FriendRequest.find({
      $or: [
        { sender: currentUserId, status: 'accepted' },
        { receiver: currentUserId, status: 'accepted' },
      ],
    })
      .populate('sender', 'fullName mobileNumber email profilePic about isOnline lastSeen')
      .populate('receiver', 'fullName mobileNumber email profilePic about isOnline lastSeen');

    // Extract friend details and latest message
    const friends = await Promise.all(
      connections.map(async (conn) => {
        const friend =
          conn.sender._id.toString() === currentUserId.toString()
            ? conn.receiver
            : conn.sender;

        // Fetch last message between these two users
        const lastMessage = await Message.findOne({
          $or: [
            { sender: currentUserId, receiver: friend._id },
            { sender: friend._id, receiver: currentUserId },
          ],
        }).sort({ createdAt: -1 });

        // Unread count
        const unreadCount = await Message.countDocuments({
          sender: friend._id,
          receiver: currentUserId,
          status: { $ne: 'seen' },
        });

        return {
          _id: friend._id,
          fullName: friend.fullName,
          mobileNumber: friend.mobileNumber,
          profilePic: friend.profilePic,
          about: friend.about,
          isOnline: friend.isOnline,
          lastSeen: friend.lastSeen,
          connectionId: conn._id,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                messageType: lastMessage.messageType,
                status: lastMessage.status,
                sender: lastMessage.sender,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort friends by last message date, newest first
    friends.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json({
      success: true,
      friends,
    });
  } catch (error) {
    console.error('Error in getFriendsList:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friends list.',
    });
  }
};

// 8. Helper function to check if chat is allowed between two users
exports.checkCanChat = async (userAId, userBId) => {
  const connection = await FriendRequest.findOne({
    $or: [
      { sender: userAId, receiver: userBId, status: 'accepted' },
      { sender: userBId, receiver: userAId, status: 'accepted' },
    ],
  });
  return !!connection;
};
