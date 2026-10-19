const Status = require('../Modal/StatusModal');
const FriendRequest = require('../Modal/FriendRequest');

// 1. Create / Upload Status (Short / Story)
exports.createStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { caption, mediaType } = req.body;

    let mediaUrl = '';
    let finalMediaType = mediaType || 'image';

    if (req.file) {
      mediaUrl = `${req.protocol}://${req.get('host')}/uploads/statuses/${req.file.filename}`;
      finalMediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    } else if (req.body.mediaUrl) {
      mediaUrl = req.body.mediaUrl;
    } else if (finalMediaType === 'text' && caption) {
      mediaUrl = req.body.bgColor || '#0F5132'; // Text status background color
    }

    if (!mediaUrl && finalMediaType !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Media file, text, or media URL is required to post status.',
      });
    }

    const newStatus = await Status.create({
      user: userId,
      mediaUrl: mediaUrl || '#0F5132',
      mediaType: finalMediaType,
      caption: caption || '',
    });

    const populatedStatus = await Status.findById(newStatus._id).populate(
      'user',
      'fullName profilePic'
    );

    // Notify connected friends via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('new-status-posted', populatedStatus);
    }

    return res.status(201).json({
      success: true,
      message: 'Status uploaded successfully!',
      status: populatedStatus,
    });
  } catch (error) {
    console.error('Error in createStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload status.',
    });
  }
};

// 2. Get Statuses of Friends & Current User
exports.getStatuses = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get mutual friends
    const connections = await FriendRequest.find({
      $or: [
        { sender: currentUserId, status: 'accepted' },
        { receiver: currentUserId, status: 'accepted' },
      ],
    });

    const friendIds = connections.map((conn) =>
      conn.sender.toString() === currentUserId.toString() ? conn.receiver : conn.sender
    );

    // Also include own user id
    const allowedUserIds = [currentUserId, ...friendIds];

    const activeStatuses = await Status.find({
      user: { $in: allowedUserIds },
      expiresAt: { $gt: new Date() },
    })
      .populate('user', 'fullName profilePic')
      .populate('viewers.user', 'fullName profilePic')
      .sort({ createdAt: -1 });

    // Group by user
    const myStatuses = activeStatuses.filter(
      (s) => s.user._id.toString() === currentUserId.toString()
    );
    const friendsStatuses = activeStatuses.filter(
      (s) => s.user._id.toString() !== currentUserId.toString()
    );

    return res.status(200).json({
      success: true,
      myStatuses,
      friendsStatuses,
    });
  } catch (error) {
    console.error('Error in getStatuses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch statuses.',
    });
  }
};

// 3. Mark Status as Viewed
exports.viewStatus = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { statusId } = req.params;

    const status = await Status.findById(statusId);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found or expired.',
      });
    }

    // Check if current user has already viewed
    const alreadyViewed = status.viewers.some(
      (v) => v.user.toString() === currentUserId.toString()
    );

    if (!alreadyViewed) {
      status.viewers.push({
        user: currentUserId,
        viewedAt: new Date(),
      });
      await status.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Status viewed.',
      viewersCount: status.viewers.length,
    });
  } catch (error) {
    console.error('Error in viewStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register status view.',
    });
  }
};
