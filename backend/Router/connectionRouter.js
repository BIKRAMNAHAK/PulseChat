const express = require('express');
const router = express.Router();
const connectionController = require('../Controller/connenctonReq');
const authMiddleware = require('../middleware/authMiddleware');

// All connection routes require authentication
router.use(authMiddleware);

router.get('/suggestions', connectionController.getSuggestions);
router.post('/send-request', connectionController.sendRequest);
router.get('/requests', connectionController.getRequests);
router.post('/accept-request', connectionController.acceptRequest);
router.post('/reject-request', connectionController.rejectRequest);
router.post('/unfollow', connectionController.unfollowUser);
router.get('/friends', connectionController.getFriendsList);

module.exports = router;
