// Team Taboo game engine — pure(ish) state transitions.
//
// All timing side effects (the 40s clock, the between-turn pauses) live in
// index.js; this module only mutates room state and answers "what now?".

const { normalize, scoreGuess } = require('./matching');
const WORD_LISTS = require('./data/wordLists');

// Room-code alphabet without easily-confused characters (no I, L, O, 0, 1).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
const TEAM_NAMES = ['Red Team', 'Blue Team', 'Green Team', 'Amber Team', 'Purple Team', 'Pink Team', 'Teal Team', 'Orange Team'];
const MAX_TEAMS = 8;

// Randomness via the WebCrypto global — works in Node 20+ AND Cloudflare Workers.
// Rejection sampling avoids modulo bias, so shuffles are uniformly random.
function randInt(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const a = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(a); } while (a[0] >= limit);
  return a[0] % maxExclusive;
}
function genId(bytes = 8) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  let s = '';
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, '0');
  return s;
}
function genCode(len = 4) {
  let c = '';
  for (let i = 0; i < len; i++) c += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
  return c;
}

// Flatten every list into one deduped pool of bilingual entries.
// Each pool item: { display: { fr, ar }, forms: [normalized accepted forms] }.
// Built once per isolate and memoized — the word lists are static, and rooms
// only ever store INDICES into this pool (keeps persisted state tiny).
let POOL = null;
function fullPool() {
  if (POOL) return POOL;
  const seen = new Map(); // dedupe key (first normalized form) -> item
  const lists = Array.isArray(WORD_LISTS.lists) ? WORD_LISTS.lists : [];
  for (const list of lists) {
    const entries = (list && Array.isArray(list.entries)) ? list.entries : [];
    for (const e of entries) {
      const fr = e.fr ? String(e.fr).trim() : '';
      const ar = e.ar ? String(e.ar).trim() : '';
      const extra = Array.isArray(e.accept) ? e.accept.map((x) => String(x).trim()).filter(Boolean) : [];
      const rawForms = [fr, ar, ...extra].filter(Boolean);
      const forms = [...new Set(rawForms.map(normalize).filter(Boolean))];
      if (!forms.length) continue;
      const key = forms[0];
      if (seen.has(key)) continue;
      seen.set(key, { display: { fr: fr || null, ar: ar || null }, forms });
    }
  }
  POOL = [...seen.values()];
  return POOL;
}

// How many recently-drawn words to hold back when the deck reshuffles.
const RECENT_MAX = 60;

// A new full deck of pool indices (numbers only — cheap to persist), with the
// most RECENTLY drawn words placed at the BOTTOM (front of the array — we pop
// from the end), so even a reshuffle can't bring a word straight back.
function reshuffledDeck(room) {
  const recent = new Set(Array.isArray(room && room.recent) ? room.recent : []);
  const fresh = [], used = [];
  const size = fullPool().length;
  for (let i = 0; i < size; i++) (recent.has(i) ? used : fresh).push(i);
  return [...shuffle(used), ...shuffle(fresh)];
}

// Fisher–Yates shuffle (returns a new array).
function shuffle(input) {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------------------

function createRoom(hostName) {
  const room = {
    code: genCode(),
    hostId: null,
    phase: 'lobby', // lobby | ready | turn | turnEnd | gameOver
    players: {},    // id -> { id, name, teamId, connected, socketId }
    order: [],      // player ids in join order
    teams: [],      // { id, name, color, score }
    settings: { targetScore: 40, turnSeconds: 40, wordsPerTurn: 5 },
    turnIndex: 0,
    turn: null,
    teamOrder: [],  // [teamId] snapshot at game start (only teams with >=2 players)
    rosters: {},    // teamId -> [playerId] snapshot at game start
    deck: [],       // shuffled pool indices; drawn without replacement, kept across rematches
    recent: [],     // last RECENT_MAX drawn indices (held back on reshuffle)
    winnerTeamId: null,
    createdAt: Date.now(),
  };
  addTeam(room);
  addTeam(room); // start with two empty teams
  const host = addPlayer(room, hostName);
  room.hostId = host.id;
  return { room, player: host };
}

function addTeam(room) {
  if (room.teams.length >= MAX_TEAMS) return null;
  const idx = room.teams.length;
  const team = {
    id: genId(4),
    name: TEAM_NAMES[idx] || `Team ${idx + 1}`,
    color: TEAM_COLORS[idx % TEAM_COLORS.length],
    score: 0,
  };
  room.teams.push(team);
  return team;
}

function removeTeam(room, teamId) {
  if (room.teams.length <= 2) return false; // always keep at least two
  if (!room.teams.some((t) => t.id === teamId)) return false;
  for (const p of Object.values(room.players)) if (p.teamId === teamId) p.teamId = null;
  room.teams = room.teams.filter((t) => t.id !== teamId);
  return true;
}

function renameTeam(room, teamId, name) {
  const t = room.teams.find((x) => x.id === teamId);
  if (!t) return false;
  const clean = String(name || '').trim().slice(0, 24);
  if (clean) t.name = clean;
  return true;
}

function addPlayer(room, name) {
  const clean = String(name || '').trim().slice(0, 20) || 'Player';
  const player = { id: genId(8), name: clean, teamId: null, connected: true, socketId: null };
  room.players[player.id] = player;
  room.order.push(player.id);
  return player;
}

function assignPlayer(room, playerId, teamId) {
  const p = room.players[playerId];
  if (!p) return false;
  if (teamId !== null && !room.teams.some((t) => t.id === teamId)) return false;
  p.teamId = teamId;
  return true;
}

// Player ids currently on a team, preserving join order.
function teamPlayers(room, teamId) {
  return room.order.filter((id) => room.players[id] && room.players[id].teamId === teamId);
}

function setSettings(room, { targetScore, turnSeconds }) {
  if (targetScore != null) room.settings.targetScore = clamp(targetScore, 10, 200);
  if (turnSeconds != null) room.settings.turnSeconds = clamp(turnSeconds, 15, 120);
}

function clamp(n, lo, hi) {
  n = Math.round(Number(n) || 0);
  return Math.max(lo, Math.min(hi, n));
}

// ---------------------------------------------------------------------------
// Starting the game
// ---------------------------------------------------------------------------

// Returns { ok } or { ok:false, reason }.
function canStart(room) {
  const total = Object.keys(room.players).length;
  if (room.teams.length < 2) return { ok: false, reason: 'Need at least 2 teams' };
  if (total < 4) return { ok: false, reason: 'Need at least 4 players to start' };

  const unassigned = Object.values(room.players).filter((p) => !p.teamId);
  if (unassigned.length) return { ok: false, reason: 'Every player must be on a team' };

  let playableTeams = 0;
  for (const t of room.teams) {
    const n = teamPlayers(room, t.id).length;
    if (n === 0) continue; // empty teams are simply skipped
    if (n < 2) return { ok: false, reason: `${t.name} needs at least 2 players` };
    playableTeams++;
  }
  if (playableTeams < 2) return { ok: false, reason: 'Need at least 2 teams of 2+ players' };
  return { ok: true };
}

function startGame(room) {
  const chk = canStart(room);
  if (!chk.ok) return chk;

  room.teamOrder = room.teams
    .filter((t) => teamPlayers(room, t.id).length >= 2)
    .map((t) => t.id);
  room.rosters = {};
  for (const tid of room.teamOrder) room.rosters[tid] = teamPlayers(room, tid);
  for (const t of room.teams) t.score = 0;
  room.turnIndex = 0;
  room.winnerTeamId = null;
  // Keep drawing from the existing deck across rematches — only build one if
  // this room has never dealt (or fully exhausted the pool).
  if (!Array.isArray(room.deck) || room.deck.length === 0) room.deck = reshuffledDeck(room);
  setupTurn(room);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Turn machinery
// ---------------------------------------------------------------------------

// Draw n words WITHOUT replacement. The deck is only rebuilt when the whole
// pool has been dealt, and it persists across rematches in the same room, so
// words cannot repeat until every other word has been seen.
function drawWords(room, n) {
  const pool = fullPool();
  if (!Array.isArray(room.recent)) room.recent = [];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(room.deck) || room.deck.length === 0) room.deck = reshuffledDeck(room);
    const idx = room.deck.pop();
    room.recent.push(idx);
    if (room.recent.length > RECENT_MAX) room.recent.splice(0, room.recent.length - RECENT_MAX);
    const item = pool[idx];
    out.push({ display: item.display, forms: item.forms, solved: false, points: 0, solvedById: null, status: 'open' });
  }
  return out;
}

// Who describes on the given global turn index?
// Teams alternate (round-robin); each team cycles through its own roster
// independently, so uneven team sizes are handled cleanly.
function describerFor(room, turnIndex) {
  const k = room.teamOrder.length;
  const teamId = room.teamOrder[turnIndex % k];
  const pass = Math.floor(turnIndex / k);
  const roster = room.rosters[teamId];
  const describerId = roster[pass % roster.length];
  return { teamId, describerId };
}

function setupTurn(room) {
  // Skip past describers who are no longer in the room (left or kicked) so
  // the game can never get stuck waiting on a ghost.
  let sel = describerFor(room, room.turnIndex);
  let guard = 0;
  while (!room.players[sel.describerId] && guard < 128) {
    room.turnIndex++;
    sel = describerFor(room, room.turnIndex);
    guard++;
  }
  room.turn = {
    index: room.turnIndex,
    teamId: sel.teamId,
    describerId: sel.describerId,
    words: drawWords(room, room.settings.wordsPerTurn),
    deadline: null, // epoch ms when the turn ends; set on activate
  };
  room.phase = 'ready'; // waits for the describer to tap Start
}

// Begin the active guessing window. `deadline` is an epoch-ms timestamp; the
// client derives the countdown from it, and the host DO fires one alarm at it.
function activateTurn(room, deadline) {
  if (!room.turn) return;
  room.turn.deadline = deadline;
  room.phase = 'turn';
}

// A guesser submits a word. Mutates state on a hit. Returns a result describing
// what happened (status: exact|close|duplicate|none|<error>).
function applyGuess(room, playerId, text) {
  if (room.phase !== 'turn' || !room.turn) return { status: 'inactive' };
  const p = room.players[playerId];
  if (!p) return { status: 'inactive' };
  if (playerId === room.turn.describerId) return { status: 'describer' };
  if (p.teamId !== room.turn.teamId) return { status: 'notyourteam' };

  const res = scoreGuess(text, room.turn.words);
  if (res.status === 'exact' || res.status === 'close') {
    const w = room.turn.words[res.index];
    w.solved = true;
    w.status = res.status;
    w.points = res.status === 'exact' ? 2 : 1;
    w.solvedById = playerId;
    const team = room.teams.find((t) => t.id === room.turn.teamId);
    team.score += w.points;
    return {
      status: res.status,
      index: res.index,
      word: w.display.fr || w.display.ar,
      points: w.points,
      teamScore: team.score,
      allSolved: room.turn.words.every((x) => x.solved),
      gameOver: team.score >= room.settings.targetScore,
    };
  }
  return { status: res.status };
}

// End the current turn: either declare a winner or move to the reveal phase.
function endTurn(room) {
  if (room.phase === 'gameOver') return;
  const winner = room.teams.find((t) => t.score >= room.settings.targetScore);
  if (winner) {
    room.winnerTeamId = winner.id;
    room.phase = 'gameOver';
  } else {
    room.phase = 'turnEnd';
  }
}

function advanceTurn(room) {
  if (room.phase === 'gameOver') return;
  room.turnIndex++;
  setupTurn(room);
}

// Back to the lobby, keeping players and team assignments but clearing scores.
// The deck (and recent-words memory) is deliberately KEPT so a rematch keeps
// dealing words the group hasn't seen yet.
function restart(room) {
  room.phase = 'lobby';
  room.turn = null;
  room.turnIndex = 0;
  room.winnerTeamId = null;
  room.teamOrder = [];
  room.rosters = {};
  for (const t of room.teams) t.score = 0;
}

// ---------------------------------------------------------------------------
// Redaction — every socket gets a view tailored to what that player may see.
// The describer sees the words; guessers see only progress; opponents see even
// less. At the reveal (turnEnd) everyone sees the full words + who solved them.
// ---------------------------------------------------------------------------

function roleFor(room, playerId) {
  if (!room.turn) return 'none';
  if (playerId === room.turn.describerId) return 'describer';
  const p = room.players[playerId];
  if (p && p.teamId === room.turn.teamId) return 'guesser';
  return 'spectator';
}

function redactStateFor(room, playerId) {
  const state = {
    code: room.code,
    phase: room.phase,
    serverNow: Date.now(), // lets clients correct for clock skew

    hostId: room.hostId,
    youId: playerId,
    isHost: playerId === room.hostId,
    settings: room.settings,
    players: room.order.map((id) => {
      const p = room.players[id];
      return { id: p.id, name: p.name, teamId: p.teamId, connected: p.connected, isHost: id === room.hostId };
    }),
    teams: room.teams.map((t) => ({
      id: t.id, name: t.name, color: t.color, score: t.score, playerIds: teamPlayers(room, t.id),
    })),
    winnerTeamId: room.winnerTeamId,
    canStart: canStart(room),
    // epoch ms when the reveal phase ends (the 'ready' phase has no clock —
    // it waits for the describer to tap Start).
    phaseEndsAt: room.phase === 'turnEnd' ? room.revealEndsAt : null,
  };

  if (room.turn && (room.phase === 'ready' || room.phase === 'turn' || room.phase === 'turnEnd')) {
    const t = room.turn;
    const team = room.teams.find((x) => x.id === t.teamId);
    const describer = room.players[t.describerId];
    const role = roleFor(room, playerId);
    const reveal = room.phase === 'turnEnd';

    const turn = {
      index: t.index,
      teamId: t.teamId,
      teamName: team && team.name,
      teamColor: team && team.color,
      describerId: t.describerId,
      describerName: (describer && describer.name) || 'A player',
      deadline: t.deadline, // epoch ms; client derives the on-screen clock
      total: t.words.length,
      solvedCount: t.words.filter((w) => w.solved).length,
      role,
    };

    // Words are only revealed once the turn has actually started (not while
    // waiting on the describer to tap Start). The describer and the OPPOSING
    // teams (spectators) see the words + how each was marked; the guessing team
    // sees only progress (they're the ones typing).
    if (room.phase === 'turn' || room.phase === 'turnEnd') {
      if (role === 'describer' || role === 'spectator' || reveal) {
        turn.words = t.words.map((w) => ({
          display: w.display,
          solved: w.solved,
          points: w.points,
          status: w.status,
          solvedByName: w.solvedById ? (room.players[w.solvedById] && room.players[w.solvedById].name) : null,
        }));
      } else {
        turn.words = t.words.map((w) => ({ solved: w.solved }));
      }
    }
    state.turn = turn;
  }

  return state;
}

module.exports = {
  createRoom, addTeam, removeTeam, renameTeam, addPlayer, assignPlayer,
  teamPlayers, setSettings, canStart, startGame, setupTurn, activateTurn,
  applyGuess, endTurn, advanceTurn, restart, redactStateFor, roleFor,
  fullPool,
};
