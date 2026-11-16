const express = require('express');
const { primaryPool, replicaPool } = require('./config/db');
const redis = require('./config/redis');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const rezervasyonRoutes = require('./routes/rezervasyonRoutes');
const bakiyeRoutes = require('./routes/bakiyeRoutes');
const degerlendirmeRoutes = require('./routes/degerlendirmeRoutes');
const profilRoutes = require('./routes/profilRoutes');
const yonetimRoutes = require('./routes/yonetimRoutes');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Istek loglayici
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    await primaryPool.query('SELECT 1');
    await replicaPool.query('SELECT 1');
    await redis.ping();
    res.json({ basarili: true, durum: 'saglikli', zaman: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ basarili: false, durum: 'hatali', hata: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/menuler', menuRoutes);
app.use('/api/rezervasyonlar', rezervasyonRoutes);
app.use('/api/bakiye', bakiyeRoutes);
app.use('/api/degerlendirmeler', degerlendirmeRoutes);
app.use('/api/profil', profilRoutes);
app.use('/api/yonetim', yonetimRoutes);

app.use((_req, res) => {
  res.status(404).json({ basarili: false, hata: 'İstenen API uç noktası bulunamadı.' });
});

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[UYGULAMA] Yemekhane Web API ${PORT} portunda çalışıyor.`);
});
