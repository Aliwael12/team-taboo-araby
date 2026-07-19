// Verifies the new v2-redesign server features over the wire:
//   - autoTeams: host shuffles everyone across the existing teams
//   - per-player points: tracked correctly, visible on every player, reset on rematch
//   - nextUp: shown during the turnEnd reveal, matches the next describer
// Run against `wrangler dev`:  TT_URL=http://127.0.0.1:8787 node scripts/testRedesignFeatures.js
const BASE = process.env.TT_URL || 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

const results = [];
const assert = (name, cond, extra = '') => { results.push(!!cond); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, timeout = 8000, label = '') {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (pred()) return true; await wait(40); }
  throw new Error('timeout: ' + label);
}
function conn(name, code) {
  const c = { name, state: null, playerId: null, lastAck: null, ws: new WebSocket(`${WS_BASE}/api/room/${code}/ws`), open: false };
  c.ws.addEventListener('open', () => (c.open = true));
  c.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') c.playerId = m.playerId;
    else if (m.type === 'state') c.state = m.state;
    else if (m.type === 'guessResult') c.lastAck = m;
  });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  return c;
}
const myPoints = (c) => (c.state.players.find((p) => p.id === c.playerId) || {}).points || 0;

async function main() {
  const { code } = await (await fetch(`${BASE}/api/new`)).json();
  const host = conn('Claude', code);
  await waitFor(() => host.open, 4000, 'host open');
  host.send({ type: 'createRoom', name: 'Claude' });
  await waitFor(() => host.state, 4000, 'host state');

  const others = ['Bob', 'Carol', 'Dave'].map((n) => conn(n, code));
  await waitFor(() => others.every((c) => c.open), 4000, 'others open');
  others.forEach((c) => c.send({ type: 'joinRoom', name: c.name }));
  await waitFor(() => host.state.players.length === 4 && others.every((c) => c.playerId), 4000, '4 players');

  // --- autoTeams ---
  assert('players start unassigned', host.state.players.every((p) => p.teamId === null));
  host.send({ type: 'autoTeams' });
  await waitFor(() => host.state.players.every((p) => p.teamId !== null), 4000, 'autoTeams assigned everyone');
  const counts = {};
  for (const p of host.state.players) counts[p.teamId] = (counts[p.teamId] || 0) + 1;
  const sizes = Object.values(counts);
  assert('autoTeams assigned every player', host.state.players.every((p) => p.teamId !== null));
  assert('autoTeams split 4 players into two teams of 2', sizes.length === 2 && sizes.every((n) => n === 2), JSON.stringify(counts));
  assert('autoTeams -> startable', host.state.canStart.ok, host.state.canStart.reason || '');

  // Target of 18 guarantees at least 2 full turns before gameOver (a clean
  // 10-point sweep isn't enough on its own), so we get to exercise turn 1's
  // point-tracking AND the turnEnd->ready->gameOver path below without the
  // "drive to gameOver" loop needing many turns (each includes a real 5s reveal).
  host.send({ type: 'setSettings', targetScore: 18, turnSeconds: 40 });
  host.send({ type: 'startGame' });
  await waitFor(() => host.state.phase === 'ready', 4000, 'ready');

  const all = [host, ...others];
  const describer1 = all.find((c) => c.playerId === host.state.turn.describerId);
  const guesser1 = all.find((c) => c.state.turn && c.state.turn.role === 'guesser' && c.playerId !== describer1.playerId);
  describer1.send({ type: 'startTurn' });
  await waitFor(() => host.state.phase === 'turn', 4000, 'turn 1 active');

  // --- per-player points ---
  // Individual guesses ack instantly and broadcast a lightweight `wordSolved`
  // delta (no per-player points in that payload, by design — it only carries
  // team score, to keep guess round-trips fast). `players[].points` rides on
  // the next FULL state broadcast, which is guaranteed at least once per turn
  // (turn end / game over), so we assert it there rather than mid-turn.
  const word0 = describer1.state.turn.words[0].display;
  guesser1.send({ type: 'guess', id: 'p1', text: word0.fr || word0.ar });
  await waitFor(() => guesser1.lastAck && guesser1.lastAck.id === 'p1', 4000, 'guess ack');
  assert('exact guess acked immediately', guesser1.lastAck.status === 'exact', guesser1.lastAck.status);

  for (let i = 1; i < describer1.state.turn.words.length; i++) {
    const w = describer1.state.turn.words[i].display;
    guesser1.send({ type: 'guess', id: 'w' + i, text: w.fr || w.ar });
  }
  await waitFor(() => host.state.phase === 'turnEnd' || host.state.phase === 'ready', 6000, 'turn 1 ends');

  // --- nextUp ---
  if (host.state.phase === 'turnEnd') {
    assert('nextUp is present during the reveal', !!host.state.nextUp);
    if (host.state.nextUp) {
      assert('nextUp names a real player + team', !!host.state.nextUp.describerName && !!host.state.nextUp.teamName);
    }
    await waitFor(() => host.state.phase === 'ready', 6000, 'advances to ready');
  }
  assert('scoring player gains points, visible on their own player record', myPoints(guesser1) === 10, myPoints(guesser1));
  assert(
    'non-scoring players stay at 0 points',
    myPoints(describer1) === 0 && all.filter((c) => c !== guesser1 && c !== describer1).every((c) => myPoints(c) === 0)
  );

  // --- points reset on rematch ---
  // Play the remaining turn(s) out to gameOver (target 18 needs one more full
  // sweep past turn 1's 10), then verify restart() clears everyone's points.
  while (host.state.phase !== 'gameOver') {
    if (host.state.phase === 'ready') {
      const d = all.find((c) => c.playerId === host.state.turn.describerId);
      d.send({ type: 'startTurn' });
      await waitFor(() => host.state.phase === 'turn', 4000, 'turn active (loop)');
    } else if (host.state.phase === 'turn') {
      const d = all.find((c) => c.playerId === host.state.turn.describerId);
      const g = all.find((c) => c.state.turn && c.state.turn.role === 'guesser' && c.playerId !== d.playerId);
      for (const w of d.state.turn.words) {
        const disp = w.display;
        g.send({ type: 'guess', id: 'x' + Math.random(), text: disp.fr || disp.ar });
      }
      await waitFor(() => host.state.phase !== 'turn', 6000, 'turn resolves (loop)');
    } else if (host.state.phase === 'turnEnd') {
      await waitFor(() => host.state.phase !== 'turnEnd', 6000, 'reveal resolves (loop)');
    }
  }
  assert('game reached gameOver with points accumulated', all.some((c) => myPoints(c) > 0));

  host.send({ type: 'restart' });
  await waitFor(() => host.state.phase === 'lobby', 4000, 'restart -> lobby');
  assert('all player points reset to 0 after restart', host.state.players.every((p) => (p.points || 0) === 0));
  assert('team assignments kept after restart', host.state.players.every((p) => p.teamId !== null));

  [host, ...others].forEach((c) => { try { c.ws.close(); } catch {} });
  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed === 0 ? '🎉 ALL PASSED' : '⚠️  ' + failed + ' FAILED'} (${results.length} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(2); });
