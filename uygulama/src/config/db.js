const mysql = require('mysql2/promise');

const commonConfig = {
  user: process.env.DB_KULLANICI || process.env.DB_USER || 'yemekhane_app',
  password: process.env.DB_SIFRE || process.env.DB_PASSWORD || 'Uyg_2026',
  database: process.env.DB_ADI || process.env.DB_NAME || 'yemekhane',
  charset: 'utf8mb4',
  timezone: '+03:00',
  dateStrings: ['DATE'],
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
};

// Yazma islemleri ve rezervasyon sonrasi anlik bakiye okumalari icin kaynak (primary) havuzu
const primaryPool = mysql.createPool({
  ...commonConfig,
  host: process.env.DB_YAZMA_HOST || process.env.DB_PRIMARY_HOST || 'mysql-primary',
  port: Number(process.env.DB_PORT || process.env.DB_PRIMARY_PORT || 3306),
});

// Listeleme ve raporlama okumalari icin salt okunur replika havuzu
const replicaPool = mysql.createPool({
  ...commonConfig,
  host: process.env.DB_OKUMA_HOST || process.env.DB_REPLICA_HOST || 'mysql-replica',
  port: Number(process.env.DB_PORT || process.env.DB_REPLICA_PORT || 3306),
});

module.exports = {
  primaryPool,
  replicaPool,
};
