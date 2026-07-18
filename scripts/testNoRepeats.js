// Proves the dealer never repeats a word until the whole pool is exhausted —
// within a game, across rematches in the same room, and that even after a
// full-pool reshuffle the most recent words are held back.
// Pure engine test (no server needed). Run: node scripts/testNoRepeats.js
const engine = require('../server/engine');

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

const poolSize = engine.fullPool().length;
console.log(`Pool size: ${poolSize}\n`);

// Build a startable 4-player room.
function makeRoom() {
  const { room } = engine.createRoom('Host');
  const b = engine.addPlayer(room, 'Bob');
  const c = engine.addPlayer(room, 'Carol');
  const d = engine.addPlayer(room, 'Dave');
  const [t0, t1] = room.teams;
  engine.assignPlayer(room, room.hostId, t0.id);
  engine.assignPlayer(room, b.id, t0.id);
  engine.assignPlayer(room, c.id, t1.id);
  engine.assignPlayer(room, d.id, t1.id);
  return room;
}

const keyOf = (w) => w.display.fr || w.display.ar;
const turnWords = (room) => room.turn.words.map(keyOf);

// --- 1) No repeats until the pool is exhausted -----------------------------
const room = makeRoom();
engine.startGame(room);

const seen = new Map(); // word -> first turn index
let repeatsBeforeExhaustion = 0;
const fullTurns = Math.floor(poolSize / 5); // turns fully covered by one pool pass
for (let t = 0; t < fullTurns; t++) {
  for (const w of turnWords(room)) {
    if (seen.has(w)) repeatsBeforeExhaustion++;
    else seen.set(w, t);
  }
  engine.advanceTurn(room);
}
assert(
  `no repeats across ${fullTurns} turns (${fullTurns * 5} words)`,
  repeatsBeforeExhaustion === 0,
  repeatsBeforeExhaustion ? `${repeatsBeforeExhaustion} repeats` : `${seen.size} unique`
);

// --- 2) After exhaustion, the last RECENT words are held back --------------
const recentBefore = new Set([...seen.keys()].slice(-55)); // ~last 55 dealt
let recentComebacks = 0;
for (let t = 0; t < 8; t++) { // 40 words right after the reshuffle
  for (const w of turnWords(room)) if (recentBefore.has(w)) recentComebacks++;
  engine.advanceTurn(room);
}
assert('reshuffle holds back recently-played words', recentComebacks === 0,
  recentComebacks ? `${recentComebacks} came straight back` : '40 post-reshuffle words all fresh');

// --- 3) Rematch continues from unseen words --------------------------------
const room2 = makeRoom();
engine.startGame(room2);
const game1 = new Set();
for (let t = 0; t < 6; t++) { // 30 words in game 1
  for (const w of turnWords(room2)) game1.add(w);
  engine.advanceTurn(room2);
}
engine.restart(room2);
engine.startGame(room2);
let rematchOverlap = 0;
for (let t = 0; t < 6; t++) { // 30 words in the rematch
  for (const w of turnWords(room2)) if (game1.has(w)) rematchOverlap++;
  engine.advanceTurn(room2);
}
assert('rematch deals words the group has not seen', rematchOverlap === 0,
  rematchOverlap ? `${rematchOverlap} overlapped` : '30 rematch words all new');

// --- 4) Two different rooms get different shuffles -------------------------
const rA = makeRoom(); engine.startGame(rA);
const rB = makeRoom(); engine.startGame(rB);
const firstA = turnWords(rA).join('|');
const firstB = turnWords(rB).join('|');
assert('independent rooms shuffle independently', firstA !== firstB);

console.log(`\n${fail === 0 ? '🎉 ALL PASSED' : '⚠️  ' + fail + ' FAILED'} (${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);
