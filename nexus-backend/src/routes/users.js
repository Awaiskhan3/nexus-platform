const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, uploadUserAvatar,
  getEntrepreneurs, getInvestors, deactivateAccount,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// All user routes require auth
router.use(protect);

router.get('/entrepreneurs', getEntrepreneurs);
router.get('/investors', getInvestors);
router.get('/profile/:id', getProfile);
router.put('/profile', updateProfile);
router.post('/avatar', uploadUserAvatar);
router.delete('/account', deactivateAccount);

module.exports = router;
