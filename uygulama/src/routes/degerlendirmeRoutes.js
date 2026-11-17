const express = require('express');
const degerlendirmeController = require('../controllers/degerlendirmeController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/menu/:menuId', degerlendirmeController.menuYorumlari);
router.get('/kullanilmis', requireAuth, degerlendirmeController.kullanilmisMenuler);
router.post('/', requireAuth, degerlendirmeController.olustur);

module.exports = router;
