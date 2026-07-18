// Durable Object: one live instance per game room.
//
// Holds the room state (persisted to DO storage so it survives hibernation),
// manages the players' WebSocket connections (Hibernation API), and drives the
// countdown -> turn -> reveal timing with a single storage alarm per phase.
import engine from '../server/engine.js';

const COUNTDOWN_MS = Number(globalThis.TT_COUNTDOWN_MS) || 3000;
const REVEAL_MS = Number(globalThis.TT_REVEAL_MS) || 5000;

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async loadRoom() {
    return (await this.state.storage.get('room')) || null;
  }
  async saveRoom(room) {
    await this.state.storage.put('room', room);
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

  async broadcast(room) {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() || {};
      if (!att.playerId) continue;
      this.send(ws, { type: 'state', state: engine.redactStateFor(room, att.playerId) });
    }
  }

  // --- message handling ----------------------------------------------------

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const att = ws.deserializeAttachment() || {};
    let room = await this.loadRoom();
    const now = Date.now();

    switch (msg.type) {
      case 'createRoom': {
        if (!room) {
          const created = engine.createRoom(msg.name);
          room = created.room;
          room.code = att.code || room.code;
          att.playerId = created.player.id;
          ws.serializeAttachment(att);
          this.send(ws, { type: 'joined', code: room.code, playerId: created.player.id });
        } else {
          // Room already exists (someone else hosted this code) — just join.
          if (room.phase !== 'lobby') { this.send(ws, { type: 'error', message: 'That game already started' }); return; }
          const p = engine.addPlayer(room, msg.name);
          att.playerId = p.id;
          ws.serializeAttachment(att);
          this.send(ws, { type: 'joined', code: room.code, playerId: p.id });
        }
        await this.saveRoom(room);
        await this.broadcast(room);
        break;
      }

      case 'joinRoom': {
        if (!room) { this.send(ws, { type: 'error', message: 'Room not found' }); return; }
        if (room.phase !== 'lobby') { this.send(ws, { type: 'error', message: 'That game already started' }); return; }
        const p = engine.addPlayer(room, msg.name);
        att.playerId = p.id;
        ws.serializeAttachment(att);
        this.send(ws, { type: 'joined', code: room.code, playerId: p.id });
        await this.saveRoom(room);
        await this.broadcast(room);
        break;
      }

      case 'rejoin': {
        if (!room || !room.players[msg.playerId]) { this.send(ws, { type: 'error', message: 'Player not found' }); return; }
        room.players[msg.playerId].connected = true;
        att.playerId = msg.playerId;
        ws.serializeAttachment(att);
        this.send(ws, { type: 'joined', code: room.code, playerId: msg.playerId });
        await this.saveRoom(room);
        await this.broadcast(room);
        break;
      }

      case 'leaveRoom': {
        const pid = att.playerId;
        att.playerId = null;
        ws.serializeAttachment(att); // so their imminent socket close is a no-op
        if (!room || !pid || !room.players[pid]) break;

        delete room.players[pid];
        room.order = room.order.filter((id) => id !== pid);
        if (room.hostId === pid) room.hostId = room.order[0] || null; // promote next player

        if (room.order.length === 0) {
          // last one out — free the room (and its code) entirely
          await this.state.storage.deleteAlarm();
          await this.state.storage.deleteAll();
        } else {
          await this.saveRoom(room);
          await this.broadcast(room);
        }
        break;
      }

      case 'guess': {
        if (!room) return;
        const res = engine.applyGuess(room, att.playerId, msg.text);
        this.send(ws, { type: 'guessResult', text: msg.text, ...res });
        if (res.status === 'exact' || res.status === 'close') {
          await this.saveRoom(room);
          await this.broadcast(room);
          if (res.gameOver || res.allSolved) await this.endTurnNow(room, now);
        }
        break;
      }

      // host-only actions
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
          room.countdownEndsAt = now + COUNTDOWN_MS;
          await this.saveRoom(room);
          await this.broadcast(room);
          await this.state.storage.setAlarm(room.countdownEndsAt);
        } else if (msg.type === 'restart') {
          engine.restart(room);
          await this.state.storage.deleteAlarm();
          await this.saveRoom(room);
          await this.broadcast(room);
        } else {
          if (room.phase !== 'lobby') return;
          if (msg.type === 'addTeam') engine.addTeam(room);
          else if (msg.type === 'removeTeam') engine.removeTeam(room, msg.teamId);
          else if (msg.type === 'assignPlayer') engine.assignPlayer(room, msg.playerId, msg.teamId);
          else if (msg.type === 'renameTeam') engine.renameTeam(room, msg.teamId, msg.name);
          else if (msg.type === 'setSettings') engine.setSettings(room, msg);
          await this.saveRoom(room);
          await this.broadcast(room);
        }
        break;
      }
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    const room = await this.loadRoom();
    if (!room) return;
    const pl = att.playerId && room.players[att.playerId];
    if (pl) {
      pl.connected = false;
      await this.saveRoom(room);
      await this.broadcast(room);
    }
  }

  async webSocketError() { /* no-op */ }

  // --- timer / phase transitions (single alarm per phase) ------------------

  async endTurnNow(room, now) {
    engine.endTurn(room);
    if (room.phase === 'gameOver') {
      await this.state.storage.deleteAlarm();
    } else {
      room.revealEndsAt = now + REVEAL_MS;
      await this.state.storage.setAlarm(room.revealEndsAt);
    }
    await this.saveRoom(room);
    await this.broadcast(room);
  }

  async alarm() {
    const room = await this.loadRoom();
    if (!room) return;
    const now = Date.now();

    if (room.phase === 'countdown') {
      engine.activateTurn(room, now + room.settings.turnSeconds * 1000);
      await this.saveRoom(room);
      await this.broadcast(room);
      await this.state.storage.setAlarm(room.turn.deadline);
    } else if (room.phase === 'turn') {
      await this.endTurnNow(room, now);
    } else if (room.phase === 'turnEnd') {
      engine.advanceTurn(room);
      room.countdownEndsAt = now + COUNTDOWN_MS;
      await this.saveRoom(room);
      await this.broadcast(room);
      await this.state.storage.setAlarm(room.countdownEndsAt);
    }
  }
}
