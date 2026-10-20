const express = require('express');
const router = express.Router();
const groupController = require('../Controller/groupController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../db_config/multer_config');

router.use(authMiddleware);

router.post('/create', upload.single('groupPic'), groupController.createGroup);
router.get('/my-groups', groupController.getMyGroups);
router.get('/messages/:groupId', groupController.getGroupMessages);
router.post('/send', upload.single('media'), groupController.sendGroupMessage);
router.post('/leave', groupController.leaveGroup);

module.exports = router;
