const express = require('express');
const router = express.Router();
const profileController = require('../Controller/profileContoller');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../db_config/multer_config');

router.use(authMiddleware);

router.get('/user/:userId', profileController.getProfile);
router.put('/update', upload.single('profilePic'), profileController.updateProfile);
router.get('/search', profileController.searchUsers);

module.exports = router;
