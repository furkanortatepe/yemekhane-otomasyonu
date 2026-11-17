const menuService = require('../services/menuService');

async function referanslar(req, res, next) {
  try {
    const veri = await menuService.getReferansVeriler();
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function gununMenusu(req, res, next) {
  try {
    const yemekhaneId = Number(req.query.yemekhane_id || 1);
    const ogunId = Number(req.query.ogun_id || 2);
    const tarih = req.query.tarih || menuService.getBugunStr();
    const veri = await menuService.getGununMenusu(yemekhaneId, tarih, ogunId, req.user);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function haftalikMenu(req, res, next) {
  try {
    const yemekhaneId = Number(req.query.yemekhane_id || 1);
    const baslangic = req.query.baslangic || menuService.getBugunStr();
    const veri = await menuService.getHaftalikMenu(yemekhaneId, baslangic, req.user);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

module.exports = { referanslar, gununMenusu, haftalikMenu };
