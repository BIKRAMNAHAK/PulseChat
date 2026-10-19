const jwt = require('jsonwebtoken');
const User = require('../Modal/RegisterModal');

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization token provided.',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secure_jwt_secret_key_mychat_2026_@#!'
    );

    const user = await User.findById(decoded.userId).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session. User no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      error: error.message,
    });
  }
};

module.exports = authMiddleware;
