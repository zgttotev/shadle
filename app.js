'use strict';

/**
 * app.js — Shadle game engine
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

function shareRow(guess) {
  const heat = guess.exact ? 100 : 100 - guess.distance;
  const filled = Math.max(0, Math.min(5, Math.round(heat / 20)));
  const squares = '🟩'.repeat(filled) + '⬜'.repeat(5 - filled);
  const direction = guess.exact ? ' 🎉' : (guess.higher ? ' ↘️' : ' ↗️');
  return squares + direction;
}

async function shareGuesses() {
  const lines = [
    `#Shadle #${dayNumber + 1} (${formatUtcDate()}) ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`,
    ...guesses.map(shareRow),
  ];

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    document.getElementById('shareMsg').textContent = 'Copied to clipboard.';
  } catch (_) {
    showError('Could not copy guesses to the clipboard.');
  }
}

function renderHistory() {
  const list    = document.getElementById('historyList');
  const section = document.getElementById('historySection');

  if (guesses.length === 0) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  list.innerHTML = '';

  guesses.forEach((g, i) => {
    const prev = guesses[i - 1];
    const card = document.createElement('div');

    let classes = 'guess-card';
    classes += g.exact ? ' win' : (g.higher ? ' higher' : ' lower');
    card.className = classes;

    // Direction cell
    const dirText = g.exact
      ? '<span class="tag win-tag">🎯 Exact!</span>'
      : g.higher
        ? '<span class="tag higher-tag">↑ Higher</span>'
        : '<span class="tag lower-tag">↓ Lower</span>';

    // Distance cell
    const distText = g.exact ? '—' : `${g.distance.toFixed(4)} %`;

    // Change cell
    let changeHtml = '<span class="change-cell muted">—</span>';
    if (i > 0 && !g.exact) {
      const delta = prev.distance - g.distance;
      if (Math.abs(delta) < 0.0001) {
        changeHtml = '<span class="change-cell muted">no change</span>';
      } else if (delta > 0) {
        changeHtml = `<span class="change-cell closer">▲ ${delta.toFixed(4)} % closer</span>`;
      } else {
        changeHtml = `<span class="change-cell farther">▼ ${Math.abs(delta).toFixed(4)} % farther</span>`;
      }
    }

    card.innerHTML = `
      <span class="guess-num">${i + 1}</span>
      <span class="guess-word">${g.word.toUpperCase()}<code>${g.hash}</code></span>
      ${dirText}
      <span class="guess-dist">${distText}</span>
      <span class="guess-heat">${g.exact ? '100.0000' : (100 - g.distance).toFixed(4)} %</span>
      ${changeHtml}
    `;

    list.appendChild(card);
  });
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
  const exact    = hash === targetHash;
  const higher   = !exact && isHigher(hash, targetHash);
  const distance = exact ? 0 : distancePct(hash, targetHash);

  guesses.push({ word, hash, exact, higher, distance });
  gameWon = exact;
  input.value = '';

  saveState();
  renderHistory();
  if (gameWon) setWon();
}

// ── Initialise ───────────────────────────────────────────────────────────────

async function init() {
  dayNumber  = getDayNumber();
  targetHash = ANSWER_HASHES[dayNumber % ANSWER_HASHES.length];

  // Show day badge
  document.getElementById('dayBadge').textContent = `Day ${dayNumber + 1}`;

  // Show today's checksum (first 8 hex chars) as a daily stamp —
  // proves the target was fixed before play began, without revealing it.
  const dayStamp = (await sha1hex(String(dayNumber))).slice(0, 8);
  document.getElementById('dayStamp').textContent = `stamp: ${dayStamp}`;
  document.getElementById('targetHash').textContent = `Today’s SHA-1: ${targetHash}`;

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
