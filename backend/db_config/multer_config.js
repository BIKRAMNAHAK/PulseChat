const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Subfolders for profiles, chats, statuses
const dirs = ['profiles', 'chats', 'statuses'];
dirs.forEach((dir) => {
  const p = path.join(uploadsDir, dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'chats';
    if (req.baseUrl.includes('auth') || req.baseUrl.includes('profile')) {
      folder = 'profiles';
    } else if (req.baseUrl.includes('status')) {
      folder = 'statuses';
    }
    cb(null, path.join(uploadsDir, folder));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|webp|gif/;
  const allowedVideoTypes = /mp4|mov|webm|m4v/;
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const mime = file.mimetype;

  const isImage = allowedImageTypes.test(ext) && mime.startsWith('image/');
  const isVideo = allowedVideoTypes.test(ext) && mime.startsWith('video/');

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type! Only image and video files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit
  },
  fileFilter,
});

module.exports = upload;
