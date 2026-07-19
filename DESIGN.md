# Team Taboo — "Sahra" Design Specification

**Version 2.0 · the complete visual + interaction system for the game**

---

## 1. Concept

**Sahra (سهرة)** — an Egyptian night out. The game's content is Egyptian street
culture (films, mahraganat, koshary, el bawab, el aragoz), so the design
language is built from the same world instead of a generic "dark neon app":

- The warm dark of an **ahwa at night** — coffee-brown ink, not blue-black.
- **Brass and gold** of trays, lanterns and vintage movie-poster titling.
- **Teal** of painted ahwa woodwork; **rose/chili** from mahraganat posters.
- A faint **khayamiya (tentmaker) star pattern** as the room's "wallpaper".
- Chunky, poster-style type that renders **Arabic as beautifully as Latin** —
  the game is bilingual; the type must be too.

Design attitude: *premium street-pop*. Warm, loud where it matters (turns,
wins), calm everywhere else. Every effect must earn its GPU cost.

---

## 2. Foundations

### 2.1 Color tokens

| Token | Hex | Use |
|---|---|---|
| `night-950` | `#120D0B` | App background |
| `night-900` | `#1B1512` | Cards / surfaces |
| `night-800` | `#241C17` | Raised surfaces, inputs |
| `night-700` | `#2F251E` | Borders, dividers (usually at 60–100%) |
| `sand` | `#F4E8D8` | Primary text ("papyrus") |
| `sand` @ 65 / 45 / 30% | — | Secondary / tertiary / disabled text |
| `brass` | `#E8A33D` | Primary actions, highlights |
| `brass-bright` | `#FFC46B` | Gradient tops, hovers |
| `teal` | `#2EC4B6` | Timers, guesser identity, links |
| `mint` | `#5FD68A` | Success, +2 exact |
| `amber` | `#FFC53D` | +1 close (misspelled), warnings |
| `rose` | `#F25477` | Celebration accents |
| `chili` | `#E4572E` | Danger, last-10-seconds |

**Team colors** (served by the engine, must pop on `night-950`):
`#FF5A5F` red · `#3E92CC` blue · `#5FD68A` green · `#FFC53D` amber ·
`#B07CE8` purple · `#FF7AA2` pink · `#2EC4B6` teal · `#F97316` orange.

Rules: backgrounds never pure black; text never pure white. Accents are used
at full saturation only on interactive/celebratory elements; ambient uses are
tints (`color/15` backgrounds, `color/30` rings).

### 2.2 Typography

| Role | Font | Notes |
|---|---|---|
| Display | **Lalezar** | Chunky poster type with first-class Arabic. Logo, team names, word cards, big numbers, buttons. |
| Body / UI | **Rubik Variable** | Rounded, friendly, full Arabic support. Everything else. |

Both are bundled (`@fontsource`), subset per script, self-hosted — no CDN.
Arabic strings always render `dir="rtl"`; bilingual word cards show franco as
the headline with Arabic beneath it (or Arabic solo, RTL).

Scale (mobile-first): display-xl 40/44 · display-lg 30/34 · title 22/28 ·
body 16/24 · caption 13/18 · overline 11/16 caps +0.2em. Numbers are always
`tabular-nums`.

### 2.3 Shape & elevation

- Radius: cards **24px**, buttons/inputs **16px**, chips **full**.
- Elevation = warm shadow + 1px inner top-light, never pure black shadows:
  `0 12px 32px -14px rgba(0,0,0,.65), inset 0 1px 0 rgba(244,232,216,.06)`.
- Active elements glow in their accent: `0 0 24px -6px <accent>`.

### 2.4 Motion

- Durations: micro 120ms · standard 220ms · screen 320ms · celebratory 600ms.
- Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring) for pops;
  `ease-out` for entrances. **Transform + opacity only** — nothing animates
  layout, filters or box-shadow per-frame.
- Screen changes: fade + 10px lift (`screenIn`).
- List reveals stagger 50ms per item.
- `prefers-reduced-motion`: all decorative animation collapses to opacity.

### 2.5 Sound (synthesized, zero assets)

Tiny WebAudio synth; no files, ~1 KB of code. Muted state persists; a floating
🔊/🔇 control is always reachable in-room. AudioContext unlocks on first tap.

| Event | Sound |
|---|---|
| Turn starts | rising two-note (440→660) |
| Exact guess (+2) | bright triangle pair (660→880) |
| Close guess (+1) | single mid triangle (520) |
| Wrong guess (typer only) | soft low buzz (170) |
| Last 5 seconds | quiet tick each second |
| Turn ends | falling two-note |
| Game won | 4-note fanfare arpeggio |

### 2.6 Haptics

`navigator.vibrate`: 30ms exact · 15ms close · 10ms turn start · [30,40,30] win.
Silently skipped where unsupported.

---

## 3. App shell & backdrop

- `min-height: 100dvh`, safe-area padding, `overscroll-behavior: none`,
  `interactive-widget=resizes-content` so Android keyboards resize, not cover.
- **Backdrop** (one fixed layer, GPU-cheap): `night-950` base, a repeating
  khayamiya 4-point-star SVG tile at ~4% sand opacity, one large radial glow
  that slowly drifts (transform-only, 36s loop) and tints toward the active
  team's color during a game, and a top vignette for status-bar legibility.
  *(Replaces three 90px-blur drifting blobs — dramatically cheaper.)*

---

## 4. Components

- **Button / primary**: brass gradient, `night-950` text, spring press
  (`active:scale-97`), glow shadow. **/ accent**: teal equivalent.
  **/ ghost**: 1px sand/12 border on night-800.
- **Card**: night-900, sand/8 border, warm shadow. **Card-soft**: night-800,
  lighter border, for dense lists.
- **Chip**: pill, caption size; tinted background at 15% of its accent.
- **Timer**: self-ticking ring (derives from server deadline + clock offset —
  only the ring re-renders). Brass→teal gradient stroke; turns chili and
  pulses at ≤10s; ticks audibly at ≤5s.
- **ScoreStrip** *(new)*: one-line live scores pinned during turns — a colored
  dot + tabular score per team, active team ringed. All roles always know the
  score.
- **PointsBadge**: mint `+2` / amber `+1 ~`.
- **PlayerPill**: name token; host sees a kick ✕ affordance on others.
- **Share panel**: room code in display type, copy/WhatsApp/QR actions, native
  `navigator.share` when available.
- **Floating controls** in-room: mute (top-right), leave (bottom-left) —
  small, blurred, out of thumb-flow.

---

## 5. Screens

### Home
Poster-style hero: Lalezar wordmark with brass underline sweep, one-line
pitch, name field, then two decisive actions (Host = brass primary,
Join = ghost with code field). Collapsible 3-line "how to play". Error state
is an inline chili card, never an alert.

### Lobby
1. Share card first (code is the lobby's job #1).
2. Teams as cards: color spine, editable name (host), member pills,
   ready state (`✓` at 2+), add/remove team.
3. Unassigned players + **🎲 Auto teams** (host): shuffles everyone into
   balanced teams in one tap.
4. Host footer: win-score / seconds steppers + big Start button that
   explains itself when disabled ("Need at least 4 players").
Non-hosts see their team status and a live "waiting" pulse.

### Ready (pre-turn)
Full-screen focus card: team color wash, "Next up" overline, team name in
display type, describer headline. The **describer** gets one giant pulsing
brass "▶ Start my turn" (spring pop-in, sound-unlocks on tap); everyone else
gets a calm waiting pulse + the current score strip. Host sees a skip
control if the describer is offline.

### Turn — Describer
Timer + solved counter header, score strip, then the 5 word cards in display
type (franco + Arabic). Solved cards shrink, dim, strike through and show
who got them; unsolved stay big. Chili edge-glow on the whole screen in the
last 10 seconds.

### Turn — Guesser
Header: role chip, describer name, found counter, prominent timer. Progress
dots. Scratchpad list of guesses: optimistic `…` pending → verdict
(`✅ +2` / `🟡 +1` / `already got` / `❌`), spring pop per entry, confetti +
flash + haptic on hits. Sticky input with send button; empty state teaches
"**franco or عربي — both count**". Input never loses focus; double-Enter
swallowed.

### Turn — Spectator
Same word cards as the describer (opposing team watches the round live),
timer + score strip, "Watching <team>" chip in the team's color.

### Turn end (reveal)
"+N this turn" headline in team color, all 5 words with per-word outcomes
and who solved them (staggered reveal), full scoreboard with animated bars,
and **"Up next: <player> — <team>"** so the next describer is already
reaching for their phone.

### Game over
Trophy pop, winner name in team color + glow, fanfare + confetti bursts,
final scoreboard, **Top guessers podium** (per-player points tracked by the
server: 🥇🥈🥉). Host gets "Play again — same teams" (the word deck
continues, no repeats); everyone gets Leave.

---

## 6. Feedback matrix

| Event | Visual | Sound | Haptic |
|---|---|---|---|
| Turn starts | screen change + timer sweep | rise | 10ms |
| Exact guess | card strikes + badge pop + confetti (guesser) | chime | 30ms |
| Close guess | amber badge pop | mid tone | 15ms |
| Wrong guess | grey entry row | soft buzz (typer only) | — |
| ≤10s left | timer chili + pulse | — | — |
| ≤5s left | — | tick/s | — |
| Turn ends | reveal screen | fall | — |
| Win | trophy + confetti ×3 | fanfare | pattern |

---

## 7. Accessibility & i18n

- Contrast: body text ≥ 7:1 on night-950; accent-on-night ≥ 4.5:1 for
  interactive text; never color-only states (badges carry symbols).
- Touch targets ≥ 44px; inputs ≥ 16px font (no iOS zoom).
- Arabic rendered RTL with a real Arabic typeface; mixed-script cards set
  `dir` per line.
- `prefers-reduced-motion` respected globally (incl. confetti).
- Sound is opt-out and never load-bearing — every cue has a visual twin.

## 8. Performance budget

- First load JS ≤ 250 KB gz; fonts subset & self-hosted, `font-display: swap`.
- Zero per-frame filter/blur animation; backdrop is 1 static tile + 1
  transform-only glow.
- Steady-state re-renders during a turn: timer ring only (self-contained);
  guess events patch state via deltas, never full-tree churn.
- 60fps target on a mid-range Android; everything animates on the
  compositor.

## 9. Implementation map

| Spec area | Code |
|---|---|
| Tokens | `client/tailwind.config.js`, `client/src/index.css` |
| Fonts | `@fontsource/lalezar`, `@fontsource-variable/rubik` |
| Backdrop | `client/src/components/Backdrop.jsx` |
| Sound | `client/src/lib/sound.js` (+ hooks in `useGame.js`) |
| Score strip | `client/src/components/ScoreStrip.jsx` |
| Per-player stats, next-up | `server/engine.js` (`stats`, `nextUp`) |
| Screens | `client/src/screens/*` |
