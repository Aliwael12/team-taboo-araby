# 🎯 Team Taboo

A realtime, mobile-first party game: describe words to your teammates without
saying them, while they race to type the words into their scratchpad before the
clock runs out. First team to the target score wins.

Built with **Node + Express + Socket.io** (authoritative server) and a
**React + Tailwind** client, packaged as one deployable app.

## How it plays

- One person **hosts** a game → gets a room **code**, **link**, and **QR code**.
- Others join by entering the code, tapping the link, or scanning the QR (the
  link/QR are the "key" — no typing needed).
- The **host assigns players to teams** (2+ teams, min 4 players, each team
  needs at least 2 so a describer always has teammates to guess).
- Turns rotate **automatically**: team A player 1 → team B player 1 →
  team A player 2 → team B player 2 → … (each team cycles its own roster, so
  uneven team sizes are fine). The host is a normal player once the game starts.
- On your turn you get **5 words** and **40 seconds**. Your teammates don't see
  the words — they type guesses into a scratchpad (Enter after each; unlimited
  guesses).
  - **Exact word → +2 points**
  - **Right word, misspelled → +1 point** (smart length-scaled fuzzy match)
- **Bilingual (franco + Arabic):** every title is accepted in both Latin/franco
  and Arabic script, with Arabic normalization (أ/ا, ة/ه, ى/ي, tashkeel, Arabic
  digits) — so a teammate can type in either script and score.
- All word lists are merged into one pool and reshuffled as turns are dealt.
- **First team to 40 points wins** (target score + turn length are adjustable in
  the lobby).

## Architecture

Runs entirely on **Cloudflare Workers** (free tier, no credit card):

- The **Worker** ([`worker/index.js`](worker/index.js)) serves the built React
  client and routes WebSocket upgrades.
- Each game room is one **Durable Object** ([`worker/gameRoom.js`](worker/gameRoom.js))
  that holds the players' WebSocket connections + game state and drives the
  countdown → turn → reveal timing with a single storage **alarm** per phase.
- The game logic ([`server/engine.js`](server/engine.js),
  [`server/matching.js`](server/matching.js), word lists) is plain,
  runtime-agnostic JavaScript shared by the Worker.

No database, no always-on server, no card.

## Run locally (development)

```bash
npm install            # installs wrangler
npm run dev            # builds the client + runs `wrangler dev` on :8787
```

Open http://127.0.0.1:8787. To test with real phones on the same Wi-Fi, run
`wrangler dev --ip 0.0.0.0` and open `http://<your-computer-ip>:8787` on each phone.

## Deploy (free, no card, always-on)

```bash
npx wrangler login     # opens the browser once to auth your free Cloudflare account
npm run deploy         # builds the client + `wrangler deploy`
```

You'll get a permanent `https://team-taboo-araby.<your-subdomain>.workers.dev`
URL that runs 24/7 with no laptop and no card. Durable Objects are used via the
**SQLite backend** (`new_sqlite_classes`), which is included on the Workers Free
plan.

## Add your own words

Edit [`server/data/wordLists.js`](server/data/wordLists.js). Each list has a
`category` (for organization only) and `entries`, where every entry accepts
guesses in both scripts:

```js
{ fr: 'El kebeer', ar: 'الكبير أوي', accept: ['optional extra spellings'] }
```

All lists are merged into one shuffled pool; duplicates across lists (by
normalized franco or Arabic) are removed automatically.

## Tests

```bash
npm test                                       # normalization + bilingual scoring unit tests
# full 4-player game sim against a running `wrangler dev`:
TT_URL=http://127.0.0.1:8787 node scripts/simGame.js
```

## Project layout

```
worker/
  index.js        Worker entry: mint room codes, route WS upgrades, serve the client
  gameRoom.js     Durable Object: one per room (sockets + state + alarm-based timer)
server/
  engine.js       Game state: rooms, teams, turn rotation, scoring, per-player redaction
  matching.js     Franco + Arabic normalization and fuzzy scoring (2pt exact / 1pt close)
  data/wordLists.js  Bilingual word lists (franco + Arabic)
client/
  src/App.jsx     Screen router
  src/lib/useGame.js  WebSocket client hook
  src/screens/    Home, Lobby, Countdown, Turn, TurnEnd, GameOver
  src/components/  Backdrop, Timer, Scoreboard, Share (code/link/WhatsApp/QR)
wrangler.toml     Worker + Durable Object + static-assets config
```
