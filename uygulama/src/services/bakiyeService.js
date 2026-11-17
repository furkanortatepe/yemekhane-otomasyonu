const bakiyeRepository = require('../repositories/bakiyeRepository');
const { AppError } = require('../middleware/errorHandler');

async function getBakiyeOzeti(kullaniciId) {
  // Guncel bakiye tutarlilik icin kaynaktan, gecmis hareket listesi replikadan okunur
  const [kullanici, hareketler] = await Promise.all([
    bakiyeRepository.getBakiyeFromPrimary(kullaniciId),
    bakiyeRepository.getBakiyeHareketleriFromReplica(kullaniciId, 50),
  ]);

  if (!kullanici) {
    throw new AppError('Kullanıcı bulunamadı.', 404);
  }

  return {
    bakiye: Number(kullanici.bakiye),
    bakiye_kaynagi: 'mysql-primary',
    hareketler_kaynagi: 'mysql-replica',
    hareketler: hareketler.map((h) => ({
      ...h,
      tutar: Number(h.tutar),
    })),
  };
}

async function bakiyeYukle(kullaniciId, tutar, aciklama) {
  const numericTutar = Number(tutar);
  if (Number.isNaN(numericTutar)) {
    throw new AppError('Geçerli bir tutar giriniz.', 400);
  }

  const sonuc = await bakiyeRepository.callBakiyeYukle(kullaniciId, numericTutar, aciklama);
  const guncel = await bakiyeRepository.getBakiyeFromPrimary(kullaniciId);

  return {
    bakiye: guncel ? Number(guncel.bakiye) : Number(sonuc.bakiye),
    yuklenen_tutar: numericTutar,
    bakiye_kaynagi: 'mysql-primary',
  };
}

module.exports = {
  getBakiyeOzeti,
  bakiyeYukle,
};
