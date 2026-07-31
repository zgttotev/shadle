'use strict';

const answer = 'yuh';
const board = document.getElementById('board');
const message = document.getElementById('message');
const keys = [...document.querySelectorAll('[data-key]')];
const submit = document.getElementById('submit');
const share = document.getElementById('share');
let guess = '';
let won = false;

for (let index = 0; index < answer.length; index += 1) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  board.append(tile);
}

function render() {
  [...board.children].forEach((tile, index) => {
    tile.textContent = guess[index] || '';
    tile.classList.toggle('filled', Boolean(guess[index]));
  });
}

function play(letter) {
  if (won || letter !== answer[guess.length]) return;
  guess += letter;
  render();
}

function submitGuess() {
  if (won || guess !== answer) return;
  won = true;
  [...board.children].forEach(tile => tile.classList.add('correct'));
  keys.forEach(key => key.classList.add('correct'));
  submit.classList.add('correct');
  message.textContent = 'yuh';
}

async function copyShare() {
  if (!won) return;
  try {
    const date = new Date().toISOString().slice(0, 10);
    await navigator.clipboard.writeText(`#yuhdle ${date} | 1/1\nyuh\n${window.location.href}`);
    share.classList.add('copied');
    message.textContent = 'yuh';
    window.setTimeout(() => share.classList.remove('copied'), 1200);
  } catch (_) {
    // Keep feedback intentionally minimal.
  }
}

keys.forEach(key => key.addEventListener('click', () => play(key.dataset.key)));
submit.addEventListener('click', submitGuess);
share.addEventListener('click', copyShare);

document.addEventListener('keydown', event => {
  const letter = event.key.toLowerCase();
  if ('yuh'.includes(letter)) play(letter);
  if (event.key === 'Enter') submitGuess();
  if (event.key === 'Backspace' && !won) {
    guess = guess.slice(0, -1);
    render();
  }
});
