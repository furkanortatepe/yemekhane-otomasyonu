const express = require('express');
const bakiyeController = require('../controllers/bakiyeController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', bakiyeController.ozet);
router.post('/yukle', bakiyeController.yukle);

module.exports = router;
