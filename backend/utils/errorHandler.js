export const errorHandler = (err, req, res, next) => {
  console.error("🔥 Global Error Handler:", JSON.stringify(err, null, 2));

  // Meta API Errors
  if (err.error) {
    const metaError = err.error;
    return res.status(err.status || 400).json({
      error: metaError.message || "Meta API Error",
      code: metaError.code,
      type: metaError.type,
      fbtrace_id: metaError.fbtrace_id
    });
  }

  // Mongoose Errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "Database Validation Error", details: err.message });
  }

  // Default Error
  res.status(err.status || 500).json({
    error: err.message || "Something went wrong on the server"
  });
};
