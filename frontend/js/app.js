(() => {
  const state = {
    token: localStorage.getItem('yemekhane_token') || null,
    user: null,
    referanslar: { yemekhaneler: [], ogunler: [], alerjenler: [], bugun: '' },
    activeScreen: 'gunun-menusu',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function showToast(message, type = 'success') {
    const container = $('#toast-container');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.remove(), 4200);
  }

  function formatTL(val) {
    return `${Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
  }

  function formatDateTR(isoDate) {
    if (!isoDate) return '-';
    const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
    return d.toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  }

  function formatDateTimeTR(isoStr) {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const res = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({ basarili: false, hata: 'Geçersiz sunucu yanıtı' }));
    if (!res.ok || !data.basarili) {
      if (res.status === 401 && state.token) {
        clearSession();
      }
      throw new Error(data.hata || 'İşlem sırasında bir hata oluştu.');
    }
    return data;
  }

  function clearSession() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('yemekhane_token');
    renderUserBar();
  }

  function renderUserBar() {
    const bar = $('#user-bar');
    const isAuth = Boolean(state.user);
    const isAdmin = isAuth && state.user.rol === 'yonetici';

    $$('.auth-only').forEach((el) => el.classList.toggle('hidden', !isAuth));
    $$('.admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin));

    if (!isAuth) {
      bar.innerHTML = `
        <span class="badge badge-muted">Misafir</span>
        <button class="btn btn-primary btn-sm" id="btn-open-login">Giriş Yap</button>
      `;
      $('#btn-open-login').addEventListener('click', () => switchScreen('giris'));
      return;
    }

    const rolLabel = { ogrenci: 'Öğrenci', personel: 'Personel', yonetici: 'Yönetici' }[state.user.rol] || state.user.rol;
    bar.innerHTML = `
      <span class="user-chip">
        <span>${state.user.ad_soyad}</span>
        <span class="badge badge-primary">${rolLabel}</span>
        <strong>${formatTL(state.user.bakiye)}</strong>
      </span>
      <button class="btn btn-outline btn-sm" id="btn-logout">Çıkış</button>
    `;
    $('#btn-logout').addEventListener('click', handleLogout);
  }

  function switchScreen(name) {
    state.activeScreen = name;
    $$('.screen').forEach((s) => s.classList.add('hidden'));
    const target = $(`#screen-${name}`);
    if (target) target.classList.remove('hidden');

    $$('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });

    if (name === 'gunun-menusu') loadGununMenusu();
    if (name === 'haftalik') loadHaftalikMenu();
    if (name === 'rezervasyonlar') loadRezervasyonlar();
    if (name === 'bakiye') loadBakiye();
    if (name === 'degerlendirme') loadDegerlendirmeler();
    if (name === 'profil') loadProfilAlerjenler();
    if (name === 'yonetim') loadYonetimPaneli();
  }

  async function handleLogout() {
    try {
      await api('/auth/cikis', { method: 'POST' });
    } catch (_err) {
      // ignore
    }
    clearSession();
    showToast('Oturum kapatıldı.');
    switchScreen('gunun-menusu');
  }

  async function initReferanslar() {
    const res = await api('/menuler/referanslar');
    state.referanslar = res.veri;

    const yhOpts = state.referanslar.yemekhaneler
      .map((y) => `<option value="${y.id}">${y.ad} (${y.kapasite} kişi)</option>`)
      .join('');
    const ogunOpts = state.referanslar.ogunler
      .map((o) => `<option value="${o.id}">${o.ad} (Son: ${String(o.son_rezervasyon_saati).slice(0, 5)})</option>`)
      .join('');

    ['#gm-yemekhane', '#hm-yemekhane', '#ym-yemekhane'].forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = yhOpts;
    });
    ['#gm-ogun', '#ym-ogun'].forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = ogunOpts;
    });

    if ($('#gm-ogun')) $('#gm-ogun').value = '2'; // Varsayilan Ogle
    if ($('#gm-tarih')) $('#gm-tarih').value = state.referanslar.bugun;
    if ($('#hm-baslangic')) $('#hm-baslangic').value = state.referanslar.bugun;
    if ($('#ym-tarih')) $('#ym-tarih').value = state.referanslar.bugun;
  }

  async function restoreSession() {
    if (!state.token) {
      renderUserBar();
      return;
    }
    try {
      const res = await api('/auth/ben');
      state.user = res.veri;
    } catch (_err) {
      clearSession();
    }
    renderUserBar();
  }

  // 2. GUNUN MENUSU
  async function loadGununMenusu() {
    const container = $('#gm-icerik');
    container.innerHTML = '<div class="card empty-state">Menü yükleniyor...</div>';
    try {
      const yh = $('#gm-yemekhane').value || 1;
      const tarih = $('#gm-tarih').value || state.referanslar.bugun;
      const ogun = $('#gm-ogun').value || 2;
      const res = await api(`/menuler/gunun-menusu?yemekhane_id=${yh}&tarih=${tarih}&ogun_id=${ogun}`);
      const m = res.veri;

      if (!m) {
        container.innerHTML = '<div class="card empty-state">Seçilen tarih ve öğün için tanımlı menü bulunamadı.</div>';
        return;
      }

      const yemekKartlari = m.yemekler
        .map((y) => {
          const eslesenSet = new Set(y.eslesen_alerjenler || []);
          const alerjenBadges = y.alerjenler.length
            ? y.alerjenler
                .map(
                  (a) =>
                    `<span class="badge ${eslesenSet.has(a) ? 'badge-danger' : 'badge-warn'}">${
                      eslesenSet.has(a) ? '⚠️ ' : ''
                    }${a}</span>`
                )
                .join('')
            : '<span class="badge badge-muted">Alerjen yok</span>';
          const vegBadge = y.vejetaryen ? '<span class="badge badge-veg">Vejetaryen</span>' : '';
          const uyariSatiri = y.alerjen_uyarisi
            ? `<div class="badge badge-danger">⚠️ Alerjen Uyarısı: ${y.eslesen_alerjenler.join(', ')}</div>`
            : '';
          return `
            <article class="dish-card ${y.alerjen_uyarisi ? 'allergen-alert' : ''}">
              <span class="dish-cat">${y.kategori_adi}</span>
              <h4 class="dish-name">${y.ad}</h4>
              ${uyariSatiri}
              <div class="dish-meta">
                <span class="badge badge-primary">${y.kalori} kcal</span>
                ${vegBadge}
              </div>
              <div class="dish-meta">${alerjenBadges}</div>
            </article>
          `;
        })
        .join('');

      const ustUyari =
        m.uyari_veren_yemek_sayisi > 0
          ? `<div class="alert-banner">⚠️ Alerjen Uyarısı: Profilinizde seçili alerjenleri içeren ${m.uyari_veren_yemek_sayisi} yemek bu menüde yer almaktadır. Kırmızı ile işaretlenen yemeklere dikkat ediniz.</div>`
          : '';

      container.innerHTML = `
        <div class="card">
          ${ustUyari}
          <div class="menu-summary-bar">
            <div>
              <h3>${m.yemekhane_adi} · ${m.ogun_adi}</h3>
              <span class="muted">${formatDateTR(m.tarih)} · Servis: ${String(m.baslangic_saati).slice(0, 5)}–${String(m.bitis_saati).slice(0, 5)}</span>
            </div>
            <div class="dish-meta">
              <span class="badge badge-primary">Toplam ${m.toplam_kalori} kcal</span>
              <span class="badge badge-info">Boş Yer: ${m.bos_yer}/${m.kapasite}</span>
              <span class="badge badge-warn">★ ${Number(m.ortalama_puan).toFixed(1)} (${m.degerlendirme_sayisi})</span>
              <span class="badge badge-muted">Kaynak: ${m.kaynak}</span>
            </div>
          </div>
          <div class="dish-list">${yemekKartlari}</div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card empty-state">${err.message}</div>`;
    }
  }

  // 3. HAFTALIK MENU VE REZERVASYON
  async function loadHaftalikMenu() {
    const container = $('#hm-icerik');
    container.innerHTML = '<div class="card empty-state">Haftalık menü yükleniyor...</div>';
    try {
      const yh = $('#hm-yemekhane').value || 1;
      const baslangic = $('#hm-baslangic').value || state.referanslar.bugun;
      const res = await api(`/menuler/haftalik?yemekhane_id=${yh}&baslangic=${baslangic}`);
      const list = res.veri;

      if (!list.length) {
        container.innerHTML = '<div class="card empty-state">Bu hafta için menü bulunamadı.</div>';
        return;
      }

      container.innerHTML = list
        .map((m) => {
          const isAuth = Boolean(state.user);
          let btnText = 'Rezervasyon Yap';
          let btnDisabled = !m.rezervasyon_yapilabilir;

          if (!isAuth) {
            btnText = 'Rezervasyon için Giriş Yap';
            btnDisabled = false;
          } else if (m.kullanici_rezervasyon_durumu === 'aktif') {
            btnText = 'Rezervasyonunuz Aktif';
            btnDisabled = true;
          } else if (m.kullanici_rezervasyon_durumu === 'kullanildi') {
            btnText = 'Kullanıldı';
            btnDisabled = true;
          } else if (!m.rezervasyon_acik) {
            btnText = `Son Saat Geçti (${String(m.son_rezervasyon_saati).slice(0, 5)})`;
            btnDisabled = true;
          } else if (m.bos_yer <= 0) {
            btnText = 'Kontenjan Dolu';
            btnDisabled = true;
          }

          const porsiyonSecici = m.yarim_porsiyon_uygun
            ? `
              <div class="portion-box">
                <label for="porsiyon-${m.menu_id}">Porsiyon Seçimi</label>
                <select id="porsiyon-${m.menu_id}" class="porsiyon-select" ${btnDisabled ? 'disabled' : ''}>
                  <option value="tam">Tam Porsiyon (${formatTL(m.kullanici_fiyati)})</option>
                  <option value="yarim">Yarım Porsiyon — %60 (${formatTL(m.yarim_porsiyon_fiyati)})</option>
                </select>
              </div>
            `
            : `<div class="portion-box"><span class="badge badge-muted">Yalnızca Tam Porsiyon (${formatTL(m.kullanici_fiyati)})</span></div>`;

          return `
            <article class="card">
              <div class="card-head-row">
                <div>
                  <strong>${formatDateTR(m.tarih)}</strong>
                  <div class="muted">${m.ogun_adi} · Son saat ${String(m.son_rezervasyon_saati).slice(0, 5)}</div>
                </div>
                <span class="badge badge-primary">${formatTL(m.kullanici_fiyati)}</span>
              </div>
              <p class="muted">${m.yemek_ozeti || 'Menü içeriği belirtilmemiş.'}</p>
              <div class="dish-meta mt-16">
                <span class="badge badge-muted">${m.toplam_kalori} kcal</span>
                <span class="badge badge-info">Boş: ${m.bos_yer}/${m.kapasite}</span>
                <span class="badge badge-warn">★ ${Number(m.ortalama_puan).toFixed(1)}</span>
              </div>
              <div class="progress">
                <div class="progress-fill" style="width:${Math.min(m.doluluk_orani, 100)}%"></div>
              </div>
              ${porsiyonSecici}
              <button
                type="button"
                class="btn btn-primary btn-block btn-rez-yap"
                data-menu-id="${m.menu_id}"
                ${btnDisabled ? 'disabled' : ''}
              >${btnText}</button>
            </article>
          `;
        })
        .join('');

      $$('.btn-rez-yap').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!state.user) {
            switchScreen('giris');
            return;
          }
          const menuId = Number(btn.dataset.menuId);
          const porsiyonEl = $(`#porsiyon-${menuId}`);
          const porsiyon = porsiyonEl ? porsiyonEl.value : 'tam';
          btn.disabled = true;
          try {
            const res = await api('/rezervasyonlar', {
              method: 'POST',
              body: { menu_id: menuId, porsiyon },
            });
            state.user.bakiye = res.veri.guncel_bakiye;
            renderUserBar();
            showToast(`${res.mesaj} Güncel bakiye: ${formatTL(res.veri.guncel_bakiye)}`);
            loadHaftalikMenu();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="card empty-state">${err.message}</div>`;
    }
  }

  // 4. REZERVASYONLARIM
  async function loadRezervasyonlar() {
    const container = $('#rez-icerik');
    container.innerHTML = '<div class="card empty-state">Rezervasyonlar yükleniyor...</div>';
    try {
      const res = await api('/rezervasyonlar');
      const list = res.veri;
      if (!list.length) {
        container.innerHTML = '<div class="card empty-state">Henüz rezervasyonunuz bulunmuyor.</div>';
        return;
      }

      const durumBadge = (d) => {
        if (d === 'aktif') return '<span class="badge badge-primary">Aktif</span>';
        if (d === 'kullanildi') return '<span class="badge badge-veg">Kullanıldı</span>';
        return '<span class="badge badge-danger">İptal</span>';
      };

      container.innerHTML = `
        <div class="menu-grid">
          ${list
            .map(
              (r) => `
            <article class="card">
              <div class="card-head-row">
                <div>
                  <strong>${formatDateTR(r.tarih)}</strong>
                  <div class="muted">${r.yemekhane_adi} · ${r.ogun_adi}</div>
                </div>
                ${durumBadge(r.durum)}
              </div>
              <p class="muted">${r.yemek_ozeti || ''}</p>
              <div class="card-head-row mt-16">
                <div class="dish-meta">
                  <strong>${formatTL(r.odenen_tutar)}</strong>
                  <span class="badge ${r.porsiyon === 'yarim' ? 'badge-info' : 'badge-muted'}">${
                    r.porsiyon === 'yarim' ? 'Yarım Porsiyon' : 'Tam Porsiyon'
                  }</span>
                </div>
                ${
                  r.iptal_edilebilir
                    ? `<button type="button" class="btn btn-danger btn-sm btn-rez-iptal" data-id="${r.id}">İptal Et</button>`
                    : '<span class="muted">İptal kapalı</span>'
                }
              </div>
            </article>
          `
            )
            .join('')}
        </div>
      `;

      $$('.btn-rez-iptal').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await api(`/rezervasyonlar/${btn.dataset.id}/iptal`, { method: 'POST' });
            state.user.bakiye = res.veri.guncel_bakiye;
            renderUserBar();
            showToast(`${res.mesaj} Güncel bakiye: ${formatTL(res.veri.guncel_bakiye)}`);
            loadRezervasyonlar();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="card empty-state">${err.message}</div>`;
    }
  }

  // 5. BAKIYE
  async function loadBakiye() {
    try {
      const res = await api('/bakiye');
      const v = res.veri;
      state.user.bakiye = v.bakiye;
      renderUserBar();
      $('#bakiye-tutar').textContent = formatTL(v.bakiye);
      $('#bakiye-kaynak-etiket').textContent = `Bakiye: ${v.bakiye_kaynagi} · Geçmiş: ${v.hareketler_kaynagi}`;

      const tipLabel = { yukleme: 'Yükleme', rezervasyon: 'Rezervasyon', iade: 'İade' };
      const tbody = $('#bakiye-hareket-tbody');
      if (!v.hareketler.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">Hareket kaydı yok.</td></tr>';
        return;
      }
      tbody.innerHTML = v.hareketler
        .map(
          (h) => `
          <tr>
            <td>${formatDateTimeTR(h.olusturma_tarihi)}</td>
            <td><span class="badge ${h.tutar >= 0 ? 'badge-veg' : 'badge-warn'}">${tipLabel[h.tip] || h.tip}</span></td>
            <td>${h.aciklama || '-'}</td>
            <td class="text-right ${h.tutar >= 0 ? 'amount-pos' : 'amount-neg'}">${h.tutar >= 0 ? '+' : ''}${formatTL(h.tutar)}</td>
          </tr>
        `
        )
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // 6. DEGERLENDIRME
  async function loadDegerlendirmeler() {
    const container = $('#deg-icerik');
    container.innerHTML = '<div class="card empty-state">Kullanılmış menüler yükleniyor...</div>';
    try {
      const res = await api('/degerlendirmeler/kullanilmis');
      const list = res.veri;
      if (!list.length) {
        container.innerHTML = '<div class="card empty-state">Henüz değerlendirilebilecek kullanılmış menünüz yok.</div>';
        return;
      }

      container.innerHTML = list
        .map((item) => {
          if (item.degerlendirme_id) {
            return `
              <article class="card">
                <div class="card-head-row">
                  <div>
                    <strong>${formatDateTR(item.tarih)}</strong>
                    <div class="muted">${item.yemekhane_adi} · ${item.ogun_adi}</div>
                  </div>
                  <span class="badge badge-warn">★ ${item.puan}/5</span>
                </div>
                <p class="muted">${item.yemek_ozeti || ''}</p>
                <p class="mt-16"><em>"${item.yorum || 'Yorum bırakılmadı.'}"</em></p>
              </article>
            `;
          }
          return `
            <article class="card">
              <strong>${formatDateTR(item.tarih)}</strong>
              <div class="muted">${item.yemekhane_adi} · ${item.ogun_adi}</div>
              <p class="muted">${item.yemek_ozeti || ''}</p>
              <form class="form-stack mt-16 deg-form" data-menu-id="${item.menu_id}">
                <div class="form-group">
                  <label>Puan (1–5)</label>
                  <select name="puan" required>
                    <option value="5">★★★★★ (5 - Çok İyi)</option>
                    <option value="4">★★★★☆ (4 - İyi)</option>
                    <option value="3">★★★☆☆ (3 - Orta)</option>
                    <option value="2">★★☆☆☆ (2 - Geliştirilmeli)</option>
                    <option value="1">★☆☆☆☆ (1 - Kötü)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Yorumunuz</label>
                  <textarea name="yorum" rows="2" placeholder="Menü hakkındaki düşünceleriniz..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-sm">Değerlendirmeyi Gönder</button>
              </form>
            </article>
          `;
        })
        .join('');

      $$('.deg-form').forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const menuId = Number(form.dataset.menuId);
          const puan = Number(form.elements.puan.value);
          const yorum = form.elements.yorum.value;
          try {
            const res = await api('/degerlendirmeler', {
              method: 'POST',
              body: { menu_id: menuId, puan, yorum },
            });
            showToast(res.mesaj);
            loadDegerlendirmeler();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="card empty-state">${err.message}</div>`;
    }
  }

  // 8. PROFIL & ALERJENLER (Asama 4)
  async function loadProfilAlerjenler() {
    const container = $('#profil-alerjen-listesi');
    container.innerHTML = '<span class="muted">Alerjen listesi yükleniyor...</span>';
    try {
      const res = await api('/profil/alerjenler');
      const { tum_alerjenler, secili_alerjen_idleri } = res.veri;
      const seciliSet = new Set(secili_alerjen_idleri.map(Number));
      container.innerHTML = tum_alerjenler
        .map(
          (a) => `
          <label class="checkbox-item">
            <input type="checkbox" name="profil_alerjen" value="${a.id}" ${seciliSet.has(a.id) ? 'checked' : ''}>
            <span>${a.ad} <small class="muted">(${a.kod})</small></span>
          </label>
        `
        )
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // 7. YONETICI PANELI
  async function loadYonetimPaneli() {
    try {
      const [yemekRes, raporRes, aktifRes] = await Promise.all([
        api('/yonetim/yemekler'),
        api('/yonetim/rapor'),
        api('/yonetim/aktif-rezervasyonlar'),
      ]);

      // Yemek checkbox listesi
      const listEl = $('#ym-yemek-listesi');
      if (!listEl.dataset.loaded) {
        listEl.innerHTML = yemekRes.veri
          .map(
            (y) => `
            <label class="checkbox-item">
              <input type="checkbox" name="ym_yemek" value="${y.id}">
              <span><strong>${y.kategori_adi}:</strong> ${y.ad} (${y.kalori} kcal)</span>
            </label>
          `
          )
          .join('');
        listEl.dataset.loaded = '1';
      }

      // Rapor tablosu
      const tbody = $('#yonetim-rapor-tbody');
      tbody.innerHTML = raporRes.veri
        .map(
          (r) => `
          <tr>
            <td>${formatDateTR(r.tarih)}</td>
            <td>${r.yemekhane_adi}</td>
            <td>${r.ogun_adi}</td>
            <td>${r.dolu_yer}/${r.kapasite} (%${r.doluluk_orani})</td>
            <td>★ ${Number(r.ortalama_puan).toFixed(1)} (${r.degerlendirme_sayisi})</td>
            <td>${formatTL(r.ogrenci_fiyati)} / ${formatTL(r.personel_fiyati)}</td>
            <td>
              <button
                type="button"
                class="btn btn-outline btn-sm btn-menu-duzenle"
                data-menu='${JSON.stringify({
                  id: r.menu_id,
                  yemekhane_id: r.yemekhane_id,
                  tarih: r.tarih,
                  ogun_id: r.ogun_id,
                  ogrenci_fiyati: r.ogrenci_fiyati,
                  personel_fiyati: r.personel_fiyati,
                  yemek_idleri: r.yemek_idleri,
                })}'
              >Düzenle</button>
            </td>
          </tr>
        `
        )
        .join('');

      $$('.btn-menu-duzenle').forEach((btn) => {
        btn.addEventListener('click', () => {
          const m = JSON.parse(btn.dataset.menu);
          $('#ym-edit-id').value = m.id;
          $('#ym-yemekhane').value = m.yemekhane_id;
          $('#ym-tarih').value = m.tarih;
          $('#ym-ogun').value = m.ogun_id;
          $('#ym-ogr-fiyat').value = m.ogrenci_fiyati;
          $('#ym-per-fiyat').value = m.personel_fiyati;
          $('#ym-yemekhane').disabled = true;
          $('#ym-tarih').disabled = true;
          $('#ym-ogun').disabled = true;
          $$('input[name="ym_yemek"]').forEach((cb) => {
            cb.checked = m.yemek_idleri.includes(Number(cb.value));
          });
          $('#yonetim-form-baslik').textContent = `Menü #${m.id} Düzenle`;
          $('#ym-submit-btn').textContent = 'Değişiklikleri Kaydet';
          $('#ym-cancel-edit').classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      // Turnike listesi
      const turnikeEl = $('#turnike-listesi');
      turnikeEl.innerHTML = aktifRes.veri.length
        ? aktifRes.veri
            .map(
              (a) => `
            <div class="turnike-item">
              <div>
                <strong>${a.ad_soyad}</strong>
                <div class="muted">${formatDateTR(a.tarih)} · ${a.yemekhane_adi} · ${a.ogun_adi}</div>
              </div>
              <button type="button" class="btn btn-primary btn-sm btn-turnike" data-u="${a.kullanici_id}" data-m="${a.menu_id}">Geçiş Onayla</button>
            </div>
          `
            )
            .join('')
        : '<p class="muted">Aktif rezervasyon bulunmuyor.</p>';

      $$('.btn-turnike').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await api('/yonetim/turnike-gecis', {
              method: 'POST',
              body: { kullanici_id: Number(btn.dataset.u), menu_id: Number(btn.dataset.m) },
            });
            showToast(res.mesaj);
            loadYonetimPaneli();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function resetYonetimForm() {
    $('#ym-edit-id').value = '';
    $('#ym-yemekhane').disabled = false;
    $('#ym-tarih').disabled = false;
    $('#ym-ogun').disabled = false;
    $$('input[name="ym_yemek"]').forEach((cb) => (cb.checked = false));
    $('#yonetim-form-baslik').textContent = 'Yeni Menü Oluştur';
    $('#ym-submit-btn').textContent = 'Menüyü Kaydet';
    $('#ym-cancel-edit').classList.add('hidden');
  }

  function bindEvents() {
    $$('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
    });

    $$('.demo-fill').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#login-eposta').value = btn.dataset.email;
        $('#login-sifre').value = 'Yemek2026!';
      });
    });

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/auth/giris', {
          method: 'POST',
          body: {
            eposta: $('#login-eposta').value,
            sifre: $('#login-sifre').value,
          },
        });
        state.token = res.veri.token;
        state.user = res.veri.kullanici;
        localStorage.setItem('yemekhane_token', state.token);
        renderUserBar();
        showToast(`Hoş geldiniz, ${state.user.ad_soyad}!`);
        switchScreen('gunun-menusu');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    $('#btn-gm-getir').addEventListener('click', loadGununMenusu);
    $('#btn-hm-getir').addEventListener('click', loadHaftalikMenu);
    $('#btn-rez-yenile').addEventListener('click', loadRezervasyonlar);
    $('#btn-rapor-yenile').addEventListener('click', loadYonetimPaneli);

    $$('.quick-amt').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#bakiye-input').value = btn.dataset.amt;
      });
    });

    $('#bakiye-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/bakiye/yukle', {
          method: 'POST',
          body: {
            tutar: Number($('#bakiye-input').value),
            aciklama: $('#bakiye-aciklama').value,
          },
        });
        $('#bakiye-input').value = '';
        $('#bakiye-aciklama').value = '';
        showToast(res.mesaj);
        loadBakiye();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    $('#ym-cancel-edit').addEventListener('click', resetYonetimForm);

    $('#profil-alerjen-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ids = $$('input[name="profil_alerjen"]:checked').map((cb) => Number(cb.value));
      try {
        const res = await api('/profil/alerjenler', {
          method: 'PUT',
          body: { alerjen_idleri: ids },
        });
        showToast(res.mesaj);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    $('#yonetim-menu-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = $('#ym-edit-id').value;
      const yemekIdleri = $$('input[name="ym_yemek"]:checked').map((cb) => Number(cb.value));

      try {
        if (editId) {
          const res = await api(`/yonetim/menuler/${editId}`, {
            method: 'PUT',
            body: {
              ogrenci_fiyati: Number($('#ym-ogr-fiyat').value),
              personel_fiyati: Number($('#ym-per-fiyat').value),
              yemek_idleri: yemekIdleri,
            },
          });
          showToast(res.mesaj);
        } else {
          const res = await api('/yonetim/menuler', {
            method: 'POST',
            body: {
              yemekhane_id: Number($('#ym-yemekhane').value),
              tarih: $('#ym-tarih').value,
              ogun_id: Number($('#ym-ogun').value),
              ogrenci_fiyati: Number($('#ym-ogr-fiyat').value),
              personel_fiyati: Number($('#ym-per-fiyat').value),
              yemek_idleri: yemekIdleri,
            },
          });
          showToast(res.mesaj);
        }
        resetYonetimForm();
        loadYonetimPaneli();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  async function bootstrap() {
    bindEvents();
    await initReferanslar();
    await restoreSession();
    switchScreen('gunun-menusu');
  }

  bootstrap();
})();
