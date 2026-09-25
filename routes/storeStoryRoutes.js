const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
  followStore,
  unfollowStore,
  rateStore
} = require('../controllers/storeStoryController');

router.post('/follows', verifyToken, followStore);
router.delete('/follows', verifyToken, unfollowStore);
router.post('/ratings', verifyToken, rateStore);

module.exports = router;