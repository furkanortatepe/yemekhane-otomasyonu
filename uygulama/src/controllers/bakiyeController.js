const bakiyeService = require('../services/bakiyeService');

async function ozet(req, res, next) {
  try {
    const veri = await bakiyeService.getBakiyeOzeti(req.user.id);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function yukle(req, res, next) {
  try {
    const { tutar, aciklama } = req.body;
    const veri = await bakiyeService.bakiyeYukle(req.user.id, tutar, aciklama);
    res.json({
      basarili: true,
      mesaj: `${Number(tutar).toFixed(2)} TL bakiyenize yüklendi.`,
      veri,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { ozet, yukle };
