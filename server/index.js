// Team Taboo — realtime server (Express + Socket.io).
//
// Serves the built client (in production) and runs every game room's
// authoritative state machine + clock.

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const engine = require('./engine');

const PORT = process.env.PORT || 3001;
const COUNTDOWN_MS = Number(process.env.TT_COUNTDOWN_MS) || 3000;   // "get ready" before each turn
const TURN_END_MS = Number(process.env.TT_TURN_END_MS) || 5000;     // reveal words between turns

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ['GET', 'POST'] } });

const rooms = new Map();        // CODE -> room
const timers = new Map();       // CODE -> { timeout, interval }
const sockets = new Map();      // socket.id -> { code, playerId }

const getRoom = (code) => rooms.get(String(code || '').toUpperCase());

// --- broadcasting --------------------------------------------------------

// Send each connected player their own redacted view of the room.
function broadcast(room) {
  for (const p of Object.values(room.players)) {
    if (!p.socketId) continue;
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('state', engine.redactStateFor(room, p.id));
  }
}

function clearTimers(code) {
  const t = timers.get(code);
  if (!t) return;
  if (t.timeout) clearTimeout(t.timeout);
  if (t.interval) clearInterval(t.interval);
  timers.delete(code);
}

// --- turn cycle ----------------------------------------------------------
// countdown (COUNTDOWN_MS) -> turn (per-second tick) -> reveal (TURN_END_MS) -> next

function runTurnCycle(room) {
  const code = room.code;
  clearTimers(code);
  broadcast(room); // countdown phase (set by setupTurn/startGame)

  const handle = {};
  timers.set(code, handle);
  handle.timeout = setTimeout(() => {
    engine.activateTurn(room);
    broadcast(room);
    handle.interval = setInterval(() => {
      const r = engine.tick(room);
      if (r === 'running') {
        io.to(code).emit('tick', { remaining: room.turn.remaining });
      } else if (r === 'expired') {
        finishTurn(room);
      }
    }, 1000);
  }, COUNTDOWN_MS);
}

function finishTurn(room) {
  const code = room.code;
  clearTimers(code);
  engine.endTurn(room);
  broadcast(room);
  if (room.phase === 'gameOver') return;

  const handle = {};
  timers.set(code, handle);
  handle.timeout = setTimeout(() => {
    engine.advanceTurn(room);
    runTurnCycle(room);
  }, TURN_END_MS);
}

// --- host-only mutation helper ------------------------------------------

function hostAction(socket, fn, { anyPhase = false } = {}) {
  const ctx = sockets.get(socket.id);
  const room = ctx && getRoom(ctx.code);
  if (!room || room.hostId !== ctx.playerId) return;
  if (!anyPhase && room.phase !== 'lobby') return;
  fn(room);
  broadcast(room);
}

// --- connection handling -------------------------------------------------

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name } = {}, cb) => {
    const { room, player } = engine.createRoom(name);
    rooms.set(room.code, room);
    player.socketId = socket.id;
    socket.join(room.code);
    sockets.set(socket.id, { code: room.code, playerId: player.id });
    cb && cb({ ok: true, code: room.code, playerId: player.id });
    broadcast(room);
  });

  socket.on('joinRoom', ({ code, name } = {}, cb) => {
    const room = getRoom(code);
    if (!room) return cb && cb({ error: 'Room not found' });
    if (room.phase !== 'lobby') return cb && cb({ error: 'That game already started' });
    const player = engine.addPlayer(room, name);
    player.socketId = socket.id;
    socket.join(room.code);
    sockets.set(socket.id, { code: room.code, playerId: player.id });
    cb && cb({ ok: true, code: room.code, playerId: player.id });
    broadcast(room);
  });

  // Reconnect an existing player (page refresh / dropped connection).
  socket.on('rejoin', ({ code, playerId } = {}, cb) => {
    const room = getRoom(code);
    if (!room) return cb && cb({ error: 'Room not found' });
    const p = room.players[playerId];
    if (!p) return cb && cb({ error: 'Player not found' });
    p.connected = true;
    p.socketId = socket.id;
    socket.join(room.code);
    sockets.set(socket.id, { code: room.code, playerId });
    cb && cb({ ok: true, code: room.code, playerId });
    broadcast(room);
  });

  // Host lobby controls
  socket.on('addTeam', () => hostAction(socket, (room) => engine.addTeam(room)));
  socket.on('removeTeam', ({ teamId } = {}) => hostAction(socket, (room) => engine.removeTeam(room, teamId)));
  socket.on('assignPlayer', ({ playerId, teamId } = {}) => hostAction(socket, (room) => engine.assignPlayer(room, playerId, teamId)));
  socket.on('renameTeam', ({ teamId, name } = {}) => hostAction(socket, (room) => engine.renameTeam(room, teamId, name)));
  socket.on('setSettings', (payload = {}) => hostAction(socket, (room) => engine.setSettings(room, payload)));

  socket.on('startGame', (_payload, cb) => {
    const ctx = sockets.get(socket.id);
    const room = ctx && getRoom(ctx.code);
    if (!room || room.hostId !== ctx.playerId) return cb && cb({ error: 'Only the host can start' });
    const chk = engine.startGame(room);
    if (!chk.ok) return cb && cb({ error: chk.reason });
    cb && cb({ ok: true });
    runTurnCycle(room);
  });

  socket.on('restart', () => hostAction(socket, (room) => {
    clearTimers(room.code);
    engine.restart(room);
  }, { anyPhase: true }));

  socket.on('submitGuess', ({ text } = {}, cb) => {
    const ctx = sockets.get(socket.id);
    const room = ctx && getRoom(ctx.code);
    if (!room) return;
    const res = engine.applyGuess(room, ctx.playerId, text);
    cb && cb(res);
    socket.emit('guessResult', { text, ...res });
    if (res.status === 'exact' || res.status === 'close') {
      broadcast(room);
      if (res.gameOver || res.allSolved) finishTurn(room);
    }
  });

  socket.on('disconnect', () => {
    const ctx = sockets.get(socket.id);
    sockets.delete(socket.id);
    if (!ctx) return;
    const room = getRoom(ctx.code);
    if (!room) return;
    const p = room.players[ctx.playerId];
    if (p) {
      p.connected = false;
      if (p.socketId === socket.id) p.socketId = null;
    }
    broadcast(room);
  });
});

// --- housekeeping: drop stale rooms --------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyConnected = Object.values(room.players).some((p) => p.connected);
    const ageMs = now - room.createdAt;
    if (!anyConnected && ageMs > 60 * 60 * 1000) {
      clearTimers(code);
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000).unref();

// --- static client (production build) ------------------------------------

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('Team Taboo server running. Build the client with `npm run build`.'));
}

server.listen(PORT, () => console.log(`Team Taboo server listening on :${PORT}`));
