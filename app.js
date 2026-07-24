'use strict';

/**
 * app.js — SHAdle game engine
 *
 * Each day a secret 5-letter word's SHA-1 checksum is selected from the
 * ordered ANSWER_HASHES list.
 * Players guess 5-letter words; the app computes each word's SHA-1 checksum
 * (via the Web Crypto API), treats it as a 160-bit integer, and reports:
 *   • whether the guess's checksum is numerically Higher or Lower than the target
 *   • the absolute distance between the two checksums as a percentage (0–100 %)
 *   • how much Closer or Farther the latest guess is compared to the previous one
 *
 * Progress is persisted in localStorage and rehydrated on page load.
 *
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Day-0 epoch (UTC). Day numbers start at 0 on this date. */
const START_DATE = new Date('2024-01-01T00:00:00Z');
const STORAGE_KEY = 'shadle-state';
const MAX_SHA1 = (1n << 160n) - 1n;   // 2^160 − 1
const GAME_URL = 'https://zgttotev.github.io/shadle/';

// ── Date helpers ─────────────────────────────────────────────────────────────

function getDayNumber() {
  const now = new Date();
  const ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
            - Date.UTC(START_DATE.getUTCFullYear(), START_DATE.getUTCMonth(), START_DATE.getUTCDate());
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// ── Crypto helpers ───────────────────────────────────────────────────────────

/** Compute SHA-1 of a lowercase string; returns 40-char hex. */
async function sha1hex(str) {
  const buf  = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str.toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Convert a 40-char hex SHA-1 string to BigInt. */
function hexToBig(hex) { return BigInt('0x' + hex); }

/**
 * Absolute distance between two SHA-1 hashes expressed as a percentage of
 * the full 160-bit hash space (0 % … 100 %, four decimal places of precision).
 */
function distancePct(hexA, hexB) {
  const diff = hexToBig(hexA) > hexToBig(hexB)
    ? hexToBig(hexA) - hexToBig(hexB)
    : hexToBig(hexB) - hexToBig(hexA);
  // Multiply by 1 000 000 first to preserve 4 decimal places after integer division
  return Number((diff * 1_000_000n) / MAX_SHA1) / 10_000;
}

/** True when guessHex is numerically greater than targetHex. */
function isHigher(guessHex, targetHex) { return hexToBig(guessHex) > hexToBig(targetHex); }

// ── State ────────────────────────────────────────────────────────────────────

let targetHash   = '';
let guesses      = [];   // { word, hash, distance, higher, exact }
let gameWon      = false;
let dayNumber    = 0;
let allowedGuessHashes;
let sortedAllowedGuessHashes;

// ── Persistence ──────────────────────────────────────────────────────────────

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ dayNumber, guesses, gameWon }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s.dayNumber === dayNumber ? s : null;   // discard yesterday's save
  } catch (_) {
    return null;
  }
}

// ── UI helpers ───────────────────────────────────────────────────────────────

let errorTimer = null;

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { el.textContent = ''; el.classList.remove('visible'); }, 2800);
}

function formatUtcDate() {
  const [year, month, day] = new Date().toISOString().slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/** First index containing a hash that is not less than value. */
function lowerBound(hashes, value) {
  let low = 0;
  let high = hashes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (hashes[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** First index containing a hash greater than value. */
function upperBound(hashes, value) {
  let low = 0;
  let high = hashes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (hashes[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Convert a 160-bit integer to its fixed-width SHA-1 hex representation. */
function bigToHex(value) { return value.toString(16).padStart(40, '0'); }

/**
 * Heat is a closeness percentile among every valid guess. A random valid word
 * averages about 50 % heat regardless of whether the target hash is near an
 * end of the SHA-1 range; the exact answer is always 100 %.
 */
function heatForHash(hash) {
  const guess = hexToBig(hash);
  const target = hexToBig(targetHash);
  const distance = guess > target ? guess - target : target - guess;
  const low = bigToHex(target > distance ? target - distance : 0n);
  const high = bigToHex(target + distance < MAX_SHA1 ? target + distance : MAX_SHA1);
  const atLeastAsClose = upperBound(sortedAllowedGuessHashes, high)
    - lowerBound(sortedAllowedGuessHashes, low);
  return 100 * (sortedAllowedGuessHashes.length - atLeastAsClose)
    / (sortedAllowedGuessHashes.length - 1);
}

function heatForGuess(guess) {
  return guess.heat ?? heatForHash(guess.hash);
}

/** Awards 0–100 points for heat, plus a 100-point solve bonus. */
function pointsForGuess(guess) {
  const heat = heatForGuess(guess);
  return Math.max(0, Math.round(heat)) + (guess.exact ? 100 : 0);
}

function totalPoints() {
  return guesses.reduce((total, guess) => total + pointsForGuess(guess), 0);
}

function heatClass(heat) {
  if (heat >= 70) return 'heat-hot';
  if (heat >= 35) return 'heat-warm';
  return 'heat-cold';
}

function heatSquare(heat) {
  if (heat >= 70) return '🟩';
  if (heat >= 35) return '🟨';
  return '🟥';
}

function shareRow(guess, index) {
  const heat = heatForGuess(guess);
  const filled = Math.max(0, Math.min(10, Math.round(heat / 10)));
  const squares = heatSquare(heat).repeat(filled) + '⬜'.repeat(10 - filled);
  const points = pointsForGuess(guess);
  if (guess.exact) return `${squares} 🎉 +${points}`;
  if (index === 0) return `${squares} +${points}`;
  const prev = guesses[index - 1];
  const delta = heatForGuess(guess) - heatForGuess(prev);
  if (Math.abs(delta) < 0.0001) return `${squares} +${points}`;
  return `${squares}${delta > 0 ? ' ⬆️' : ' ⬇️'} +${points}`;
}

async function shareGuesses() {
  const lines = [
    `#SHAdle #${dayNumber + 1} (${formatUtcDate()}) ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`,
    ...guesses.map((g, i) => shareRow(g, i)),
    `Score: ${totalPoints()} points`,
    GAME_URL,
  ];

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    document.getElementById('shareMsg').textContent = 'Copied to clipboard.';
  } catch (_) {
    showError('Could not copy guesses to the clipboard.');
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');

  list.innerHTML = '';

  guesses.forEach((g, i) => {
    const prev = guesses[i - 1];
    const card = document.createElement('div');

    let classes = 'guess-card';
    classes += g.exact ? ' win' : (g.higher ? ' higher' : ' lower');
    card.className = classes;

    // Change cell
    let changeHtml = '<span class="change-cell muted">—</span>';
    if (i > 0 && !g.exact) {
      const delta = heatForGuess(g) - heatForGuess(prev);
      if (Math.abs(delta) < 0.0001) {
        changeHtml = '<span class="change-cell muted">no change</span>';
      } else if (delta > 0) {
        changeHtml = `<span class="change-cell closer">▲ ${delta.toFixed(4)} % hotter</span>`;
      } else {
        changeHtml = `<span class="change-cell farther">▼ ${Math.abs(delta).toFixed(4)} % cooler</span>`;
      }
    }

    const heat = heatForGuess(g);
    card.innerHTML = `
      <span class="guess-num">${i + 1}</span>
      <span class="guess-word">${g.word.toUpperCase()}<code>${g.hash.slice(0, 20)}<br>${g.hash.slice(20)}</code></span>
      <span class="guess-heat ${heatClass(heat)}">${heat.toFixed(4)} %</span>
      <span class="guess-points">+${pointsForGuess(g)}</span>
      ${changeHtml}
    `;

    list.appendChild(card);
  });

  // Scroll the most recent card into view
  list.lastElementChild && list.lastElementChild.scrollIntoView({ block: 'nearest' });
}

function setWon() {
  const banner = document.getElementById('winBanner');
  document.getElementById('winCount').textContent   = guesses.length;
  document.getElementById('winPlural').textContent  = guesses.length === 1 ? '' : 'es';
  banner.style.display = 'flex';
  document.getElementById('guessBtn').disabled   = true;
  document.getElementById('guessInput').disabled = true;
  document.querySelectorAll('#keyboard button').forEach(button => { button.disabled = true; });
}

// ── Guess handler ────────────────────────────────────────────────────────────

async function handleGuess() {
  if (gameWon) return;

  const input = document.getElementById('guessInput');
  const word  = input.value.trim().toLowerCase();

  if (!/^[a-z]{5}$/.test(word)) { showError('Word must be 5 letters.'); return; }
  if (guesses.some(g => g.word === word)) { showError('Already guessed that word.'); return; }

  const hash     = await sha1hex(word);
  if (!allowedGuessHashes.has(hash)) { showError('That word is not in the allowed list.'); return; }
  const exact    = hash === targetHash;
  const higher   = !exact && isHigher(hash, targetHash);
  const distance = exact ? 0 : distancePct(hash, targetHash);
  const heat     = heatForHash(hash);

  guesses.push({ word, hash, exact, higher, distance, heat });
  gameWon = exact;
  input.value = '';

  saveState();
  renderHistory();
  if (gameWon) setWon();
}

// ── Initialise ───────────────────────────────────────────────────────────────

async function init() {
  dayNumber  = getDayNumber();
  allowedGuessHashes = new Set(ALLOWED_GUESS_HASHES);
  sortedAllowedGuessHashes = [...ALLOWED_GUESS_HASHES].sort();
  targetHash = ANSWER_HASHES[dayNumber % ANSWER_HASHES.length];

  // Show day badge
  document.getElementById('dayBadge').textContent = `Day ${dayNumber + 1}`;

  // Show today's target hash
  document.getElementById('targetHash').textContent = `Today's SHA-1: ${targetHash}`;

  // Restore today's progress (if any)
  const saved = loadState();
  if (saved) {
    guesses = saved.guesses;
    gameWon = saved.gameWon;
    renderHistory();
    if (gameWon) setWon();
  }

  // Wire up controls
  const input = document.getElementById('guessInput');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleGuess(); });
  document.getElementById('guessBtn').addEventListener('click', handleGuess);
  document.getElementById('shareBtn').addEventListener('click', shareGuesses);
  document.getElementById('keyboard').addEventListener('click', e => {
    const key = e.target.dataset.key;
    if (!key || gameWon) return;
    if (key === 'Enter') {
      handleGuess();
    } else if (key === 'Backspace') {
      input.value = input.value.slice(0, -1);
    } else if (input.value.length < input.maxLength) {
      input.value += key;
    }
    input.focus();
  });
  if (!gameWon) input.focus();
}

init();
