const express = require('express');
const router = express.Router();
const { sendRequest, getRequests, respondToRequest, withdrawRequest } = require('../controllers/collaborationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', sendRequest);
router.get('/', getRequests);
router.patch('/:id/respond', respondToRequest);
router.delete('/:id', withdrawRequest);

module.exports = router;
