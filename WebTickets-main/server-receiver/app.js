import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  try {
    const secret = req.headers['x-webhook-secret'];

    if (secret !== process.env.WEBHOOK_SECRET) {
      console.log('❌ Webhook rejected (invalid secret)');
      return res.sendStatus(401);
    }

    console.log('📩 Webhook received:');
    console.log(JSON.stringify(req.body, null, 2));

    res.sendStatus(200);
  } catch (error) {
    console.error('🔥 Error processing webhook:', error);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log(`🟢 Receiver server running on port ${process.env.PORT || 4000}`);
});