// Durable Object: one live instance per game room.
//
// Performance model:
//   - Room state lives IN MEMORY (this.room); it's loaded once per wake via
//     blockConcurrencyWhile and persisted as one small blob (the word deck is
//     just pool indices, so writes are a few KB, not the whole word list).
//   - Guess acks are sent IMMEDIATELY, before any storage write.
//   - Scoring updates go out as tiny `wordSolved` deltas; full redacted-state
//     broadcasts happen only on phase changes / roster changes.
//   - `ping` frames are auto-answered with `pong` by the runtime without waking
//     the object (WebSocket hibernation stays cheap).
import engine from '../server/engine.js';

const REVEAL_MS = 5000;

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = null;
    // Load persisted state before any event is delivered.
    state.blockConcurrencyWhile(async () => {
      this.room = (await state.storage.get('room')) || null;
    });
    // Heartbeats answered by the runtime, no handler invocation needed.
    try {
      this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch { /* older runtimes */ }
  }

  persist() {
    return this.state.storage.put('room', this.room);
  }

  // --- WebSocket lifecycle -------------------------------------------------

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const url = new URL(request.url);
    const code = (url.pathname.match(/\/api\/room\/([^/]+)\/ws/) || [])[1];
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server); // hibernatable
    server.serializeAttachment({ playerId: null, code: (code || '').toUpperCase() });
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch { /* socket gone */ }
  }

  // Full redacted state to every seated player (phase/roster changes only).
  broadcast() {
    const room = this.room;
    if (!room) return;
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() || {};
      if (!att.playerId || !room.players[att.playerId]) continue;
      this.send(ws, { type: 'state', state: engine.redactStateFor(room, att.playerId) });
    }
  }

  // Small identical event to every seated player (no per-player redaction).
  broadcastEvent(obj) {
    const room = this.room;
    if (!room) return;
    const payload = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() || {};
      if (!att.playerId || !room.players[att.playerId]) continue;
      try { ws.send(payload); } catch { /* socket gone */ }
    }
  }

  // --- message handling ----------------------------------------------------

  async webSocketMessage(ws, raw) {
    if (raw === 'ping') { try { ws.send('pong'); } catch {} return; } // fallback if auto-response unavailable
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const att = ws.deserializeAttachment() || {};
    const room = this.room;
    const now = Date.now();

    switch (msg.type) {
      case 'createRoom': {
        if (!room) {
          const created = engine.createRoom(msg.name);
          this.room = created.room;
          this.room.code = att.code || this.room.code;
          att.playerId = created.player.id;
          ws.serializeAttachment(att);
          this.send(ws, { type: 'joined', code: this.room.code, playerId: created.player.id });
        } else {
          // Room already exists on this code — treat as a join.
          if (room.phase !== 'lobby') { this.send(ws, { type: 'error', message: 'That game already started' }); return; }
          const p = engine.addPlayer(room, msg.name);
          att.playerId = p.id;
          ws.serializeAttachment(att);
          this.send(ws, { type: 'joined', code: room.code, playerId: p.id });
        }
        this.broadcast();
        await this.persist();
        break;
      }

      case 'joinRoom': {
        if (!room) { this.send(ws, { type: 'error', message: 'Room not found' }); return; }
        if (room.phase !== 'lobby') { this.send(ws, { type: 'error', message: 'That game already started' }); return; }
        const p = engine.addPlayer(room, msg.name);
        att.playerId = p.id;
        ws.serializeAttachment(att);
        this.send(ws, { type: 'joined', code: room.code, playerId: p.id });
        this.broadcast();
        await this.persist();
        break;
      }

      case 'rejoin': {
        if (!room || !room.players[msg.playerId]) { this.send(ws, { type: 'error', message: 'Player not found' }); return; }
        // Supersede any older sockets for this player so stale connections
        // can't double-receive or mark them disconnected later.
        for (const other of this.state.getWebSockets()) {
          if (other === ws) continue;
          const a = other.deserializeAttachment() || {};
          if (a.playerId === msg.playerId) {
            a.playerId = null;
            other.serializeAttachment(a);
            try { other.close(4000, 'superseded'); } catch {}
          }
        }
        room.players[msg.playerId].connected = true;
        att.playerId = msg.playerId;
        ws.serializeAttachment(att);
        this.send(ws, { type: 'joined', code: room.code, playerId: msg.playerId });
        this.broadcast();
        await this.persist();
        break;
      }

      case 'guess': {
        if (!room) return;
        const res = engine.applyGuess(room, att.playerId, msg.text);
        // Ack instantly — before any persistence or broadcasting.
        this.send(ws, { type: 'guessResult', id: msg.id, text: msg.text, ...res });
        if (res.status === 'exact' || res.status === 'close') {
          if (res.gameOver || res.allSolved) {
            await this.endTurnNow(now); // single phase broadcast covers the word too
          } else {
            const solver = room.players[att.playerId];
            this.broadcastEvent({
              type: 'wordSolved',
              turnIndex: room.turn.index,
              index: res.index,
              points: res.points,
              status: res.status,
              solvedByName: solver ? solver.name : null,
              teamId: room.turn.teamId,
              teamScore: res.teamScore,
              solvedCount: room.turn.words.filter((w) => w.solved).length,
            });
            await this.persist();
          }
        }
        break;
      }

      case 'startTurn': {
        // Only the player whose turn it is starts the clock.
        if (!room || room.phase !== 'ready' || !room.turn) return;
        if (att.playerId !== room.turn.describerId) return;
        engine.activateTurn(room, now + room.settings.turnSeconds * 1000);
        this.broadcast();
        await this.state.storage.setAlarm(room.turn.deadline);
        await this.persist();
        break;
      }

      case 'skipTurn': {
        // Host escape hatch when the describer is offline/gone.
        if (!room || room.phase !== 'ready' || !room.turn) return;
        if (att.playerId !== room.hostId) return;
        engine.advanceTurn(room);
        this.broadcast();
        await this.persist();
        break;
      }

      case 'leaveRoom': {
        const pid = att.playerId;
        att.playerId = null;
        ws.serializeAttachment(att); // their imminent socket close is a no-op
        if (!room || !pid || !room.players[pid]) break;

        delete room.players[pid];
        room.order = room.order.filter((id) => id !== pid);
        if (room.hostId === pid) room.hostId = room.order[0] || null;

        if (room.order.length === 0) {
          this.room = null;
          await this.state.storage.deleteAlarm();
          await this.state.storage.deleteAll();
        } else {
          // If it was their turn and it hadn't started, hand it to the next player.
          if (room.phase === 'ready' && room.turn && room.turn.describerId === pid) {
            engine.advanceTurn(room);
          }
          this.broadcast();
          await this.persist();
        }
        break;
      }

      case 'kickPlayer': {
        if (!room || att.playerId !== room.hostId) return; // host only
        const target = msg.playerId;
        if (!target || target === room.hostId || !room.players[target]) return;
        delete room.players[target];
        room.order = room.order.filter((id) => id !== target);
        for (const s of this.state.getWebSockets()) {
          const a = s.deserializeAttachment() || {};
          if (a.playerId === target) {
            try { s.send(JSON.stringify({ type: 'kicked' })); } catch {}
            a.playerId = null;
            s.serializeAttachment(a);
          }
        }
        if (room.phase === 'ready' && room.turn && room.turn.describerId === target) {
          engine.advanceTurn(room);
        }
        this.broadcast();
        await this.persist();
        break;
      }

      // host lobby actions
      case 'addTeam':
      case 'removeTeam':
      case 'assignPlayer':
      case 'renameTeam':
      case 'setSettings':
      case 'startGame':
      case 'restart': {
        if (!room || att.playerId !== room.hostId) return;

        if (msg.type === 'startGame') {
          const chk = engine.startGame(room);
          if (!chk.ok) { this.send(ws, { type: 'error', message: chk.reason }); return; }
          // Sits in 'ready' until the first describer taps Start (no alarm).
          this.broadcast();
          await this.persist();
        } else if (msg.type === 'restart') {
          engine.restart(room);
          await this.state.storage.deleteAlarm();
          this.broadcast();
          await this.persist();
        } else {
          if (room.phase !== 'lobby') return;
          if (msg.type === 'addTeam') engine.addTeam(room);
          else if (msg.type === 'removeTeam') engine.removeTeam(room, msg.teamId);
          else if (msg.type === 'assignPlayer') engine.assignPlayer(room, msg.playerId, msg.teamId);
          else if (msg.type === 'renameTeam') engine.renameTeam(room, msg.teamId, msg.name);
          else if (msg.type === 'setSettings') engine.setSettings(room, msg);
          this.broadcast();
          await this.persist();
        }
        break;
      }
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    const room = this.room;
    if (!room) return;
    const pl = att.playerId && room.players[att.playerId];
    if (pl && pl.connected) {
      pl.connected = false;
      this.broadcast();
      await this.persist();
    }
  }

  async webSocketError() { /* close handler does the bookkeeping */ }

  // --- timer / phase transitions (single alarm per phase) ------------------

  async endTurnNow(now) {
    const room = this.room;
    engine.endTurn(room);
    if (room.phase === 'gameOver') {
      await this.state.storage.deleteAlarm();
    } else {
      room.revealEndsAt = now + REVEAL_MS;
      await this.state.storage.setAlarm(room.revealEndsAt);
    }
    this.broadcast();
    await this.persist();
  }

  async alarm() {
    const room = this.room;
    if (!room) return;
    const now = Date.now();

    if (room.phase === 'turn') {
      // Time's up.
      await this.endTurnNow(now);
    } else if (room.phase === 'turnEnd') {
      // Reveal finished — next turn waits in 'ready' for its describer.
      engine.advanceTurn(room);
      this.broadcast();
      await this.persist();
    }
  }
}
