const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, deleteMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/conversations', getConversations);
router.get('/:userId', getMessages);
router.post('/:userId', sendMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;
