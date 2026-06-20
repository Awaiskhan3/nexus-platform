const express = require('express');
const router = express.Router();
const {
  scheduleMeeting, getMeetings, getMeeting,
  respondToMeeting, cancelMeeting, updateMeeting,
} = require('../controllers/meetingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', scheduleMeeting);
router.get('/', getMeetings);
router.get('/:id', getMeeting);
router.put('/:id', updateMeeting);
router.patch('/:id/respond', respondToMeeting);
router.patch('/:id/cancel', cancelMeeting);

module.exports = router;
