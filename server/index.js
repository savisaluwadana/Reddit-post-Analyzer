import mongoose from 'mongoose';
import { app } from './app.js';

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Set MONGODB_URI and a valid PORT (1-65535) in your environment or .env file.');
  process.exit(1);
}

try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const server = app.listen(port, () => console.log(`Pain Intelligence Lab running on http://localhost:${port}`));
  server.on('error', (error) => {
    console.error('HTTP server error:', error);
    void mongoose.disconnect().finally(() => process.exit(1));
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(() => {
      void mongoose.disconnect().then(() => {
        clearTimeout(deadline);
        process.exit(0);
      }).catch(() => process.exit(1));
    });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
} catch (error) {
  console.error('Startup error:', error);
  process.exit(1);
}
