const express = require('express');
const menuController = require('../controllers/menuController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/referanslar', menuController.referanslar);
router.get('/gunun-menusu', optionalAuth, menuController.gununMenusu);
router.get('/haftalik', optionalAuth, menuController.haftalikMenu);

module.exports = router;
