export async function status(req, res) {
  try {
    res.json({
      status: 'ok',
      port: process.env.PORT
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed'
    });
  }
}