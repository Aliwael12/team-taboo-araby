import { io } from 'socket.io-client';

// In production the client is served by the game server, so same-origin works.
// In dev, Vite runs on :5173 and the server on :3001 — connect to the same
// hostname the page was loaded from (so phones on the LAN work too).
const URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `http://${location.hostname}:3001` : '');

export const socket = io(URL, { autoConnect: true, transports: ['websocket', 'polling'] });
