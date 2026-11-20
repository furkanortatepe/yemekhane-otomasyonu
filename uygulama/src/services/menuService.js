const menuRepository = require('../repositories/menuRepository');
const profilRepository = require('../repositories/profilRepository');
const redis = require('../config/redis');

function getBugunStr() {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function secondsUntilEndOfDay() {
  const tzOffsetMs = 3 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + tzOffsetMs);
  const endOfDayIst = new Date(nowIst);
  endOfDayIst.setUTCHours(23, 59, 59, 999);
  const diffSec = Math.floor((endOfDayIst.getTime() - nowIst.getTime()) / 1000);
  return Math.max(diffSec, 60);
}

function menuCacheKey(yemekhaneId, tarih, ogunId) {
  return `menu:${yemekhaneId}:${tarih}:${ogunId}`;
}

async function invalidateMenuCache(yemekhaneId, tarih, ogunId) {
  const key = menuCacheKey(yemekhaneId, tarih, ogunId);
  const deleted = await redis.del(key);
  console.log(`[CACHE INVALIDATED] ${key} (silinen: ${deleted})`);
}

function formatMenuDetay(rows) {
  if (!rows || rows.length === 0) return null;

  const first = rows[0];
  const yemekler = rows
    .filter((r) => r.yemek_id !== null && r.yemek_id !== undefined)
    .map((r) => ({
      yemek_id: r.yemek_id,
      ad: r.yemek_adi || r.yemek,
      kalori: Number(r.kalori || 0),
      vejetaryen: Boolean(r.vejetaryen),
      kategori_id: r.kategori_id,
      kategori_adi: r.kategori_adi || r.kategori,
      kategori_sira: r.kategori_sira,
      alerjenler: r.alerjenler ? r.alerjenler.split(', ') : [],
      alerjen_idleri: (r.alerjen_idleri || r.alerjen_idler) ? String(r.alerjen_idleri || r.alerjen_idler).split(',').map(Number) : [],
    }));

  const toplamKalori = yemekler.reduce((sum, y) => sum + y.kalori, 0);

  return {
    menu_id: first.menu_id,
    yemekhane_id: first.yemekhane_id,
    yemekhane_adi: first.yemekhane_adi || first.yemekhane,
    kapasite: first.kapasite,
    tarih: first.tarih,
    ogun_id: first.ogun_id,
    ogun_adi: first.ogun_adi || first.ogun,
    son_rezervasyon_saati: first.son_rezervasyon_saati || first.son_saat,
    baslangic_saati: first.baslangic_saati || first.servis_baslangic,
    bitis_saati: first.bitis_saati || first.servis_bitis,
    yarim_porsiyon_uygun: Boolean(first.yarim_porsiyon_uygun),
    ogrenci_fiyati: Number(first.ogrenci_fiyati),
    personel_fiyati: Number(first.personel_fiyati),
    toplam_kalori: toplamKalori,
    yemekler,
  };
}

async function getReferansVeriler() {
  const [yemekhaneler, ogunler, alerjenler] = await Promise.all([
    menuRepository.getYemekhaneler(),
    menuRepository.getOgunler(),
    menuRepository.getAlerjenler(),
  ]);
  return { yemekhaneler, ogunler, alerjenler, bugun: getBugunStr() };
}

async function getGununMenusu(yemekhaneId, tarih, ogunId, user) {
  const targetTarih = tarih || getBugunStr();
  const cacheKey = menuCacheKey(yemekhaneId, targetTarih, ogunId);

  let menu = null;
  let kaynak = 'veritabani';

  const cached = await redis.get(cacheKey);
  if (cached) {
    menu = JSON.parse(cached);
    kaynak = 'redis';
    console.log(`[CACHE HIT - REDIS] ${cacheKey}`);
  } else {
    console.log(`[CACHE MISS - DB] ${cacheKey} -> mysql-replica okunuyor`);
    const rows = await menuRepository.getMenuDetayFromReplica(yemekhaneId, targetTarih, ogunId);
    menu = formatMenuDetay(rows);
    if (menu) {
      const ttl = secondsUntilEndOfDay();
      await redis.set(cacheKey, JSON.stringify(menu), 'EX', ttl);
      console.log(`[CACHE SET - REDIS] ${cacheKey} (TTL: ${ttl}s)`);
    }
  }

  if (!menu) return null;

  const [doluluk, kullaniciAlerjenleri] = await Promise.all([
    menuRepository.getMenuDolulukAndPuan(menu.menu_id),
    user ? profilRepository.getKullaniciAlerjenDetaylari(user.id) : Promise.resolve([]),
  ]);

  const kullaniciAlerjenMap = new Map(kullaniciAlerjenleri.map((a) => [Number(a.id), a.ad]));
  const yemeklerUyarili = menu.yemekler.map((y) => {
    const eslesen = (y.alerjen_idleri || [])
      .filter((id) => kullaniciAlerjenMap.has(id))
      .map((id) => kullaniciAlerjenMap.get(id));
    return {
      ...y,
      alerjen_uyarisi: eslesen.length > 0,
      eslesen_alerjenler: eslesen,
    };
  });

  const uyariVerenSayisi = yemeklerUyarili.filter((y) => y.alerjen_uyarisi).length;
  const kullaniciFiyati =
    user && user.rol === 'ogrenci' ? menu.ogrenci_fiyati : menu.personel_fiyati;
  const yarimUygun = Boolean(menu.yarim_porsiyon_uygun);

  return {
    ...menu,
    yemekler: yemeklerUyarili,
    uyari_veren_yemek_sayisi: uyariVerenSayisi,
    kullanici_alerjenleri: kullaniciAlerjenleri.map((a) => a.ad),
    kaynak,
    kullanici_fiyati: kullaniciFiyati,
    yarim_porsiyon_uygun: yarimUygun,
    yarim_porsiyon_fiyati: yarimUygun ? Number((kullaniciFiyati * 0.6).toFixed(2)) : null,
    dolu_yer: doluluk ? Number(doluluk.dolu_yer) : 0,
    bos_yer: doluluk ? Number(doluluk.bos_yer) : menu.kapasite,
    doluluk_orani: doluluk ? Number(doluluk.doluluk_orani) : 0,
    degerlendirme_sayisi: doluluk ? Number(doluluk.degerlendirme_sayisi) : 0,
    ortalama_puan: doluluk ? Number(doluluk.ortalama_puan) : 0,
    rezervasyon_acik: doluluk ? Boolean(doluluk.rezervasyon_acik) : false,
  };
}

async function getHaftalikMenu(yemekhaneId, baslangicTarihi, user) {
  const start = baslangicTarihi || getBugunStr();
  const rows = await menuRepository.getHaftalikMenuler(
    yemekhaneId,
    start,
    7,
    user ? user.id : 0
  );

  return rows.map((r) => {
    const fiyat =
      user && user.rol === 'ogrenci' ? Number(r.ogrenci_fiyati) : Number(r.personel_fiyati);
    const yarimUygun = Boolean(r.yarim_porsiyon_uygun);
    const zatenAktif =
      r.kullanici_rezervasyon_durumu === 'aktif' ||
      r.kullanici_rezervasyon_durumu === 'kullanildi';
    const butonAktif = Boolean(r.rezervasyon_acik) && Number(r.bos_yer) > 0 && !zatenAktif;

    return {
      menu_id: r.menu_id,
      yemekhane_id: r.yemekhane_id,
      yemekhane_adi: r.yemekhane_adi,
      tarih: r.tarih,
      ogun_id: r.ogun_id,
      ogun_adi: r.ogun_adi,
      son_rezervasyon_saati: r.son_rezervasyon_saati,
      yarim_porsiyon_uygun: yarimUygun,
      ogrenci_fiyati: Number(r.ogrenci_fiyati),
      personel_fiyati: Number(r.personel_fiyati),
      kullanici_fiyati: fiyat,
      yarim_porsiyon_fiyati: yarimUygun ? Number((fiyat * 0.6).toFixed(2)) : null,
      kapasite: Number(r.kapasite),
      dolu_yer: Number(r.dolu_yer),
      bos_yer: Number(r.bos_yer),
      doluluk_orani: Number(r.doluluk_orani),
      degerlendirme_sayisi: Number(r.degerlendirme_sayisi),
      ortalama_puan: Number(r.ortalama_puan),
      rezervasyon_acik: Boolean(r.rezervasyon_acik),
      rezervasyon_yapilabilir: butonAktif,
      kullanici_rezervasyon_id: r.kullanici_rezervasyon_id,
      kullanici_rezervasyon_durumu: r.kullanici_rezervasyon_durumu,
      kullanici_rezervasyon_porsiyon: r.kullanici_rezervasyon_porsiyon || null,
      yemek_ozeti: r.yemek_ozeti || '',
      toplam_kalori: Number(r.toplam_kalori || 0),
    };
  });
}

module.exports = {
  getBugunStr,
  menuCacheKey,
  invalidateMenuCache,
  getReferansVeriler,
  getGununMenusu,
  getHaftalikMenu,
};
