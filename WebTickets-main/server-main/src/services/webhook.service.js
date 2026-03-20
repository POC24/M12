let subscribers = [];

export function register(url, event) {
  if (!url || !event) {
    throw new Error('url and event are required');
  }

  subscribers.push({ url, event });
}

export async function notify(event, data) {
  console.log('📣 notify:', event);

  for (const subscriber of subscribers) {
    if (subscriber.event !== event) continue;

    try {
      await fetch(subscriber.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('❌ Webhook error:', error);
    }
  }
}
