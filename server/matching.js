// Text normalization + fuzzy scoring for Team Taboo guesses.
// Supports Latin/franco AND Arabic script — a title can be guessed in either.
//
// Scoring:
//   - exact (normalized) match of ANY accepted form -> 2 points
//   - correct but misspelled (length-scaled edit distance) -> 1 point
//   - already-solved word -> "duplicate"
//   - no match -> "none"

// Combining marks to strip: Latin accents (NFD) + Arabic tashkeel, hamza marks,
// superscript alef, and Quranic annotation marks.
const COMBINING = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۭ]/g;

// Arabic-Indic (٠-٩) and extended (۰-۹) digits -> Latin 0-9.
function arabicDigitsToLatin(s) {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

// Canonical comparison form. Handles both scripts:
//  - lowercases, strips accents/tashkeel (via NFD + combining removal)
//  - unifies Arabic letter variants: أإآ→ا, ؤ→و, ئ→ي (from NFD decomposition),
//    ة→ه, ى→ي, drops standalone hamza ء and tatweel ـ
//  - converts Arabic digits, drops punctuation, collapses whitespace
function normalize(s) {
  let x = String(s == null ? '' : s).toLowerCase().normalize('NFD');
  x = x.replace(COMBINING, '');        // strip Latin + Arabic diacritics / hamza marks
  x = x.replace(/ـ/g, '');        // tatweel ـ
  x = arabicDigitsToLatin(x);
  x = x
    .replace(/ى/g, 'ي')      // ى -> ي
    .replace(/ة/g, 'ه')      // ة -> ه
    .replace(/ء/g, '');           // standalone hamza ء -> drop
  x = x.replace(/[^a-z0-9؀-ۿ\s-]/g, ' '); // keep latin, digits, arabic, space, hyphen
  x = x.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  return x;
}

// Light Latin singular/plural stemmer ("cat" == "cats"). No-op on Arabic.
function stem(word) {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('ses') || w.endsWith('xes') || w.endsWith('zes'))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
function stemPhrase(s) {
  return s.split(' ').map(stem).join(' ');
}

// Levenshtein edit distance.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Edits still counted as "right word, misspelled", scaled to target length.
function closeThreshold(len) {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

// Compare a normalized guess to one normalized accepted form.
// Returns 'exact' | 'close' | null.
function matchOne(guessNorm, targetNorm) {
  if (!guessNorm || !targetNorm) return null;
  if (guessNorm === targetNorm) return 'exact';
  if (stemPhrase(guessNorm) === stemPhrase(targetNorm)) return 'exact';
  if (targetNorm.length >= 3) {
    const d = levenshtein(guessNorm, targetNorm);
    if (d > 0 && d <= closeThreshold(targetNorm.length)) return 'close';
    const ds = levenshtein(stemPhrase(guessNorm), stemPhrase(targetNorm));
    if (ds > 0 && ds <= closeThreshold(targetNorm.length)) return 'close';
  }
  return null;
}

// Best match of a guess against a word's list of accepted forms.
function matchAgainstForms(guessNorm, forms) {
  let best = null; // { rank, dist }
  for (const f of forms) {
    const type = matchOne(guessNorm, f);
    if (!type) continue;
    const dist = type === 'exact' ? -1 : levenshtein(guessNorm, f);
    const rank = type === 'exact' ? 2 : 1;
    if (!best || rank > best.rank || (rank === best.rank && dist < best.dist)) {
      best = { type, rank, dist };
    }
  }
  return best;
}

// Score a raw guess against the current words.
// words: [{ forms: [normalizedForm, ...], solved }]
// Returns { status, index }.
function scoreGuess(rawGuess, words) {
  const g = normalize(rawGuess);
  if (!g) return { status: 'none', index: -1 };

  let best = null; // { index, type, rank, dist }
  let duplicate = -1;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const m = matchAgainstForms(g, w.forms || []);
    if (!m) continue;
    if (w.solved) {
      if (duplicate === -1) duplicate = i;
      continue;
    }
    if (!best || m.rank > best.rank || (m.rank === best.rank && m.dist < best.dist)) {
      best = { index: i, type: m.type, rank: m.rank, dist: m.dist };
    }
  }

  if (best) return { status: best.type, index: best.index };
  if (duplicate !== -1) return { status: 'duplicate', index: duplicate };
  return { status: 'none', index: -1 };
}

module.exports = { normalize, stem, stemPhrase, levenshtein, closeThreshold, matchOne, matchAgainstForms, scoreGuess };
