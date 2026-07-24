# Shadle

A daily word-guessing game where you find the secret 5-letter word by
comparing **SHA-1 checksums** — no letter hints, just higher/lower distances.

## Live game

Deployed automatically to **GitHub Pages** on every push to `master`.
Enable Pages in your repository settings: *Settings → Pages → Source →
GitHub Actions*, then push.

## How it works

1. The frontend contains only an ordered list of **SHA-1 checksums**. It does
   not contain the source answer words.
2. Each day's target checksum is `answerHashes[dayNumber % listLength]`, where
   `dayNumber` counts UTC days since **2024-01-01**.
3. Players may guess any five-letter alphabetic word. Its checksum is computed
   in-browser with the **Web Crypto API** (`SHA-1`).
4. Each hash is treated as a **160-bit integer** (via `BigInt`).  Distance is
   the absolute difference expressed as a percentage of the full hash space
   (0 % = exact match, 100 % = opposite extremes).
5. A **daily stamp** (SHA-1 of the day number, first 8 hex chars) is shown in
   the header.
6. The Share button copies a word-free, emoji heat map of the current guesses.

## Private source word list

Keep the source word list and its word-to-checksum mapping in a private or
unlisted gist controlled by the game operator. Do **not** configure a browser
to fetch that gist: any response fetched by the browser is available to users.

To update the game, generate an ordered array of lowercase SHA-1 hex digests
from that private list and replace `ANSWER_HASHES` in `words.js`. Keep the
private source list separate from this repository.

> SHA-1 values prevent the source list from being directly published, but are
> not a secrecy guarantee: a five-letter word can be checked against a digest
> with an offline dictionary attack.

## Wordle-list compatibility

The current 570-word source list is a curated set from the initial
implementation; it is **not equivalent** to Wordle’s official answer list or
its allowed-guess list. This project does not include or reproduce Wordle’s
third-party word-list data.

## Development

No build step — just open `index.html` in a modern browser.
All logic lives in `app.js` and `words.js`.

## File layout

```
index.html          Main page
style.css           Dark-theme stylesheet
app.js              Game engine (SHA-1, BigInt comparison, persistence)
words.js            Ordered daily-answer SHA-1 checksums
.nojekyll           Prevents GitHub Pages from running Jekyll
.github/
  workflows/
    pages.yml       CI/CD: deploy to GitHub Pages on push to master
```
