const express = require('express');
const profilController = require('../controllers/profilController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/alerjenler', profilController.alerjenlerim);
router.put('/alerjenler', profilController.alerjenGuncelle);

module.exports = router;
