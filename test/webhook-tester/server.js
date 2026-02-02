/**
 * Webhook Event Tester
 * Simple Express server to receive webhook events during testing
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Store received webhooks
let receivedWebhooks = [];

app.use(express.json());

app.post('/', (req, res) => {
  try {
    const webhook = {
      timestamp: new Date().toISOString(),
      headers: {
        'x-webhook-secret': req.headers['x-webhook-secret'],
        'x-webhook-type': req.headers['x-webhook-type'],
        'user-agent': req.headers['user-agent'],
      },
      body: req.body,
    };

    receivedWebhooks.push(webhook);

    console.log('[Webhook] Received event:', req.body.type);
    console.log('[Webhook] Message ID:', req.body.message ? req.body.message.id : 'N/A');
    console.log('[Webhook] Total events:', receivedWebhooks.length);

    res.status(200).json({ received: true, count: receivedWebhooks.length });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/events', (req, res) => {
  res.json({
    count: receivedWebhooks.length,
    events: receivedWebhooks,
  });
});

app.post('/clear', (req, res) => {
  receivedWebhooks = [];
  console.log('[Webhook] Events cleared, count:', receivedWebhooks.length);
  res.json({ cleared: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', count: receivedWebhooks.length });
});

app.listen(PORT, () => {
  console.log('[Webhook Tester] Listening on port', PORT);
  console.log('[Webhook Tester] POST http://localhost:' + PORT + '/ to receive events');
  console.log('[Webhook Tester] GET http://localhost:' + PORT + '/events to view events');
  console.log('[Webhook Tester] POST http://localhost:' + PORT + '/clear to clear events');
});
