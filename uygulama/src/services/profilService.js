const profilRepository = require('../repositories/profilRepository');
const { AppError } = require('../middleware/errorHandler');

async function getProfilAlerjenleri(kullaniciId) {
  const [tumAlerjenler, seciliIdler] = await Promise.all([
    profilRepository.getTumAlerjenler(),
    profilRepository.getKullaniciAlerjenIdleri(kullaniciId),
  ]);
  return {
    tum_alerjenler: tumAlerjenler,
    secili_alerjen_idleri: seciliIdler,
  };
}

async function guncelleProfilAlerjenleri(kullaniciId, alerjenIdleri) {
  if (!Array.isArray(alerjenIdleri)) {
    throw new AppError('Alerjen listesi dizi formatında olmalıdır.', 400);
  }
  await profilRepository.setKullaniciAlerjenleri(kullaniciId, alerjenIdleri);
  const guncel = await profilRepository.getKullaniciAlerjenDetaylari(kullaniciId, true);
  return {
    secili_alerjenler: guncel,
    secili_alerjen_idleri: guncel.map((a) => a.id),
  };
}

module.exports = {
  getProfilAlerjenleri,
  guncelleProfilAlerjenleri,
};
