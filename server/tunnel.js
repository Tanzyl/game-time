// Keeps a localtunnel open on a stable subdomain, reconnecting on drops.
// Usage: node server/tunnel.js
const localtunnel = require('localtunnel');

const PORT = process.env.PORT || 4560;
const SUBDOMAIN = process.env.TUNNEL_NAME || 'gametime-play';

async function connect() {
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    console.log(`[${new Date().toLocaleTimeString()}] TUNNEL UP: ${tunnel.url}`);
    if (!tunnel.url.includes(SUBDOMAIN)) {
      console.log(`(requested name taken — got a random one this time)`);
    }
    tunnel.on('close', () => {
      console.log(`[${new Date().toLocaleTimeString()}] tunnel dropped, reconnecting in 3s...`);
      setTimeout(connect, 3000);
    });
    tunnel.on('error', () => tunnel.close());
  } catch (e) {
    console.log(`connect failed (${e.message}), retrying in 5s...`);
    setTimeout(connect, 5000);
  }
}

connect();
