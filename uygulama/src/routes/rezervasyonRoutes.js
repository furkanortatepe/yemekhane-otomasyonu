const express = require('express');
const rezervasyonController = require('../controllers/rezervasyonController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', rezervasyonController.listele);
router.post('/', rezervasyonController.olustur);
router.post('/:id/iptal', rezervasyonController.iptalEt);

module.exports = router;
