const rezervasyonService = require('../services/rezervasyonService');

async function listele(req, res, next) {
  try {
    const veri = await rezervasyonService.getRezervasyonlarim(req.user.id);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function olustur(req, res, next) {
  try {
    const { menu_id, porsiyon } = req.body;
    const veri = await rezervasyonService.rezervasyonYap(req.user.id, menu_id, porsiyon);
    res.status(201).json({
      basarili: true,
      mesaj: 'Rezervasyonunuz başarıyla oluşturuldu.',
      veri,
    });
  } catch (err) {
    next(err);
  }
}

async function iptalEt(req, res, next) {
  try {
    const veri = await rezervasyonService.rezervasyonIptal(req.user.id, req.params.id);
    res.json({
      basarili: true,
      mesaj: 'Rezervasyon iptal edildi ve ücret bakiyenize iade edildi.',
      veri,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listele, olustur, iptalEt };
