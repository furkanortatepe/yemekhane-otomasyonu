const { primaryPool, replicaPool } = require('../config/db');

async function getDegerlendirilebilirMenuler(kullaniciId) {
  const [rows] = await replicaPool.query(
    `SELECT
       r.id AS rezervasyon_id,
       r.menu_id,
       m.tarih,
       yh.ad AS yemekhane_adi,
       o.ad AS ogun_adi,
       d.id AS degerlendirme_id,
       d.puan,
       d.yorum,
       d.olusturma AS degerlendirme_tarihi,
       (SELECT GROUP_CONCAT(y.ad ORDER BY yk.sira SEPARATOR ', ')
        FROM menu_yemekleri my
        JOIN yemekler y ON y.id = my.yemek_id
        JOIN yemek_kategorileri yk ON yk.id = y.kategori_id
        WHERE my.menu_id = r.menu_id) AS yemek_ozeti
     FROM rezervasyonlar r
     JOIN menuler m ON m.id = r.menu_id
     JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     JOIN ogunler o ON o.id = m.ogun_id
     LEFT JOIN degerlendirmeler d ON d.kullanici_id = r.kullanici_id AND d.menu_id = r.menu_id
     WHERE r.kullanici_id = ? AND r.durum = 'kullanildi'
     ORDER BY m.tarih DESC, m.ogun_id DESC`,
    [kullaniciId]
  );
  return rows;
}

async function getMenuDegerlendirmeleri(menuId) {
  const [rows] = await replicaPool.query(
    `SELECT d.id, d.puan, d.yorum, d.olusturma AS olusturma_tarihi, CONCAT(k.ad, ' ', k.soyad) AS ad_soyad
     FROM degerlendirmeler d
     JOIN kullanicilar k ON k.id = d.kullanici_id
     WHERE d.menu_id = ?
     ORDER BY d.olusturma DESC`,
    [menuId]
  );
  return rows;
}

async function checkKullanilmisRezervasyon(kullaniciId, menuId) {
  const [rows] = await primaryPool.query(
    `SELECT id FROM rezervasyonlar
     WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi'
     LIMIT 1`,
    [kullaniciId, menuId]
  );
  return rows.length > 0;
}

async function createDegerlendirme(kullaniciId, menuId, puan, yorum) {
  const [result] = await primaryPool.query(
    `INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum)
     VALUES (?, ?, ?, ?)`,
    [kullaniciId, menuId, puan, yorum || null]
  );
  return { id: result.insertId, kullanici_id: kullaniciId, menu_id: menuId, puan, yorum };
}

module.exports = {
  getDegerlendirilebilirMenuler,
  getMenuDegerlendirmeleri,
  checkKullanilmisRezervasyon,
  createDegerlendirme,
};
