const { primaryPool, replicaPool } = require('../config/db');

async function getYonetimRaporu(baslangicTarihi, bitisTarihi) {
  const [rows] = await replicaPool.query(
    `SELECT
       d.menu_id,
       d.yemekhane_id,
       d.yemekhane_adi,
       d.tarih,
       d.ogun_id,
       d.ogun_adi,
       m.ogrenci_fiyati,
       m.personel_fiyati,
       d.kapasite,
       d.dolu_yer,
       d.bos_yer,
       d.doluluk_orani,
       COALESCE(p.oy_sayisi, 0) AS degerlendirme_sayisi,
       COALESCE(p.ortalama_puan, 0) AS ortalama_puan,
       (SELECT GROUP_CONCAT(my.yemek_id ORDER BY my.yemek_id)
        FROM menu_yemekleri my WHERE my.menu_id = d.menu_id) AS yemek_idleri,
       (SELECT GROUP_CONCAT(y.ad ORDER BY yk.sira SEPARATOR ', ')
        FROM menu_yemekleri my
        JOIN yemekler y ON y.id = my.yemek_id
        JOIN yemek_kategorileri yk ON yk.id = y.kategori_id
        WHERE my.menu_id = d.menu_id) AS yemek_ozeti
     FROM v_menu_doluluk d
     JOIN menuler m ON m.id = d.menu_id
     LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
     WHERE d.tarih BETWEEN ? AND ?
     ORDER BY d.tarih DESC, d.yemekhane_id ASC, d.ogun_id ASC`,
    [baslangicTarihi, bitisTarihi]
  );
  return rows;
}

async function getMenuByIdFromPrimary(menuId) {
  const [rows] = await primaryPool.query(
    'SELECT id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati FROM menuler WHERE id = ?',
    [menuId]
  );
  return rows[0] || null;
}

async function createMenu({ yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idleri }) {
  const conn = await primaryPool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query(
      `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
       VALUES (?, ?, ?, ?, ?)`,
      [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati]
    );
    const menuId = res.insertId;
    if (Array.isArray(yemek_idleri) && yemek_idleri.length > 0) {
      const values = yemek_idleri.map((yId) => [menuId, Number(yId)]);
      await conn.query('INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?', [values]);
    }
    await conn.commit();
    return { id: menuId, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idleri };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateMenu(menuId, { ogrenci_fiyati, personel_fiyati, yemek_idleri }) {
  const conn = await primaryPool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE menuler SET ogrenci_fiyati = ?, personel_fiyati = ? WHERE id = ?',
      [ogrenci_fiyati, personel_fiyati, menuId]
    );
    if (Array.isArray(yemek_idleri)) {
      await conn.query('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
      if (yemek_idleri.length > 0) {
        const values = yemek_idleri.map((yId) => [menuId, Number(yId)]);
        await conn.query('INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?', [values]);
      }
    }
    const [rows] = await conn.query(
      'SELECT id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati FROM menuler WHERE id = ?',
      [menuId]
    );
    await conn.commit();
    return rows[0] || null;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getAktifRezervasyonlarForTurnike() {
  const [rows] = await replicaPool.query(
    `SELECT r.id, r.kullanici_id, CONCAT(k.ad, ' ', k.soyad) AS ad_soyad, k.eposta, r.menu_id, m.tarih, yh.ad AS yemekhane_adi, o.ad AS ogun_adi
     FROM rezervasyonlar r
     JOIN kullanicilar k ON k.id = r.kullanici_id
     JOIN menuler m ON m.id = r.menu_id
     JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     JOIN ogunler o ON o.id = m.ogun_id
     WHERE r.durum = 'aktif'
     ORDER BY m.tarih ASC, r.id DESC
     LIMIT 30`
  );
  return rows;
}

module.exports = {
  getYonetimRaporu,
  getMenuByIdFromPrimary,
  createMenu,
  updateMenu,
  getAktifRezervasyonlarForTurnike,
};
