const degerlendirmeService = require('../services/degerlendirmeService');

async function kullanilmisMenuler(req, res, next) {
  try {
    const veri = await degerlendirmeService.getDegerlendirilebilirMenuler(req.user.id);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function menuYorumlari(req, res, next) {
  try {
    const veri = await degerlendirmeService.getMenuDegerlendirmeleri(req.params.menuId);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function olustur(req, res, next) {
  try {
    const { menu_id, puan, yorum } = req.body;
    const veri = await degerlendirmeService.degerlendirmeEkle(req.user.id, menu_id, puan, yorum);
    res.status(201).json({
      basarili: true,
      mesaj: 'Değerlendirmeniz kaydedildi.',
      veri,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { kullanilmisMenuler, menuYorumlari, olustur };
