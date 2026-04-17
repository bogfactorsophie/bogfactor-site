export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const preflightOrigin = request.headers.get('Origin') || '';
      const preflightAllowed = ['https://bogfactor.co.uk', 'https://www.bogfactor.co.uk'].includes(preflightOrigin)
        || preflightOrigin.endsWith('.pages.dev');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': preflightAllowed ? preflightOrigin : 'https://bogfactor.co.uk',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }

    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = ['https://bogfactor.co.uk', 'https://www.bogfactor.co.uk'];
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.pages.dev');
    const corsOrigin = isAllowed ? origin : allowedOrigins[0];

    try {
      const { name, email, message } = await request.json();

      // Basic validation
      if (!name || !email || !message) {
        return new Response(JSON.stringify({ error: 'All fields are required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
          }
        });
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Bog Factor Contact <contact@bogfactor.co.uk>',
          to: 'hello@bogfactor.co.uk',
          reply_to: email,
          subject: `Message from ${name}`,
          text: `From: ${name} <${email}>\n\n${message}`
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Resend API error:', err);
        return new Response(JSON.stringify({ error: 'Failed to send' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
          }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        }
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        }
      });
    }
  }
};
