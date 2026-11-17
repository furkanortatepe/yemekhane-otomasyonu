const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const bakiyeRepository = require('../repositories/bakiyeRepository');
const { AppError } = require('../middleware/errorHandler');

async function rezervasyonYap(kullaniciId, menuId, porsiyon = 'tam') {
  if (!menuId || Number.isNaN(Number(menuId))) {
    throw new AppError('Geçerli bir menü seçilmelidir.', 400);
  }

  const secilenPorsiyon = porsiyon === 'yarim' ? 'yarim' : 'tam';
  const sonuc = await rezervasyonRepository.callRezervasyonYap(
    kullaniciId,
    Number(menuId),
    secilenPorsiyon
  );
  // Rezervasyondan hemen sonra bakiye replikasyon gecikmesine takilmamak icin kaynaktan okunur
  const guncelBakiye = await bakiyeRepository.getBakiyeFromPrimary(kullaniciId);

  return {
    ...sonuc,
    guncel_bakiye: guncelBakiye ? Number(guncelBakiye.bakiye) : Number(sonuc.guncel_bakiye),
    bakiye_kaynagi: 'mysql-primary',
  };
}

async function rezervasyonIptal(kullaniciId, rezervasyonId) {
  if (!rezervasyonId || Number.isNaN(Number(rezervasyonId))) {
    throw new AppError('Geçerli bir rezervasyon seçilmelidir.', 400);
  }

  const sonuc = await rezervasyonRepository.callRezervasyonIptal(kullaniciId, Number(rezervasyonId));
  const guncelBakiye = await bakiyeRepository.getBakiyeFromPrimary(kullaniciId);

  return {
    ...sonuc,
    guncel_bakiye: guncelBakiye ? Number(guncelBakiye.bakiye) : Number(sonuc.guncel_bakiye),
    bakiye_kaynagi: 'mysql-primary',
  };
}

async function getRezervasyonlarim(kullaniciId) {
  const rows = await rezervasyonRepository.getKullaniciRezervasyonlari(kullaniciId);
  return rows.map((r) => ({
    ...r,
    odenen_tutar: Number(r.odenen_tutar),
    iptal_edilebilir: Boolean(r.iptal_edilebilir),
    degerlendirildi: Boolean(r.degerlendirme_id),
  }));
}

async function turnikeGecis(kullaniciId, menuId) {
  if (!kullaniciId || !menuId) {
    throw new AppError('Kullanıcı ve menü bilgisi zorunludur.', 400);
  }
  return rezervasyonRepository.callTurnikeGecis(Number(kullaniciId), Number(menuId));
}

module.exports = {
  rezervasyonYap,
  rezervasyonIptal,
  getRezervasyonlarim,
  turnikeGecis,
};
