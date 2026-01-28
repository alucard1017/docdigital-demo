function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token inválido' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expirado' });
  }

  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  return res.status(status).json({
    message: status === 500 ? 'Error interno del servidor' : err.message
  });
}

module.exports = errorHandler;
