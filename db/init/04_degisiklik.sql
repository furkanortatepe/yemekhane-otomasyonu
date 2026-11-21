-- ============================================================================
-- Yemekhane Otomasyonu · Aşama 4 Değişiklik Talepleri (Migration)
-- 1. Yarım Porsiyon Desteği:
--    - ogunler tablosuna yarim_porsiyon_uygun (TINYINT(1)) eklenir (Öğle ve Akşam 1, Kahvaltı 0)
--    - rezervasyonlar tablosuna porsiyon ENUM('tam', 'yarim') DEFAULT 'tam' eklenir
-- 2. Alerjen Uyarısı:
--    - kullanici_alerjenleri tablosu eklenir (kullanici_id, alerjen_id)
-- 3. View Güncellemeleri:
--    - v_menu_detay ve v_menu_doluluk görünümleri güncellenir
-- 4. Stored Procedure Güncellemesi:
--    - sp_rezervasyon_yap ve sp_rezervasyon_yap_porsiyonlu (%60 ücret) yordamları
-- ============================================================================
SET NAMES utf8mb4;
USE yemekhane;

-- 1. ogunler: yarim_porsiyon_uygun
SET @col_ogun := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ogunler' AND COLUMN_NAME = 'yarim_porsiyon_uygun');
SET @sql_ogun := IF(@col_ogun = 0, 'ALTER TABLE ogunler ADD COLUMN yarim_porsiyon_uygun TINYINT(1) NOT NULL DEFAULT 1 AFTER servis_bitis', 'SELECT 1');
PREPARE stmt_ogun FROM @sql_ogun;
EXECUTE stmt_ogun;
DEALLOCATE PREPARE stmt_ogun;

UPDATE ogunler SET yarim_porsiyon_uygun = 0 WHERE id = 1 OR ad = 'Kahvaltı';
UPDATE ogunler SET yarim_porsiyon_uygun = 1 WHERE id IN (2, 3) OR ad IN ('Öğle', 'Akşam');

-- 2. rezervasyonlar: porsiyon
SET @col_rez := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rezervasyonlar' AND COLUMN_NAME = 'porsiyon');
SET @sql_rez := IF(@col_rez = 0, "ALTER TABLE rezervasyonlar ADD COLUMN porsiyon ENUM('tam', 'yarim') NOT NULL DEFAULT 'tam' AFTER durum", 'SELECT 1');
PREPARE stmt_rez FROM @sql_rez;
EXECUTE stmt_rez;
DEALLOCATE PREPARE stmt_rez;

-- 3. kullanici_alerjenleri tablosu
CREATE TABLE IF NOT EXISTS kullanici_alerjenleri (
    kullanici_id INT UNSIGNED NOT NULL,
    alerjen_id   TINYINT UNSIGNED NOT NULL,
    olusturma    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kullanici_id, alerjen_id),
    CONSTRAINT fk_ka_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id) ON DELETE CASCADE,
    CONSTRAINT fk_ka_alerjen   FOREIGN KEY (alerjen_id)   REFERENCES alerjenler (id)   ON DELETE CASCADE
) ENGINE=InnoDB;

-- Örnek kullanıcı alerjenleri
INSERT IGNORE INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES
  (6, 1), (6, 7),   -- Ayşe Demir: Gluten, Süt
  (7, 3);           -- Mehmet Yıldız: Yumurta

-- 4. View'ları güncelle (hem eski hem yeni sözleşmelerle tam uyumlu)
CREATE OR REPLACE VIEW v_menu_detay AS
SELECT
    m.id                AS menu_id,
    m.tarih,
    m.yemekhane_id,
    yh.ad               AS yemekhane,
    yh.ad               AS yemekhane_adi,
    yh.kapasite,
    m.ogun_id,
    o.ad                AS ogun,
    o.ad                AS ogun_adi,
    o.sira              AS ogun_sira,
    o.son_saat,
    o.servis_baslangic,
    o.servis_bitis,
    o.servis_baslangic  AS baslangic_saati,
    o.servis_bitis      AS bitis_saati,
    o.son_saat          AS son_rezervasyon_saati,
    o.yarim_porsiyon_uygun,
    TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son,
    m.ogrenci_fiyati,
    m.personel_fiyati,
    y.id                AS yemek_id,
    y.ad                AS yemek,
    y.ad                AS yemek_adi,
    k.id                AS kategori_id,
    k.ad                AS kategori,
    k.ad                AS kategori_adi,
    k.sira              AS kategori_sira,
    y.kalori,
    y.vejetaryen,
    (SELECT GROUP_CONCAT(a.ad ORDER BY a.ad SEPARATOR ', ')
       FROM yemek_alerjenleri ya JOIN alerjenler a ON a.id = ya.alerjen_id
      WHERE ya.yemek_id = y.id)                     AS alerjenler,
    (SELECT GROUP_CONCAT(ya.alerjen_id ORDER BY ya.alerjen_id)
       FROM yemek_alerjenleri ya
      WHERE ya.yemek_id = y.id)                     AS alerjen_idler,
    (SELECT GROUP_CONCAT(ya.alerjen_id ORDER BY ya.alerjen_id)
       FROM yemek_alerjenleri ya
      WHERE ya.yemek_id = y.id)                     AS alerjen_idleri
FROM menuler m
JOIN yemekhaneler       yh ON yh.id = m.yemekhane_id
JOIN ogunler            o  ON o.id  = m.ogun_id
JOIN menu_yemekleri     my ON my.menu_id = m.id
JOIN yemekler           y  ON y.id  = my.yemek_id
JOIN yemek_kategorileri k  ON k.id  = y.kategori_id;

CREATE OR REPLACE VIEW v_menu_doluluk AS
SELECT
    m.id            AS menu_id,
    m.tarih,
    m.yemekhane_id,
    yh.ad           AS yemekhane,
    yh.ad           AS yemekhane_adi,
    m.ogun_id,
    o.ad            AS ogun,
    o.ad            AS ogun_adi,
    o.son_saat      AS son_rezervasyon_saati,
    yh.kapasite,
    COALESCE(r.rezerve, 0)                                      AS rezerve,
    COALESCE(r.rezerve, 0)                                      AS dolu_yer,
    yh.kapasite - COALESCE(r.rezerve, 0)                        AS bos_yer,
    ROUND(100 * COALESCE(r.rezerve, 0) / yh.kapasite, 1)         AS doluluk_yuzde,
    ROUND(100 * COALESCE(r.rezerve, 0) / yh.kapasite, 1)         AS doluluk_orani,
    TIMESTAMP(m.tarih, o.son_saat)                              AS rezervasyon_son
FROM menuler m
JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
JOIN ogunler      o  ON o.id  = m.ogun_id
LEFT JOIN (
    SELECT menu_id, COUNT(*) AS rezerve
      FROM rezervasyonlar
     WHERE durum IN ('aktif', 'kullanildi')
     GROUP BY menu_id
) r ON r.menu_id = m.id;

-- 5. sp_rezervasyon_yap stored procedure (standart kontrat: 2 parametre)
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_rezervasyon_yap$$
CREATE PROCEDURE sp_rezervasyon_yap(
    IN p_kullanici_id INT UNSIGNED,
    IN p_menu_id      INT UNSIGNED
)
proc: BEGIN
    DECLARE v_rol             VARCHAR(20);
    DECLARE v_bakiye          DECIMAL(10,2);
    DECLARE v_ucret           DECIMAL(8,2);
    DECLARE v_kapasite        SMALLINT UNSIGNED;
    DECLARE v_rezerve         INT UNSIGNED;
    DECLARE v_rez_son         DATETIME;
    DECLARE v_rez_id          INT UNSIGNED;
    DECLARE v_durum           VARCHAR(20);

    -- Menü ve son rezervasyon saati kontrolü
    SELECT TIMESTAMP(m.tarih, o.son_saat),
           yh.kapasite,
           IF(k.rol = 'ogrenci', m.ogrenci_fiyati, m.personel_fiyati),
           k.bakiye
      INTO v_rez_son, v_kapasite, v_ucret, v_bakiye
      FROM menuler m
      JOIN ogunler o ON o.id = m.ogun_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      CROSS JOIN kullanicilar k
     WHERE m.id = p_menu_id AND k.id = p_kullanici_id;

    IF v_rez_son IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menü veya kullanıcı bulunamadı.';
    END IF;

    IF NOW() > v_rez_son THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için rezervasyon süresi doldu.';
    END IF;

    -- Kapasite kontrolü
    SELECT COUNT(*) INTO v_rezerve
      FROM rezervasyonlar
     WHERE menu_id = p_menu_id AND durum IN ('aktif', 'kullanildi');

    IF v_rezerve >= v_kapasite THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Yemekhane kapasitesi dolu.';
    END IF;

    -- Bakiye kontrolü
    IF v_bakiye < v_ucret THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bakiye yetersiz.';
    END IF;

    -- Mevcut rezervasyon kontrolü
    SELECT id, durum INTO v_rez_id, v_durum
      FROM rezervasyonlar
     WHERE kullanici_id = p_kullanici_id AND menu_id = p_menu_id;

    IF v_durum = 'aktif' OR v_durum = 'kullanildi' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için zaten rezervasyonunuz var.';
    END IF;

    START TRANSACTION;

    IF v_rez_id IS NOT NULL THEN
        UPDATE rezervasyonlar
           SET durum = 'aktif', ucret = v_ucret, porsiyon = 'tam',
               olusturma = NOW(), iptal_zamani = NULL
         WHERE id = v_rez_id;
    ELSE
        INSERT INTO rezervasyonlar (kullanici_id, menu_id, durum, porsiyon, ucret, olusturma)
        VALUES (p_kullanici_id, p_menu_id, 'aktif', 'tam', v_ucret, NOW());
        SET v_rez_id = LAST_INSERT_ID();
    END IF;

    -- Bakiye düşümü ve hareket kaydı
    UPDATE kullanicilar SET bakiye = bakiye - v_ucret WHERE id = p_kullanici_id;
    INSERT INTO bakiye_hareketleri (kullanici_id, tur, tutar, rezervasyon_id, olusturma)
    VALUES (p_kullanici_id, 'rezervasyon', -v_ucret, v_rez_id, NOW());

    SELECT bakiye INTO v_bakiye FROM kullanicilar WHERE id = p_kullanici_id;
    COMMIT;

    SELECT v_rez_id AS rezervasyon_id, v_ucret AS ucret, v_bakiye AS bakiye;
END proc$$

-- Aşama 4 için porsiyon parametreli rezervasyon yordamı
DROP PROCEDURE IF EXISTS sp_rezervasyon_yap_porsiyonlu$$
CREATE PROCEDURE sp_rezervasyon_yap_porsiyonlu(
    IN p_kullanici_id INT UNSIGNED,
    IN p_menu_id      INT UNSIGNED,
    IN p_porsiyon     VARCHAR(10)
)
proc: BEGIN
    DECLARE v_rol             VARCHAR(20);
    DECLARE v_bakiye          DECIMAL(10,2);
    DECLARE v_ucret           DECIMAL(8,2);
    DECLARE v_kapasite        SMALLINT UNSIGNED;
    DECLARE v_rezerve         INT UNSIGNED;
    DECLARE v_rez_son         DATETIME;
    DECLARE v_rez_id          INT UNSIGNED;
    DECLARE v_durum           VARCHAR(20);
    DECLARE v_yarim_uygun     TINYINT(1);

    SELECT TIMESTAMP(m.tarih, o.son_saat),
           yh.kapasite,
           IF(k.rol = 'ogrenci', m.ogrenci_fiyati, m.personel_fiyati),
           k.bakiye,
           COALESCE(o.yarim_porsiyon_uygun, 1)
      INTO v_rez_son, v_kapasite, v_ucret, v_bakiye, v_yarim_uygun
      FROM menuler m
      JOIN ogunler o ON o.id = m.ogun_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      CROSS JOIN kullanicilar k
     WHERE m.id = p_menu_id AND k.id = p_kullanici_id;

    IF v_rez_son IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menü veya kullanıcı bulunamadı.';
    END IF;

    IF NOW() > v_rez_son THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için rezervasyon süresi doldu.';
    END IF;

    -- Yarım porsiyon ücret hesabı (%60)
    IF p_porsiyon = 'yarim' THEN
        IF v_yarim_uygun = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu öğünde yarım porsiyon seçeneği bulunmamaktadır.';
        END IF;
        SET v_ucret = ROUND(v_ucret * 0.60, 2);
    ELSE
        SET p_porsiyon = 'tam';
    END IF;

    SELECT COUNT(*) INTO v_rezerve
      FROM rezervasyonlar
     WHERE menu_id = p_menu_id AND durum IN ('aktif', 'kullanildi');

    IF v_rezerve >= v_kapasite THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Yemekhane kapasitesi dolu.';
    END IF;

    IF v_bakiye < v_ucret THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bakiye yetersiz.';
    END IF;

    SELECT id, durum INTO v_rez_id, v_durum
      FROM rezervasyonlar
     WHERE kullanici_id = p_kullanici_id AND menu_id = p_menu_id;

    IF v_durum = 'aktif' OR v_durum = 'kullanildi' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için zaten rezervasyonunuz var.';
    END IF;

    START TRANSACTION;

    IF v_rez_id IS NOT NULL THEN
        UPDATE rezervasyonlar
           SET durum = 'aktif', ucret = v_ucret, porsiyon = p_porsiyon,
               olusturma = NOW(), iptal_zamani = NULL
         WHERE id = v_rez_id;
    ELSE
        INSERT INTO rezervasyonlar (kullanici_id, menu_id, durum, porsiyon, ucret, olusturma)
        VALUES (p_kullanici_id, p_menu_id, 'aktif', p_porsiyon, v_ucret, NOW());
        SET v_rez_id = LAST_INSERT_ID();
    END IF;

    UPDATE kullanicilar SET bakiye = bakiye - v_ucret WHERE id = p_kullanici_id;
    INSERT INTO bakiye_hareketleri (kullanici_id, tur, tutar, rezervasyon_id, olusturma)
    VALUES (p_kullanici_id, 'rezervasyon', -v_ucret, v_rez_id, NOW());

    SELECT bakiye INTO v_bakiye FROM kullanicilar WHERE id = p_kullanici_id;
    COMMIT;

    SELECT v_rez_id AS rezervasyon_id, v_ucret AS ucret, v_bakiye AS bakiye;
END proc$$
DELIMITER ;
