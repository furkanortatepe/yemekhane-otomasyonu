const { primaryPool, replicaPool } = require('../config/db');

async function callRezervasyonYap(kullaniciId, menuId, porsiyon = 'tam') {
  if (porsiyon === 'yarim') {
    const [resultSets] = await primaryPool.query(
      'CALL sp_rezervasyon_yap_porsiyonlu(?, ?, ?)',
      [kullaniciId, menuId, 'yarim']
    );
    return resultSets[0] ? resultSets[0][0] : null;
  }

  const [resultSets] = await primaryPool.query(
    'CALL sp_rezervasyon_yap(?, ?)',
    [kullaniciId, menuId]
  );
  return resultSets[0] ? resultSets[0][0] : null;
}

async function callRezervasyonIptal(kullaniciId, rezervasyonId) {
  const [resultSets] = await primaryPool.query(
    'CALL sp_rezervasyon_iptal(?, ?)',
    [kullaniciId, rezervasyonId]
  );
  return resultSets[0] ? resultSets[0][0] : null;
}

async function callTurnikeGecis(kullaniciId, yemekhaneId = 1, zaman = null) {
  const [resultSets] = await primaryPool.query(
    'CALL sp_turnike_gecis(?, ?, ?)',
    [kullaniciId, yemekhaneId, zaman]
  );
  return resultSets[0] ? resultSets[0][0] : null;
}

async function getKullaniciRezervasyonlari(kullaniciId) {
  const [rows] = await replicaPool.query(
    `SELECT
       r.id,
       r.menu_id,
       r.durum,
       COALESCE(r.porsiyon, 'tam') AS porsiyon,
       r.ucret AS odenen_tutar,
       r.olusturma AS olusturma_tarihi,
       m.tarih,
       m.yemekhane_id,
       yh.ad AS yemekhane_adi,
       m.ogun_id,
       o.ad AS ogun_adi,
       o.son_saat AS son_rezervasyon_saati,
       (r.durum = 'aktif' AND (m.tarih > CURDATE() OR (m.tarih = CURDATE() AND CURTIME() <= o.son_saat))) AS iptal_edilebilir,
       (SELECT d.id FROM degerlendirmeler d WHERE d.kullanici_id = r.kullanici_id AND d.menu_id = r.menu_id LIMIT 1) AS degerlendirme_id,
       (SELECT GROUP_CONCAT(y.ad ORDER BY yk.sira SEPARATOR ', ')
        FROM menu_yemekleri my
        JOIN yemekler y ON y.id = my.yemek_id
        JOIN yemek_kategorileri yk ON yk.id = y.kategori_id
        WHERE my.menu_id = r.menu_id) AS yemek_ozeti
     FROM rezervasyonlar r
     JOIN menuler m ON m.id = r.menu_id
     JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     JOIN ogunler o ON o.id = m.ogun_id
     WHERE r.kullanici_id = ?
     ORDER BY m.tarih DESC, m.ogun_id DESC`,
    [kullaniciId]
  );
  return rows;
}

module.exports = {
  callRezervasyonYap,
  callRezervasyonIptal,
  callTurnikeGecis,
  getKullaniciRezervasyonlari,
};
