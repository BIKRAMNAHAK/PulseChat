const Group = require('../Modal/GroupModal');
const Message = require('../Modal/Message');
const User = require('../Modal/RegisterModal');

// 1. Create New Group
exports.createGroup = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { name, description, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required.' });
    }

    let parsedMembers = [];
    if (memberIds) {
      parsedMembers = Array.isArray(memberIds) ? memberIds : JSON.parse(memberIds);
    }

    // Include admin in members list if not already present
    const membersSet = new Set(parsedMembers.map((id) => id.toString()));
    membersSet.add(adminId.toString());

    let groupPic = '';
    if (req.file) {
      groupPic = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;
    } else if (req.body.groupPic) {
      groupPic = req.body.groupPic;
    }

    const newGroup = await Group.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      groupPic,
      admin: adminId,
      members: Array.from(membersSet),
      lastMessage: {
        content: `Group created by ${req.user.fullName}`,
        senderName: 'System',
        createdAt: new Date(),
      },
    });

    const populatedGroup = await Group.findById(newGroup._id)
      .populate('admin', 'fullName profilePic')
      .populate('members', 'fullName profilePic isOnline lastSeen');

    // Notify all members via socket
    const io = req.app.get('io');
    if (io) {
      Array.from(membersSet).forEach((memberId) => {
        io.to(memberId).emit('group-created', populatedGroup);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Group created successfully!',
      group: populatedGroup,
    });
  } catch (error) {
    console.error('Error creating group:', error);
    return res.status(500).json({ success: false, message: 'Failed to create group.' });
  }
};

// 2. Get All Groups of Current User
exports.getMyGroups = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const groups = await Group.find({
      members: currentUserId,
    })
      .populate('admin', 'fullName profilePic')
      .populate('members', 'fullName profilePic isOnline lastSeen')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      groups,
    });
  } catch (error) {
    console.error('Error in getMyGroups:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch groups.' });
  }
};

// 3. Get Group Messages
exports.getGroupMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Security check: Must be member
    const isMember = group.members.some((m) => m.toString() === currentUserId.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group.' });
    }

    const rawMessages = await Message.find({
      groupId,
      deletedFor: { $nin: [currentUserId] },
    })
      .populate('sender', 'fullName profilePic')
      .sort({ createdAt: 1 });

    const serverBase = `${req.protocol}://${req.get('host')}`;
    const messages = rawMessages.map((m) => {
      const obj = m.toObject();
      if (obj.mediaUrl && !obj.mediaUrl.startsWith('http://') && !obj.mediaUrl.startsWith('https://')) {
        obj.mediaUrl = `${serverBase}${obj.mediaUrl.startsWith('/') ? '' : '/'}${obj.mediaUrl}`;
      }
      return obj;
    });

    return res.status(200).json({
      success: true,
      group,
      messages,
    });
  } catch (error) {
    console.error('Error in getGroupMessages:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch group messages.' });
  }
};

// 4. Send Message to Group
exports.sendGroupMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { groupId, content, messageType } = req.body;

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required.' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const isMember = group.members.some((m) => m.toString() === senderId.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group.' });
    }

    let mediaUrl = '';
    if (req.file) {
      mediaUrl = `${req.protocol}://${req.get('host')}/uploads/chats/${req.file.filename}`;
    } else if (req.body.mediaUrl) {
      mediaUrl = req.body.mediaUrl;
    }

    const message = await Message.create({
      sender: senderId,
      groupId,
      content: content || '',
      messageType: messageType || (mediaUrl ? 'image' : 'text'),
      mediaUrl,
      status: 'delivered',
    });

    // Update group last message
    group.lastMessage = {
      content: content || (mediaUrl ? 'Photo' : ''),
      senderName: req.user.fullName,
      createdAt: new Date(),
    };
    await group.save();

    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      'fullName profilePic'
    );

    // Emit to socket room for this group
    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('receive-group-message', {
        groupId,
        message: populatedMessage,
      });

      // Also notify members' personal rooms to update chat list last message
      group.members.forEach((memberId) => {
        io.to(memberId.toString()).emit('group-updated', {
          groupId,
          lastMessage: group.lastMessage,
        });
      });
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('Error in sendGroupMessage:', error);
    return res.status(500).json({ success: false, message: 'Failed to send group message.' });
  }
};

// 5. Leave Group
exports.leaveGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    group.members = group.members.filter((m) => m.toString() !== userId.toString());
    await group.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('member-left', {
        groupId,
        userId,
        userName: req.user.fullName,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'You left the group.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to leave group.' });
  }
};
