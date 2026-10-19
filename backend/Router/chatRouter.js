const express = require('express');
const router = express.Router();
const chatController = require('../Controller/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../db_config/multer_config');

router.use(authMiddleware);

router.get('/messages/:recipientId', chatController.getMessages);
router.get('/call-history', chatController.getCallHistory);
router.post('/send', upload.single('media'), chatController.sendMessage);
router.post('/seen', chatController.markAsSeen);

module.exports = router;
