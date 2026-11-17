const express = require('express');
const yonetimController = require('../controllers/yonetimController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/rapor', yonetimController.rapor);
router.get('/yemekler', yonetimController.yemekler);
router.post('/menuler', yonetimController.menuOlustur);
router.put('/menuler/:id', yonetimController.menuGuncelle);
router.get('/aktif-rezervasyonlar', yonetimController.aktifRezervasyonlar);
router.post('/turnike-gecis', yonetimController.turnikeGecis);

module.exports = router;
