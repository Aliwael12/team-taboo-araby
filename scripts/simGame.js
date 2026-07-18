// Headless 4-player integration test for the Cloudflare Worker + Durable Object.
// Drives 4 native-WebSocket clients through a full game and asserts the rules.
//
// Run against a local `wrangler dev`:
//   TT_URL=http://127.0.0.1:8787 node scripts/simGame.js
// (Node 21+ provides global fetch + WebSocket.)

const BASE = process.env.TT_URL || 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

const results = [];
const assert = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, timeout = 15000, label = '') {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (pred()) return true; await wait(60); }
  throw new Error('timeout waiting for ' + label);
}

function client(name, code) {
  const c = { name, state: null, playerId: null, ws: new WebSocket(`${WS_BASE}/api/room/${code}/ws`), open: false };
  c.ws.addEventListener('open', () => { c.open = true; });
  c.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'joined') c.playerId = msg.playerId;
    else if (msg.type === 'state') c.state = msg.state;
    else if (msg.type === 'guessResult') c.lastGuess = msg;
  });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  return c;
}
const emitGuess = (c, text) =>
  new Promise((res) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.type === 'guessResult' && m.text === text) { c.ws.removeEventListener('message', h); res(m); } };
    c.ws.addEventListener('message', h);
    c.send({ type: 'guess', text });
  });

async function main() {
  const { code } = await (await fetch(`${BASE}/api/new`)).json();
  assert('minted room code', /^[A-Z0-9]{4}$/.test(code || ''), code);

  const host = client('Claude', code);
  await waitFor(() => host.open, 5000, 'host socket open');
  host.send({ type: 'createRoom', name: 'Claude' });
  await waitFor(() => host.state && host.playerId, 5000, 'host joined');

  const p2 = client('Bob', code), p3 = client('Carol', code), p4 = client('Dave', code);
  await waitFor(() => p2.open && p3.open && p4.open, 5000, 'players open');
  p2.send({ type: 'joinRoom', name: 'Bob' });
  p3.send({ type: 'joinRoom', name: 'Carol' });
  p4.send({ type: 'joinRoom', name: 'Dave' });
  await waitFor(() => host.state && host.state.players.length === 4, 5000, '4 players');
  assert('4 players joined', host.state.players.length === 4);

  const t0 = host.state.teams[0].id, t1 = host.state.teams[1].id;
  const byName = (n) => host.state.players.find((p) => p.name === n).id;
  host.send({ type: 'assignPlayer', playerId: byName('Claude'), teamId: t0 });
  host.send({ type: 'assignPlayer', playerId: byName('Bob'), teamId: t0 });
  host.send({ type: 'assignPlayer', playerId: byName('Carol'), teamId: t1 });
  host.send({ type: 'assignPlayer', playerId: byName('Dave'), teamId: t1 });
  host.send({ type: 'setSettings', targetScore: 40, turnSeconds: 40 });
  await waitFor(() => host.state.teams[0].playerIds.length === 2 && host.state.teams[1].playerIds.length === 2 && host.state.canStart.ok, 5000, 'teams ready');
  assert('teams of 2 assigned and startable', host.state.canStart.ok, host.state.canStart.reason || '');

  const all = [host, p2, p3, p4];
  const describerSeq = [];
  const redaction = [];
  const scoreChecks = [];
  const handled = new Set();
  const started = new Set();

  host.send({ type: 'startGame' });

  async function drive() {
    while (true) {
      const s = host.state;
      if (s && s.phase === 'gameOver') return;
      // Manual start: the current describer taps Start to begin the clock.
      if (s && s.phase === 'ready' && s.turn && !started.has(s.turn.index)) {
        started.add(s.turn.index);
        const d = all.find((c) => c.playerId === s.turn.describerId);
        if (d) d.send({ type: 'startTurn' });
      }
      if (s && s.phase === 'turn' && s.turn && !handled.has(s.turn.index)) {
        const idx = s.turn.index;
        handled.add(idx);
        const describer = all.find((c) => c.playerId === s.turn.describerId);
        describerSeq.push(describer ? describer.name : '?');
        const dWords = describer.state.turn.words;
        const guesser = all.find((c) => c.state && c.state.turn && c.state.turn.role === 'guesser');
        const spectator = all.find((c) => c.state && c.state.turn && c.state.turn.role === 'spectator');
        redaction.push({
          describerHasText: Array.isArray(dWords) && dWords.every((w) => w.display && (w.display.fr || w.display.ar)),
          guesserNoText: guesser ? guesser.state.turn.words.every((w) => w.display === undefined) : true,
          spectatorHasText: spectator ? (spectator.state.turn.words || []).length > 0 && spectator.state.turn.words.every((w) => w.display) : false,
        });
        if (guesser) {
          for (let i = 0; i < dWords.length; i++) {
            const d = dWords[i].display;
            let guess, kind;
            if (i === 1 && d.ar) { guess = d.ar; kind = 'exact'; }
            else if (i === 2) { const b = d.fr || d.ar; guess = b + b.trim().slice(-1); kind = 'close'; }
            else if (i === 3 && d.ar && d.ar.includes('ا')) { guess = d.ar.replace('ا', 'أ'); kind = 'exact'; }
            else { guess = d.fr || d.ar; kind = 'exact'; }
            const res = await emitGuess(guesser, guess);
            scoreChecks.push({ kind, ok: kind === 'exact' ? res.status === 'exact' && res.points === 2 : res.status === 'close' && res.points === 1 });
            if (res.gameOver) break;
          }
        }
      }
      await wait(50);
    }
  }

  await Promise.race([drive(), waitFor(() => host.state && host.state.phase === 'gameOver', 120000, 'gameOver')]);
  await waitFor(() => host.state.phase === 'gameOver', 5000, 'final gameOver');

  const expected = ['Claude', 'Carol', 'Bob', 'Dave', 'Claude', 'Carol', 'Bob', 'Dave'];
  assert('turn rotation A-P1,B-P1,A-P2,B-P2,…', describerSeq.length >= expected.length && expected.every((n, i) => describerSeq[i] === n), describerSeq.slice(0, 9).join(' → '));
  assert('describer always receives words', redaction.every((r) => r.describerHasText));
  assert('guessers never receive words', redaction.every((r) => r.guesserNoText));
  assert('opposing team sees the words', redaction.every((r) => r.spectatorHasText));
  assert('exact guesses scored +2', scoreChecks.filter((s) => s.kind === 'exact').every((s) => s.ok));
  assert('misspelled guesses scored +1', scoreChecks.filter((s) => s.kind === 'close').every((s) => s.ok));
  const winner = host.state.teams.find((t) => t.id === host.state.winnerTeamId);
  assert('game ended with a winner at target', winner && winner.score >= host.state.settings.targetScore, winner ? `${winner.name} ${winner.score}` : 'none');

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed === 0 ? '🎉 ALL PASSED' : '⚠️  ' + failed + ' FAILED'} (${results.length} checks)`);
  all.forEach((c) => { try { c.ws.close(); } catch {} });
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SIM ERROR:', e.message); process.exit(2); });
