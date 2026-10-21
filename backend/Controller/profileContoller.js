const User = require('../Modal/RegisterModal');
const fs = require('fs');

// 1. Get Profile by ID
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password -otp -otpExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile.',
    });
  }
};

// 2. Update Current User Profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, about, address, city, state, country, latitude, longitude } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (fullName) user.fullName = fullName.trim();
    if (about) user.about = about.trim();

    if (req.file) {
      // Store image directly in MongoDB as Base64 Data URL so it is NEVER lost on Render restarts!
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        user.profilePic = `data:${req.file.mimetype || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.warn('Error saving profilePic as base64 in MongoDB:', err);
        user.profilePic = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;
      }
    } else if (req.body.profilePic) {
      user.profilePic = req.body.profilePic;
    }

    if (address || city || latitude || longitude) {
      user.address = {
        formattedAddress: address || user.address?.formattedAddress || '',
        city: city || user.address?.city || '',
        state: state || user.address?.state || '',
        country: country || user.address?.country || '',
        latitude: latitude ? parseFloat(latitude) : user.address?.latitude,
        longitude: longitude ? parseFloat(longitude) : user.address?.longitude,
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user,
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
    });
  }
};

// 3. Search Users
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(200).json({ success: true, users: [] });
    }

    const regex = new RegExp(query, 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true,
      $or: [{ fullName: regex }, { mobileNumber: regex }, { email: regex }],
    })
      .select('fullName mobileNumber email profilePic about isOnline lastSeen')
      .limit(20);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Search failed.',
    });
  }
};
