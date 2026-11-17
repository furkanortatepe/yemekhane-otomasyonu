const { replicaPool } = require('../config/db');

async function getYemekhaneler() {
  const [rows] = await replicaPool.query(
    'SELECT id, ad, konum, kapasite FROM yemekhaneler ORDER BY id'
  );
  return rows;
}

async function getOgunler() {
  const [rows] = await replicaPool.query(
    `SELECT id, ad, son_saat AS son_rezervasyon_saati,
            servis_baslangic AS baslangic_saati,
            servis_bitis AS bitis_saati,
            COALESCE(yarim_porsiyon_uygun, 1) AS yarim_porsiyon_uygun
     FROM ogunler ORDER BY sira, id`
  );
  return rows;
}

async function getYemekler() {
  const [rows] = await replicaPool.query(
    `SELECT y.id, y.ad, y.kalori, y.vejetaryen, y.kategori_id, yk.ad AS kategori_adi, yk.sira AS sira_no
     FROM yemekler y
     JOIN yemek_kategorileri yk ON yk.id = y.kategori_id
     ORDER BY yk.sira, y.ad`
  );
  return rows;
}

async function getAlerjenler() {
  const [rows] = await replicaPool.query(
    'SELECT id, ad FROM alerjenler ORDER BY id'
  );
  return rows;
}

async function getMenuDetayFromReplica(yemekhaneId, tarih, ogunId) {
  const [rows] = await replicaPool.query(
    `SELECT *
     FROM v_menu_detay
     WHERE yemekhane_id = ? AND tarih = ? AND ogun_id = ?
     ORDER BY kategori_sira ASC, yemek ASC`,
    [yemekhaneId, tarih, ogunId]
  );
  return rows;
}

async function getMenuDolulukAndPuan(menuId) {
  const [rows] = await replicaPool.query(
    `SELECT d.menu_id, d.kapasite, d.dolu_yer, d.bos_yer, d.doluluk_orani,
            COALESCE(p.oy_sayisi, 0) AS degerlendirme_sayisi,
            COALESCE(p.ortalama_puan, 0) AS ortalama_puan,
            (d.tarih > CURDATE() OR (d.tarih = CURDATE() AND CURTIME() <= d.son_rezervasyon_saati)) AS rezervasyon_acik
     FROM v_menu_doluluk d
     LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
     WHERE d.menu_id = ?`,
    [menuId]
  );
  return rows[0] || null;
}

async function getHaftalikMenuler(yemekhaneId, baslangicTarihi, gunSayisi, kullaniciId) {
  const [rows] = await replicaPool.query(
    `SELECT
       d.menu_id,
       d.yemekhane_id,
       d.yemekhane_adi,
       d.tarih,
       d.ogun_id,
       d.ogun_adi,
       d.son_rezervasyon_saati,
       COALESCE(o.yarim_porsiyon_uygun, 1) AS yarim_porsiyon_uygun,
       m.ogrenci_fiyati,
       m.personel_fiyati,
       d.kapasite,
       d.dolu_yer,
       d.bos_yer,
       d.doluluk_orani,
       COALESCE(p.oy_sayisi, 0) AS degerlendirme_sayisi,
       COALESCE(p.ortalama_puan, 0) AS ortalama_puan,
       (d.tarih > CURDATE() OR (d.tarih = CURDATE() AND CURTIME() <= d.son_rezervasyon_saati)) AS rezervasyon_acik,
       r.id AS kullanici_rezervasyon_id,
       r.durum AS kullanici_rezervasyon_durumu,
       COALESCE(r.porsiyon, 'tam') AS kullanici_rezervasyon_porsiyon,
       (SELECT GROUP_CONCAT(y.ad ORDER BY yk.sira SEPARATOR ' • ')
        FROM menu_yemekleri my
        JOIN yemekler y ON y.id = my.yemek_id
        JOIN yemek_kategorileri yk ON yk.id = y.kategori_id
        WHERE my.menu_id = d.menu_id) AS yemek_ozeti,
       (SELECT COALESCE(SUM(y.kalori), 0)
        FROM menu_yemekleri my
        JOIN yemekler y ON y.id = my.yemek_id
        WHERE my.menu_id = d.menu_id) AS toplam_kalori
     FROM v_menu_doluluk d
     JOIN menuler m ON m.id = d.menu_id
     JOIN ogunler o ON o.id = m.ogun_id
     LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
     LEFT JOIN rezervasyonlar r ON r.menu_id = d.menu_id AND r.kullanici_id = ?
     WHERE d.yemekhane_id = ?
       AND d.tarih BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
     ORDER BY d.tarih ASC, d.ogun_id ASC`,
    [kullaniciId || 0, yemekhaneId, baslangicTarihi, baslangicTarihi, gunSayisi - 1]
  );
  return rows;
}

module.exports = {
  getYemekhaneler,
  getOgunler,
  getYemekler,
  getAlerjenler,
  getMenuDetayFromReplica,
  getMenuDolulukAndPuan,
  getHaftalikMenuler,
};
