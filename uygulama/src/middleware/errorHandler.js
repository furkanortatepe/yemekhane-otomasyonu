class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function errorHandler(err, req, res, _next) {
  // Stored procedure SQLSTATE '45000' (MySQL errno 1644) hatalari dogrudan arayuze tasinir
  if (err && (err.sqlState === '45000' || err.errno === 1644)) {
    return res.status(400).json({
      basarili: false,
      hata: err.sqlMessage || err.message,
    });
  }

  // Unique constraint ihlali
  if (err && err.errno === 1062) {
    return res.status(409).json({
      basarili: false,
      hata: 'Bu kayıt zaten mevcut.',
    });
  }

  // Replikaya yanlislikla yazma denemesi olursa
  if (err && err.errno === 1290) {
    return res.status(503).json({
      basarili: false,
      hata: 'Salt okunur veritabanı sunucusuna yazma yapılamaz.',
    });
  }

  if (err && err.isOperational) {
    return res.status(err.statusCode || 400).json({
      basarili: false,
      hata: err.message,
    });
  }

  console.error('[API HATA]', err);
  return res.status(500).json({
    basarili: false,
    hata: 'Sunucu tarafında beklenmeyen bir hata oluştu.',
  });
}

module.exports = {
  AppError,
  errorHandler,
};
