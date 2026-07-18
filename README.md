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

## Run locally (development)

```bash
npm install            # server deps
npm --prefix client install
npm run dev            # starts server (:3001) + Vite client (:5173)
```

Open http://localhost:5173. To test with real phones on the same Wi-Fi, open
`http://<your-computer-ip>:5173` on each phone (the client auto-connects to the
server on the same host).

## Run as production build

```bash
npm run build          # installs + builds the client into client/dist
npm start              # serves the app + game on :3001  → http://localhost:3001
```

## Deploy (so links/QR work over the internet)

The server keeps a live WebSocket per player, so use a host that runs a
**persistent Node process** (not serverless). Any of these free tiers work:

- **Render** — this repo includes `render.yaml`. Create a new Web Service from
  the repo; build `npm install && npm run build`, start `npm start`.
- **Railway / Fly.io / a VPS** — use the included `Dockerfile`, or set
  build = `npm install && npm run build`, start = `npm start`.

The app listens on `process.env.PORT`. No database required (rooms live in
memory; stale rooms are swept after an hour).

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
npm test               # normalization + bilingual scoring unit tests
node scripts/simGame.js   # full 4-player game simulation (needs a server running)
```

## Project layout

```
server/
  index.js        Express + Socket.io, timer orchestration, static hosting
  engine.js       Authoritative game state: rooms, teams, turn rotation, scoring, redaction
  matching.js     Franco + Arabic normalization and fuzzy scoring (2pt exact / 1pt close)
  data/wordLists.js  Bilingual word lists (franco + Arabic)
client/
  src/App.jsx     Screen router
  src/lib/        socket + useGame hook
  src/screens/    Home, Lobby, Countdown, Turn, TurnEnd, GameOver
  src/components/  Backdrop, Timer, Scoreboard, Share (code/link/WhatsApp/QR)
```
