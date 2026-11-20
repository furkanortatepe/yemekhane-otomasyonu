const yonetimRepository = require('../repositories/yonetimRepository');
const menuRepository = require('../repositories/menuRepository');
const menuService = require('./menuService');
const { AppError } = require('../middleware/errorHandler');

async function getRapor(baslangic, bitis) {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const defaultBaslangic = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const defaultBitis = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const rows = await yonetimRepository.getYonetimRaporu(
    baslangic || defaultBaslangic,
    bitis || defaultBitis
  );

  return rows.map((r) => ({
    ...r,
    ogrenci_fiyati: Number(r.ogrenci_fiyati),
    personel_fiyati: Number(r.personel_fiyati),
    kapasite: Number(r.kapasite),
    dolu_yer: Number(r.dolu_yer),
    bos_yer: Number(r.bos_yer),
    doluluk_orani: Number(r.doluluk_orani),
    degerlendirme_sayisi: Number(r.degerlendirme_sayisi),
    ortalama_puan: Number(r.ortalama_puan),
    yemek_idleri: r.yemek_idleri ? r.yemek_idleri.split(',').map(Number) : [],
  }));
}

async function getYemekListesi() {
  return menuRepository.getYemekler();
}

async function menuOlustur(payload) {
  const { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idleri } = payload;

  if (!yemekhane_id || !tarih || !ogun_id) {
    throw new AppError('Yemekhane, tarih ve öğün alanları zorunludur.', 400);
  }
  if (Number(ogrenci_fiyati) < 0 || Number(personel_fiyati) < 0) {
    throw new AppError('Fiyatlar negatif olamaz.', 400);
  }
  if (!Array.isArray(yemek_idleri) || yemek_idleri.length === 0) {
    throw new AppError('Menüye en az bir yemek seçilmelidir.', 400);
  }

  const created = await yonetimRepository.createMenu({
    yemekhane_id: Number(yemekhane_id),
    tarih,
    ogun_id: Number(ogun_id),
    ogrenci_fiyati: Number(ogrenci_fiyati),
    personel_fiyati: Number(personel_fiyati),
    yemek_idleri: yemek_idleri.map(Number),
  });

  await menuService.invalidateMenuCache(Number(yemekhane_id), tarih, Number(ogun_id));
  return created;
}

async function menuGuncelle(menuId, payload) {
  const existing = await yonetimRepository.getMenuByIdFromPrimary(Number(menuId));
  if (!existing) {
    throw new AppError('Güncellenecek menü bulunamadı.', 404);
  }

  const ogrenciFiyati =
    payload.ogrenci_fiyati !== undefined ? Number(payload.ogrenci_fiyati) : Number(existing.ogrenci_fiyati);
  const personelFiyati =
    payload.personel_fiyati !== undefined ? Number(payload.personel_fiyati) : Number(existing.personel_fiyati);

  if (ogrenciFiyati < 0 || personelFiyati < 0) {
    throw new AppError('Fiyatlar negatif olamaz.', 400);
  }

  const updated = await yonetimRepository.updateMenu(Number(menuId), {
    ogrenci_fiyati: ogrenciFiyati,
    personel_fiyati: personelFiyati,
    yemek_idleri: payload.yemek_idleri,
  });

  // Yonetici menuyu degistirdiginde Redis onbellegi aninda gecersizlestirilir
  await menuService.invalidateMenuCache(
    existing.yemekhane_id,
    String(existing.tarih).slice(0, 10),
    existing.ogun_id
  );
  return updated;
}

async function getAktifRezervasyonlar() {
  return yonetimRepository.getAktifRezervasyonlarForTurnike();
}

module.exports = {
  getRapor,
  getYemekListesi,
  menuOlustur,
  menuGuncelle,
  getAktifRezervasyonlar,
};
