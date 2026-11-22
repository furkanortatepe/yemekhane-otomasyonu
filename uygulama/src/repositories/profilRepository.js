const { primaryPool, replicaPool } = require('../config/db');

async function getTumAlerjenler() {
  const [rows] = await replicaPool.query('SELECT id, ad FROM alerjenler ORDER BY id');
  return rows;
}

async function getKullaniciAlerjenIdleri(kullaniciId) {
  const [rows] = await replicaPool.query(
    'SELECT alerjen_id FROM kullanici_alerjenleri WHERE kullanici_id = ? ORDER BY alerjen_id',
    [kullaniciId]
  );
  return rows.map((r) => Number(r.alerjen_id));
}

async function getKullaniciAlerjenDetaylari(kullaniciId, fromPrimary = false) {
  const pool = fromPrimary ? primaryPool : replicaPool;
  const [rows] = await pool.query(
    `SELECT a.id, a.ad
     FROM kullanici_alerjenleri ka
     JOIN alerjenler a ON a.id = ka.alerjen_id
     WHERE ka.kullanici_id = ?
     ORDER BY a.id`,
    [kullaniciId]
  );
  return rows;
}

async function setKullaniciAlerjenleri(kullaniciId, alerjenIdleri) {
  const conn = await primaryPool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?', [kullaniciId]);
    if (Array.isArray(alerjenIdleri) && alerjenIdleri.length > 0) {
      const uniqueIds = [...new Set(alerjenIdleri.map(Number).filter((n) => n > 0))];
      if (uniqueIds.length > 0) {
        const values = uniqueIds.map((aId) => [kullaniciId, aId]);
        await conn.query(
          'INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES ?',
          [values]
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getTumAlerjenler,
  getKullaniciAlerjenIdleri,
  getKullaniciAlerjenDetaylari,
  setKullaniciAlerjenleri,
};
