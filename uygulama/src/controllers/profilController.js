const profilService = require('../services/profilService');

async function alerjenlerim(req, res, next) {
  try {
    const veri = await profilService.getProfilAlerjenleri(req.user.id);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function alerjenGuncelle(req, res, next) {
  try {
    const { alerjen_idleri } = req.body;
    const veri = await profilService.guncelleProfilAlerjenleri(req.user.id, alerjen_idleri);
    res.json({
      basarili: true,
      mesaj: 'Alerjen tercihleriniz güncellendi.',
      veri,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { alerjenlerim, alerjenGuncelle };
