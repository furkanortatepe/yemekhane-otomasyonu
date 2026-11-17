const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/giris', authController.login);
router.post('/cikis', requireAuth, authController.logout);
router.get('/ben', requireAuth, authController.me);

module.exports = router;
