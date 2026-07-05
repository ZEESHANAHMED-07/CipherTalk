export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`Error [${status}]: ${message}`);
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Server error' : message,
    status,
  });
};

export const notFound = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
};
