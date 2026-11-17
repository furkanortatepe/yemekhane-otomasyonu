const yonetimService = require('../services/yonetimService');
const rezervasyonService = require('../services/rezervasyonService');

async function rapor(req, res, next) {
  try {
    const { baslangic, bitis } = req.query;
    const veri = await yonetimService.getRapor(baslangic, bitis);
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function yemekler(req, res, next) {
  try {
    const veri = await yonetimService.getYemekListesi();
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function menuOlustur(req, res, next) {
  try {
    const veri = await yonetimService.menuOlustur(req.body);
    res.status(201).json({ basarili: true, mesaj: 'Yeni menü oluşturuldu.', veri });
  } catch (err) {
    next(err);
  }
}

async function menuGuncelle(req, res, next) {
  try {
    const veri = await yonetimService.menuGuncelle(req.params.id, req.body);
    res.json({ basarili: true, mesaj: 'Menü başarıyla güncellendi.', veri });
  } catch (err) {
    next(err);
  }
}

async function aktifRezervasyonlar(req, res, next) {
  try {
    const veri = await yonetimService.getAktifRezervasyonlar();
    res.json({ basarili: true, veri });
  } catch (err) {
    next(err);
  }
}

async function turnikeGecis(req, res, next) {
  try {
    const { kullanici_id, menu_id } = req.body;
    const veri = await rezervasyonService.turnikeGecis(kullanici_id, menu_id);
    res.json({ basarili: true, mesaj: 'Turnike geçişi onaylandı.', veri });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  rapor,
  yemekler,
  menuOlustur,
  menuGuncelle,
  aktifRezervasyonlar,
  turnikeGecis,
};
