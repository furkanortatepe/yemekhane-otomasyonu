const degerlendirmeRepository = require('../repositories/degerlendirmeRepository');
const { AppError } = require('../middleware/errorHandler');

async function getDegerlendirilebilirMenuler(kullaniciId) {
  return degerlendirmeRepository.getDegerlendirilebilirMenuler(kullaniciId);
}

async function getMenuDegerlendirmeleri(menuId) {
  return degerlendirmeRepository.getMenuDegerlendirmeleri(Number(menuId));
}

async function degerlendirmeEkle(kullaniciId, menuId, puan, yorum) {
  const mId = Number(menuId);
  const p = Number(puan);

  if (!mId || Number.isNaN(mId)) {
    throw new AppError('Geçerli bir menü seçilmelidir.', 400);
  }
  if (!Number.isInteger(p) || p < 1 || p > 5) {
    throw new AppError('Puan 1 ile 5 arasında tam sayı olmalıdır.', 400);
  }

  const kullanilmisMi = await degerlendirmeRepository.checkKullanilmisRezervasyon(kullaniciId, mId);
  if (!kullanilmisMi) {
    throw new AppError('Yalnızca kullandığınız (turnikeden geçilen) menüleri değerlendirebilirsiniz.', 400);
  }

  return degerlendirmeRepository.createDegerlendirme(kullaniciId, mId, p, yorum ? yorum.trim() : null);
}

module.exports = {
  getDegerlendirilebilirMenuler,
  getMenuDegerlendirmeleri,
  degerlendirmeEkle,
};
