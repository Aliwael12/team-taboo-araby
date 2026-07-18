// Stress-tests simultaneous guess submissions from multiple teammates:
//   - the same word sent by two players at the same instant -> scores ONCE
//   - different words sent at the same instant -> all score
//   - a rapid mixed volley -> every word scored exactly once, correct total
//   - every ack echoes the client-generated id
// Run against `wrangler dev`:  TT_URL=http://127.0.0.1:8787 node scripts/testConcurrent.js
const BASE = process.env.TT_URL || 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

const results = [];
const assert = (name, cond, extra = '') => { results.push(!!cond); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, timeout = 10000, label = '') {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (pred()) return true; await wait(40); }
  throw new Error('timeout: ' + label);
}

let seq = 0;
function conn(name, code) {
  const c = { name, state: null, playerId: null, acks: [], ws: new WebSocket(`${WS_BASE}/api/room/${code}/ws`), open: false };
  c.ws.addEventListener('open', () => (c.open = true));
  c.ws.addEventListener('message', (ev) => {
    if (ev.data === 'pong') return;
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') c.playerId = m.playerId;
    else if (m.type === 'state') c.state = m.state;
    else if (m.type === 'guessResult') c.acks.push(m);
  });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  c.guess = (text) => { const id = 'c' + (++seq); c.send({ type: 'guess', id, text }); return id; };
  return c;
}

async function main() {
  const { code } = await (await fetch(`${BASE}/api/new`)).json();
  const host = conn('Host', code);
  await waitFor(() => host.open, 5000, 'host open');
  host.send({ type: 'createRoom', name: 'Host' });
  await waitFor(() => host.state, 5000, 'host state');

  const others = ['Bob', 'Carol', 'Dave', 'Eve', 'Fred'].map((n) => conn(n, code));
  await waitFor(() => others.every((c) => c.open), 5000, 'others open');
  others.forEach((c) => c.send({ type: 'joinRoom', name: c.name }));
  await waitFor(() => host.state.players.length === 6 && others.every((c) => c.playerId), 5000, '6 players');

  const t0 = host.state.teams[0].id, t1 = host.state.teams[1].id;
  const byName = (n) => host.state.players.find((p) => p.name === n).id;
  for (const n of ['Host', 'Bob', 'Carol']) host.send({ type: 'assignPlayer', playerId: byName(n), teamId: t0 });
  for (const n of ['Dave', 'Eve', 'Fred']) host.send({ type: 'assignPlayer', playerId: byName(n), teamId: t1 });
  await waitFor(() => host.state.canStart && host.state.canStart.ok, 5000, 'startable');

  host.send({ type: 'startGame' });
  await waitFor(() => host.state.phase === 'ready', 5000, 'ready');
  assert('game starts in ready (manual start)', host.state.phase === 'ready');
  assert('turn 0 describer is Host', host.state.turn.describerId === host.playerId);

  host.send({ type: 'startTurn' });
  await waitFor(() => host.state.phase === 'turn' && host.state.turn.words, 5000, 'turn active');
  assert('describer tap starts the clock', host.state.phase === 'turn' && !!host.state.turn.deadline);

  const words = host.state.turn.words.map((w) => w.display.fr || w.display.ar);
  const bob = others[0], carol = others[1]; // Host's teammates

  // --- A: same word, two players, same instant ---
  const a1 = bob.guess(words[0]);
  const a2 = carol.guess(words[0]);
  await waitFor(() => bob.acks.some((a) => a.id === a1) && carol.acks.some((a) => a.id === a2), 5000, 'A acks');
  const ra1 = bob.acks.find((a) => a.id === a1), ra2 = carol.acks.find((a) => a.id === a2);
  const statuses = [ra1.status, ra2.status].sort();
  assert('same word twice -> one exact + one duplicate', statuses.join(',') === 'duplicate,exact', statuses.join(','));
  assert('ids echoed on acks', ra1.id === a1 && ra2.id === a2);

  // --- B: two different words, same instant ---
  const b1 = bob.guess(words[1]);
  const b2 = carol.guess(words[2]);
  await waitFor(() => bob.acks.some((a) => a.id === b1) && carol.acks.some((a) => a.id === b2), 5000, 'B acks');
  assert(
    'different words simultaneously -> both score',
    bob.acks.find((a) => a.id === b1).status === 'exact' && carol.acks.find((a) => a.id === b2).status === 'exact'
  );

  // --- C: mixed volley on the last two words from both players at once ---
  const ids = [bob.guess(words[3]), carol.guess(words[3]), bob.guess(words[4]), carol.guess(words[4])];
  await waitFor(() => {
    const all = [...bob.acks, ...carol.acks];
    return ids.every((id) => all.some((a) => a.id === id));
  }, 5000, 'C acks');
  const all = [...bob.acks, ...carol.acks];
  const cRes = ids.map((id) => all.find((a) => a.id === id).status);
  const exacts = cRes.filter((s) => s === 'exact').length;
  // Stragglers get 'duplicate' (word already taken) or 'inactive' (their twin
  // guess solved the last word and ended the turn a tick earlier) — both fine;
  // the invariant is each word scores exactly once.
  const stragglers = cRes.filter((s) => s === 'duplicate' || s === 'inactive').length;
  assert('volley: each word scored exactly once', exacts === 2 && stragglers === 2, cRes.join(','));

  // All 5 solved -> turn ends; team score must be exactly 5 * 2 = 10.
  await waitFor(() => host.state.phase === 'turnEnd' || host.state.phase === 'ready' || host.state.phase === 'gameOver', 8000, 'turn end');
  const teamScore = host.state.teams.find((t) => t.id === t0).score;
  assert('team score is exactly 10 (no double-scoring)', teamScore === 10, `score=${teamScore}`);

  [host, ...others].forEach((c) => { try { c.ws.close(); } catch {} });
  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed === 0 ? '🎉 ALL PASSED' : '⚠️  ' + failed + ' FAILED'} (${results.length} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(2); });
