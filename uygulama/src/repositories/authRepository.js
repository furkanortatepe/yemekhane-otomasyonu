const { primaryPool, replicaPool } = require('../config/db');

async function findByEmail(eposta) {
  const [rows] = await replicaPool.query(
    `SELECT id, ad, soyad, CONCAT(ad, ' ', soyad) AS ad_soyad, eposta, sifre_hash, rol, ogrenci_no, bakiye, aktif
     FROM kullanicilar
     WHERE eposta = ?
     LIMIT 1`,
    [eposta]
  );
  return rows[0] || null;
}

async function findByIdFromPrimary(id) {
  const [rows] = await primaryPool.query(
    `SELECT id, ad, soyad, CONCAT(ad, ' ', soyad) AS ad_soyad, eposta, rol, ogrenci_no, bakiye, aktif
     FROM kullanicilar
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findByIdFromReplica(id) {
  const [rows] = await replicaPool.query(
    `SELECT id, ad, soyad, CONCAT(ad, ' ', soyad) AS ad_soyad, eposta, rol, ogrenci_no, bakiye, aktif
     FROM kullanicilar
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  findByEmail,
  findByIdFromPrimary,
  findByIdFromReplica,
};
