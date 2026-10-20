const express = require('express');
const router = express.Router();
const statusController = require('../Controller/statusController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../db_config/multer_config');

router.use(authMiddleware);

router.post('/upload', upload.single('media'), statusController.createStatus);
router.get('/all', statusController.getStatuses);
router.post('/view/:statusId', statusController.viewStatus);
router.delete('/:statusId', statusController.deleteStatus);

module.exports = router;
