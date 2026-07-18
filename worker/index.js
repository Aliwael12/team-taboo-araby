// Cloudflare Worker entry.
//  - POST/GET /api/new            -> mint a fresh room code
//  - /api/room/:code/ws (upgrade) -> route to that room's Durable Object
//  - everything else              -> serve the built React client (SPA)
import { GameRoom } from './gameRoom.js';

export { GameRoom };

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(len = 4) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  let c = '';
  for (let i = 0; i < len; i++) c += CODE_ALPHABET[a[i] % CODE_ALPHABET.length];
  return c;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/new') {
      return Response.json({ code: genCode(4) }, { headers: { 'cache-control': 'no-store' } });
    }

    const m = path.match(/^\/api\/room\/([A-Za-z0-9]{1,8})\/ws$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      const code = m[1].toUpperCase();
      const id = env.GAME_ROOM.idFromName(code);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // Static client (SPA fallback handled by the assets binding).
    return env.ASSETS.fetch(request);
  },
};
