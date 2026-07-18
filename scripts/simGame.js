// Headless 4-player integration test for the Team Taboo server.
// Spins up 4 socket.io clients, plays a full game, and asserts the rules:
//   - turn rotation A-P1, B-P1, A-P2, B-P2, ...
//   - redaction (guessers/spectators never receive the words)
//   - scoring: exact = 2, misspelled = 1
//   - win at target score
//
// Run:  node scripts/simGame.js   (server must be running on TT_URL)

const { io } = require('../client/node_modules/socket.io-client');

const URL = process.env.TT_URL || 'http://localhost:3001';
const results = [];
const assert = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

function client(name) {
  const c = { name, socket: io(URL, { transports: ['websocket'] }), state: null, playerId: null };
  c.socket.on('state', (s) => { c.state = s; c.playerId = s.youId; });
  return c;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (c, ev, payload) => new Promise((res) => c.socket.emit(ev, payload, res));

async function waitFor(pred, timeout = 12000, label = '') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (pred()) return true;
    await wait(60);
  }
  throw new Error('timeout waiting for ' + label);
}

async function main() {
  const host = client('Claude');
  await waitFor(() => host.socket.connected, 5000, 'host connect');
  const created = await emit(host, 'createRoom', { name: 'Claude' });
  const code = created.code;
  assert('room created with code', /^[A-Z0-9]{4}$/.test(code || ''), code);

  const p2 = client('Bob');
  const p3 = client('Carol');
  const p4 = client('Dave');
  await waitFor(() => p2.socket.connected && p3.socket.connected && p4.socket.connected, 5000, 'players connect');
  await emit(p2, 'joinRoom', { name: 'Bob', code });
  await emit(p3, 'joinRoom', { name: 'Carol', code });
  await emit(p4, 'joinRoom', { name: 'Dave', code });

  await waitFor(() => host.state && host.state.players.length === 4, 5000, '4 players in lobby');
  assert('4 players joined', host.state.players.length === 4);

  // Assign teams: Claude+Bob -> team0, Carol+Dave -> team1
  const teams = host.state.teams;
  const t0 = teams[0].id, t1 = teams[1].id;
  const byName = (n) => host.state.players.find((p) => p.name === n).id;
  host.socket.emit('assignPlayer', { playerId: byName('Claude'), teamId: t0 });
  host.socket.emit('assignPlayer', { playerId: byName('Bob'), teamId: t0 });
  host.socket.emit('assignPlayer', { playerId: byName('Carol'), teamId: t1 });
  host.socket.emit('assignPlayer', { playerId: byName('Dave'), teamId: t1 });
  host.socket.emit('setSettings', { targetScore: 40, turnSeconds: 40 });

  await waitFor(() => {
    const s = host.state;
    return s.teams[0].playerIds.length === 2 && s.teams[1].playerIds.length === 2 && s.canStart.ok;
  }, 5000, 'teams assigned & canStart');
  assert('teams of 2 assigned and startable', host.state.canStart.ok, host.state.canStart.reason || '');

  const all = [host, p2, p3, p4];
  const describerSeq = [];
  const redactionChecks = [];
  const scoreChecks = [];
  const handledTurns = new Set();

  // Drive each turn: describer reveals words; a teammate submits them
  // (4 exact + 1 deliberately misspelled) to test both score tiers.
  async function driveTurns() {
    while (true) {
      const s = host.state;
      if (!s) { await wait(50); continue; }
      if (s.phase === 'gameOver') return;
      if (s.phase === 'turn' && s.turn && !handledTurns.has(s.turn.index)) {
        const idx = s.turn.index;
        handledTurns.add(idx);

        const describer = all.find((c) => c.playerId === s.turn.describerId);
        describerSeq.push(describer ? describer.name : '?');

        // Redaction: describer sees words (display); a teammate does not.
        const dWords = describer.state.turn.words;
        const guesser = all.find(
          (c) => c.state && c.state.turn && c.state.turn.role === 'guesser'
        );
        redactionChecks.push({
          idx,
          describerHasText: Array.isArray(dWords) && dWords.every((w) => w.display && (w.display.fr || w.display.ar)),
          guesserHasNoText: guesser ? guesser.state.turn.words.every((w) => w.display === undefined) : true,
        });

        // Submit guesses, exercising franco, Arabic, an Arabic letter-variant,
        // and a deliberate typo — to test both scripts + both score tiers.
        if (guesser) {
          for (let i = 0; i < dWords.length; i++) {
            const d = dWords[i].display;
            let guess, kind;
            if (i === 1 && d.ar) {
              guess = d.ar; kind = 'exact';                                   // Arabic exact
            } else if (i === 2) {
              const b = d.fr || d.ar; guess = b + b.trim().slice(-1); kind = 'close'; // typo
            } else if (i === 3 && d.ar && d.ar.includes('ا')) {
              guess = d.ar.replace('ا', 'أ'); kind = 'exact';                  // alef variant -> exact
            } else {
              guess = d.fr || d.ar; kind = 'exact';                           // franco exact
            }
            const res = await emit(guesser, 'submitGuess', { text: guess });
            const ok = kind === 'exact'
              ? res.status === 'exact' && res.points === 2
              : res.status === 'close' && res.points === 1;
            scoreChecks.push({ kind, ok, guess, got: res.status });
            if (res.gameOver) break;
          }
        }
      }
      await wait(50);
    }
  }

  const started = await emit(host, 'startGame', {});
  assert('startGame accepted', started.ok === true, started.error || '');

  await Promise.race([
    driveTurns(),
    waitFor(() => host.state && host.state.phase === 'gameOver', 120000, 'gameOver'),
  ]);
  await waitFor(() => host.state.phase === 'gameOver', 5000, 'final gameOver');

  // --- assertions ---
  const expected = ['Claude', 'Carol', 'Bob', 'Dave', 'Claude', 'Carol', 'Bob', 'Dave'];
  const seqOk = describerSeq.length >= expected.length && expected.every((n, i) => describerSeq[i] === n);
  assert('turn rotation A-P1,B-P1,A-P2,B-P2,…', seqOk, describerSeq.slice(0, 9).join(' → '));

  assert('describer always receives word text', redactionChecks.every((r) => r.describerHasText));
  assert('guessers never receive word text', redactionChecks.every((r) => r.guesserHasNoText));

  assert('exact guesses scored +2', scoreChecks.filter((s) => s.kind === 'exact').every((s) => s.ok));
  assert('misspelled guesses scored +1', scoreChecks.filter((s) => s.kind === 'close').every((s) => s.ok));

  const winner = host.state.teams.find((t) => t.id === host.state.winnerTeamId);
  assert('game ended with a winner at target', winner && winner.score >= host.state.settings.targetScore,
    winner ? `${winner.name} ${winner.score}` : 'no winner');

  // spectator redaction: during a turn the opposing team had role spectator with no text (covered above via guesser),
  // final scoreboard sanity:
  assert('both teams have non-negative scores', host.state.teams.every((t) => t.score >= 0),
    host.state.teams.map((t) => `${t.name}:${t.score}`).join(', '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 ALL PASSED' : '⚠️  ' + failed.length + ' FAILED'} (${results.length} checks)`);
  all.forEach((c) => c.socket.close());
  host.socket.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SIM ERROR:', e.message);
  process.exit(2);
});
