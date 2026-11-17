const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { eposta, sifre } = req.body;
    const data = await authService.login(eposta, sifre);
    res.json({ basarili: true, veri: data });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.token);
    res.json({ basarili: true, mesaj: 'Çıkış yapıldı.' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const kullanici = await authService.getCurrentUser(req.user.id);
    res.json({ basarili: true, veri: kullanici });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me };
