const { primaryPool, replicaPool } = require('../config/db');

// Rezervasyondan veya yuklemeden hemen sonra anlik tutarli bakiye icin kaynaktan okuma
async function getBakiyeFromPrimary(kullaniciId) {
  const [rows] = await primaryPool.query(
    `SELECT id, CONCAT(ad, ' ', soyad) AS ad_soyad, bakiye FROM kullanicilar WHERE id = ?`,
    [kullaniciId]
  );
  return rows[0] || null;
}

// Normal bakiye hareket listesi replikadan okunur
async function getBakiyeHareketleriFromReplica(kullaniciId, limit = 50) {
  const [rows] = await replicaPool.query(
    `SELECT id, tur AS tip, tutar, rezervasyon_id, aciklama, olusturma AS olusturma_tarihi
     FROM bakiye_hareketleri
     WHERE kullanici_id = ?
     ORDER BY id DESC
     LIMIT ?`,
    [kullaniciId, Number(limit)]
  );
  return rows;
}

async function callBakiyeYukle(kullaniciId, tutar, _aciklama) {
  const [resultSets] = await primaryPool.query(
    'CALL sp_bakiye_yukle(?, ?)',
    [kullaniciId, tutar]
  );
  return resultSets[0] ? resultSets[0][0] : null;
}

module.exports = {
  getBakiyeFromPrimary,
  getBakiyeHareketleriFromReplica,
  callBakiyeYukle,
};
