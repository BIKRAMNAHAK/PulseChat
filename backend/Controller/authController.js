const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Modal/RegisterModal');
const PendingRegistration = require('../Modal/PendingRegistration');
const { sendOTPEmail } = require('../db_config/node_mailer');

// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'super_secure_jwt_secret_key_mychat_2026_@#!',
    { expiresIn: '30d' }
  );
};

// 1. Send OTP to Email
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update in PendingRegistration if pending
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (pending) {
      pending.otp = otp;
      pending.otpExpires = otpExpires;
      await pending.save();
    }

    // Also update in User if exists
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    }

    sendOTPEmail(normalizedEmail, otp).catch((err) =>
      console.warn('Background OTP email send error:', err.message)
    );

    return res.status(200).json({
      success: true,
      message: 'OTP has been sent to your email.',
      email: normalizedEmail,
      otp,
      devOtp: otp,
    });
  } catch (error) {
    console.error('Error in sendOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
      error: error.message,
    });
  }
};

// 2. Register New User (Holds in PendingRegistration until OTP is verified)
// Required fields: fullName, mobileNumber, email, password, confirmPassword, profilePic (optional), address (autofetched)
exports.register = async (req, res) => {
  try {
    const {
      fullName,
      mobileNumber,
      email,
      password,
      confirmPassword,
      address,
      latitude,
      longitude,
      city,
      state,
      country,
    } = req.body;

    // Validation
    if (!fullName || !mobileNumber || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (fullName, mobileNumber, email, password, confirmPassword).',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and Confirm Password do not match.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedMobile = mobileNumber.trim();

    // Check if email already registered and verified in User collection
    const existingEmailUser = await User.findOne({ email: normalizedEmail, isVerified: true });
    if (existingEmailUser) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered and verified. Please login.',
      });
    }

    // Check if mobile already registered and verified in User collection
    const existingMobileUser = await User.findOne({ mobileNumber: normalizedMobile, isVerified: true });
    if (existingMobileUser) {
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered. Please login.',
      });
    }

    // Handle Profile Pic if uploaded via multer
    let profilePicPath = '';
    if (req.file) {
      profilePicPath = `/uploads/profiles/${req.file.filename}`;
    } else if (req.body.profilePic) {
      profilePicPath = req.body.profilePic;
    }

    // Parse Address / Autofetched location
    const formattedAddressObj = {
      formattedAddress: address || (city ? `${city}, ${state || ''} ${country || ''}`.trim() : 'Location auto-detected'),
      city: city || '',
      state: state || '',
      country: country || '',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    };

    // Hash Password with bcrypt salt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // IMPORTANT: Save to PendingRegistration ONLY - do NOT pollute the User collection!
    const pending = await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        fullName: fullName.trim(),
        mobileNumber: normalizedMobile,
        email: normalizedEmail,
        password: hashedPassword,
        profilePic: profilePicPath,
        address: formattedAddressObj,
        otp,
        otpExpires,
        createdAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send OTP to user's email asynchronously
    sendOTPEmail(normalizedEmail, otp).catch((err) =>
      console.warn('Background OTP email send error:', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Registration initiated! Please verify the OTP sent to your email.',
      userId: pending._id,
      email: pending.email,
      otp,
      devOtp: otp,
    });
  } catch (error) {
    console.error('Error in register:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
};

// 3. Verify OTP & Complete Registration (Creates user in User collection ONLY after OTP is confirmed)
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const inputOtp = otp.toString().trim();

    // 1. Look for unverified pending registration
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });

    if (pending) {
      if (new Date() > new Date(pending.otpExpires)) {
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new OTP.',
        });
      }

      if (pending.otp !== inputOtp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP code. Please check and try again.',
        });
      }

      // Check if another user registered with same mobile while pending
      const duplicateMobile = await User.findOne({ mobileNumber: pending.mobileNumber });
      if (duplicateMobile) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res.status(400).json({
          success: false,
          message: 'This mobile number has already been taken by another account.',
        });
      }

      // Create confirmed user in User collection
      const newUser = await User.create({
        fullName: pending.fullName,
        mobileNumber: pending.mobileNumber,
        email: pending.email,
        password: pending.password,
        profilePic: pending.profilePic,
        address: pending.address,
        isVerified: true,
        isOnline: true,
      });

      // Remove from PendingRegistration
      await PendingRegistration.deleteOne({ _id: pending._id });

      const token = generateToken(newUser._id);

      return res.status(200).json({
        success: true,
        message: 'Account verified successfully!',
        token,
        user: newUser,
      });
    }

    // 2. Check if already verified user or legacy unverified user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.isVerified) {
        const token = generateToken(existingUser._id);
        return res.status(200).json({
          success: true,
          message: 'Account already verified!',
          token,
          user: existingUser,
        });
      }

      // Legacy unverified user OTP check
      if (existingUser.otp && existingUser.otpExpires) {
        if (new Date() > new Date(existingUser.otpExpires)) {
          return res.status(400).json({
            success: false,
            message: 'OTP has expired. Please request a new OTP.',
          });
        }
        if (existingUser.otp === inputOtp) {
          existingUser.isVerified = true;
          existingUser.otp = null;
          existingUser.otpExpires = null;
          existingUser.isOnline = true;
          await existingUser.save();
          const token = generateToken(existingUser._id);
          return res.status(200).json({
            success: true,
            message: 'Account verified successfully!',
            token,
            user: existingUser,
          });
        }
      }
    }

    return res.status(404).json({
      success: false,
      message: 'Registration session expired or account not found. Please register again.',
    });
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying OTP.',
      error: error.message,
    });
  }
};

// 4. Resend OTP
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (pending) {
      pending.otp = otp;
      pending.otpExpires = otpExpires;
      await pending.save();

      sendOTPEmail(normalizedEmail, otp).catch((err) =>
        console.warn('Background OTP email send error:', err.message)
      );

      return res.status(200).json({
        success: true,
        message: 'A fresh OTP has been sent to your email.',
        email: normalizedEmail,
        otp,
        devOtp: otp,
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      sendOTPEmail(user.email, otp).catch((err) =>
        console.warn('Background OTP email send error:', err.message)
      );

      return res.status(200).json({
        success: true,
        message: 'A fresh OTP has been sent to your email.',
        email: user.email,
        otp,
        devOtp: otp,
      });
    }

    return res.status(404).json({
      success: false,
      message: 'No pending registration or account found with this email.',
    });
  } catch (error) {
    console.error('Error in resendOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Error resending OTP.',
      error: error.message,
    });
  }
};

// 5. Login
exports.login = async (req, res) => {
  try {
    const { loginId, password } = req.body; // loginId can be email or mobile

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide Email/Mobile and Password.',
      });
    }

    const trimmedLogin = loginId.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: trimmedLogin }, { mobileNumber: loginId.trim() }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please try again.',
      });
    }

    if (!user.isVerified) {
      // Send OTP to verify
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      sendOTPEmail(user.email, otp).catch((err) =>
        console.warn('Background OTP email send error:', err.message)
      );

      return res.status(403).json({
        success: false,
        isUnverified: true,
        message: 'Your account is not verified yet. An OTP has been sent to your email.',
        email: user.email,
        otp,
        devOtp: otp,
      });
    }

    const token = generateToken(user._id);
    user.isOnline = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user,
    });
  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message,
    });
  }
};

// 6. Get Current User Profile
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -otp -otpExpires');
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching profile.',
    });
  }
};
