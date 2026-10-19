const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Modal/RegisterModal');
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

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    }

    const emailResult = await sendOTPEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: 'OTP has been sent to your email.',
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      emailResult,
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

// 2. Register New User
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

    // Check if email already registered
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail && existingEmail.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered and verified. Please login.',
      });
    }

    // Check if mobile already registered
    const existingMobile = await User.findOne({
      mobileNumber: normalizedMobile,
      _id: { $ne: existingEmail?._id },
    });
    if (existingMobile && existingMobile.isVerified) {
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

    let user;
    if (existingEmail && !existingEmail.isVerified) {
      // Update unverified user
      existingEmail.fullName = fullName.trim();
      existingEmail.mobileNumber = normalizedMobile;
      existingEmail.password = hashedPassword;
      if (profilePicPath) existingEmail.profilePic = profilePicPath;
      existingEmail.address = formattedAddressObj;
      existingEmail.otp = otp;
      existingEmail.otpExpires = otpExpires;
      user = await existingEmail.save();
    } else {
      user = await User.create({
        fullName: fullName.trim(),
        mobileNumber: normalizedMobile,
        email: normalizedEmail,
        password: hashedPassword,
        profilePic: profilePicPath,
        address: formattedAddressObj,
        otp,
        otpExpires,
        isVerified: false,
      });
    }

    // Send OTP to user's email
    await sendOTPEmail(normalizedEmail, otp);

    return res.status(201).json({
      success: true,
      message: 'Registration initiated! Please verify the OTP sent to your email.',
      userId: user._id,
      email: user.email,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (error) {
    console.error('Error in register:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
};

// 3. Verify OTP & Complete Registration
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: 'No pending OTP found. Please request a new OTP.',
      });
    }

    if (new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    if (user.otp !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please check and try again.',
      });
    }

    // Mark as verified
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.isOnline = true;
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully!',
      token,
      user,
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User with this email not found.',
      });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(user.email, otp);

    return res.status(200).json({
      success: true,
      message: 'A fresh OTP has been sent to your email.',
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
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
      await sendOTPEmail(user.email, otp);

      return res.status(403).json({
        success: false,
        isUnverified: true,
        message: 'Your account is not verified yet. An OTP has been sent to your email.',
        email: user.email,
        devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
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
