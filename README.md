# Yemekhane Otomasyonu · Dönem Ödevi

**Öğrenci:** Furkan Ortatepe  
**Öğrenci No:** 241229079  
**Ders:** Web Teknolojileri (Dr. Burak Yılmaz)  
**Üniversite:** Konya Teknik Üniversitesi (KTÜN)  
**Aşama Etiketleri (Git Tags):** `asama-1`, `asama-2`, `asama-3`, `asama-4`  
**Canlı Depo:** [https://github.com/furkanortatepe/yemekhane-otomasyonu](https://github.com/furkanortatepe/yemekhane-otomasyonu)

---

## Hızlı başlangıç

Gerekenler: Docker Desktop (Windows/macOS) ya da Docker Engine + Compose v2 (Linux), Git.

```bash
git clone https://github.com/furkanortatepe/yemekhane-otomasyonu.git
cd yemekhane-otomasyonu
docker compose up -d
docker compose ps -a
```

İlk açılış 1–2 dakika sürer (MySQL kurulumu + örnek veri + replika kopyası + uygulama derlemesi). Beklenen durum:

| Servis | Beklenen |
|---|---|
| mysql-primary | `Up (healthy)` |
| mysql-replica | `Up (healthy)` |
| redis | `Up (healthy)` |
| frontend | `Up (healthy)` |
| uygulama | `Up (healthy)` |
| replica-setup | `Exited (0)` — işini yapıp çıkar, bu normaldir |

`replica-setup` yalnızca `docker compose ps -a` ile görünür (`-a` olmadan çıkmış container'lar listelenmez).

Tarayıcıda: <http://localhost:8080>

## Klasör yapısı

```
docker-compose.yml        6 servis: mysql-primary, mysql-replica, replica-setup, redis, frontend, uygulama
db/init/01_sema.sql       12 tablo, 3 view, 4 stored procedure
db/init/02_ornek_veri.sql 30 kullanıcı, 52 yemek, 84 menü, ~365 rezervasyon
db/init/04_degisiklik.sql Aşama 4: Yarım porsiyon (%60) ve alerjen uyarısı migration'ı
db/replica-setup.sh       replikayı bir kez kurar ve salt okunur yapar
apache/                   Apache 2.4 imajı ve yönlendirme ayarı (WEBAPI: /api/ -> uygulama)
frontend/                 Apache'nin sunduğu HTML/CSS/JS (KTÜN temalı, responsive, 7 ekran)
uygulama/                 Node.js Express REST API servisi (Dockerize, port 8000)
rapor/                    Teslim raporu (241229079_Furkan_Ortatepe_Rapor.pdf) ve ekran görüntüleri
```

`db/init` içindeki dosyalar **yalnızca veritabanı ilk kez oluşturulurken** çalışır. Sonradan
değiştirirseniz etkisini görmek için `docker compose down -v` ile sıfırlamanız gerekir.

## Bağlantı bilgileri

Container'lar birbirine **servis adı ve iç port** ile bağlanır. Dış portlar (3307, 3308) yalnızca
kendi bilgisayarınızdaki araçlar (DBeaver, MySQL Workbench, terminal) içindir.

| | Uygulamadan (container içi) | Bilgisayarınızdan |
|---|---|---|
| Yazma (kaynak) | `mysql-primary:3306` | `localhost:3307` |
| Okuma (replika) | `mysql-replica:3306` | `localhost:3308` |
| Redis | `redis:6379` | `localhost:6379` |
| Web | — | `localhost:8080` |

| Hesap | Kullanıcı | Şifre |
|---|---|---|
| Uygulama | `yemekhane_app` | `Uyg_2026` |
| Yönetim (root) | `root` | `yemekhane_kok` |
| Replikasyon | `repl` | `Repl_2026` |

Veritabanı adı: `yemekhane`.

## Test hesapları

Tüm kullanıcıların şifresi **`Yemek2026!`** (bcrypt, `$2a$`, cost 10). *(Geliştirme kolaylığı için `123456` şifresi de desteklenir).*

| E-posta | Rol | Not |
|---|---|---|
| leyla.arslan@kampus.edu.tr | yönetici | yönetici paneli için |
| murat.kaya@kampus.edu.tr | personel | personel fiyatı |
| ayse.demir@ogr.kampus.edu.tr | öğrenci | bakiyesi 12,50 TL — "Bakiye yetersiz." hatasını denemek için |
| mehmet.yildiz@ogr.kampus.edu.tr | öğrenci | normal bakiye |

Diğer kullanıcılar: `SELECT eposta, rol, bakiye FROM kullanicilar;`

## Veritabanı ve Stored Procedure'ler

Para hareketi yapan işlemler `mysql-primary` üzerinde stored procedure çağrılarıyla yürütülür:
- `sp_rezervasyon_yap(kullanici_id, menu_id)`
- `sp_rezervasyon_iptal(kullanici_id, rezervasyon_id)`
- `sp_bakiye_yukle(kullanici_id, tutar)` (10–1000 TL)
- `sp_turnike_gecis(kullanici_id, yemekhane_id, zaman)`

## Doğrulama komutları (Aşama 1–4)

```bash
# Tüm servislerin durumu
docker compose ps -a

# Replikasyon durumu: Replica_IO_Running ve Replica_SQL_Running "Yes" olmalı
docker compose exec mysql-replica mysql -uroot -pyemekhane_kok -e "SHOW REPLICA STATUS\G"

# Kaynakta bakiye yükle, replikada gör
docker compose exec mysql-primary mysql -uyemekhane_app -pUyg_2026 yemekhane -e "CALL sp_bakiye_yukle(7, 100)"
docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "SELECT id, bakiye FROM kullanicilar WHERE id = 7"

# Replikaya yazma denemesi: read-only hatası beklenir (ERROR 1290)
docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "CALL sp_bakiye_yukle(7, 50)"

# Replika durdurulup başlatıldığında aradaki değişiklikleri yakalar
docker compose stop mysql-replica
docker compose exec mysql-primary mysql -uyemekhane_app -pUyg_2026 yemekhane -e "CALL sp_bakiye_yukle(7, 200)"
docker compose start mysql-replica
docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "SELECT id, bakiye FROM kullanicilar WHERE id = 7"

# Redis bağlantı doğrulaması
docker compose exec redis redis-cli ping

# Web API sağlık kontrolü
curl -i http://localhost:8080/api/health
```

## Migration (Aşama 4)

`04_degisiklik.sql` dosyası `db/init/` klasöründedir. Depoyu sıfırdan kuran biri (`docker compose up -d`) değişikliği otomatik alır. Çalışan sistemde kaynağa elle uygulamak için:

```bash
docker compose exec -T mysql-primary mysql -uroot -pyemekhane_kok yemekhane < db/init/04_degisiklik.sql
```

## Sıfırlama

```bash
docker compose down -v      # container'lar ve TÜM veri silinir
docker compose up -d        # şema ve örnek veri bugüne göre yeniden kurulur
```
