# SHAdle

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
3. Players may guess any word in the allowed word list. Its checksum is
   computed in-browser with the **Web Crypto API** (`SHA-1`) and matched against
   an allowed-digest list; the source words are never sent to the browser.
4. Each hash is treated as a **160-bit integer** (via `BigInt`).  Distance is
   the absolute difference expressed as a percentage of the full hash space
   (0 % = exact match, 100 % = opposite extremes).
5. A **daily stamp** (SHA-1 of the day number, first 8 hex chars) is shown in
   the header.
6. The Share button copies a word-free, emoji heat map of the current guesses.

## Private source word lists

`wordlists/answers.txt` and `wordlists/allowed-guesses.txt` are local,
Git-ignored operator files. The answers list supplies the daily answers; the
allowed-guesses list supplies the additional valid guesses and intentionally
does not contain the answers. The generator also writes the ignored plaintext
schedule to `wordlists/daily-answers-shuffled.txt`, in the exact order used by
the daily hashes.

Run the following from the repository root after updating either source file:

```sh
node scripts/generate-word-lists.js
```

This securely shuffles the daily answers, SHA-1 hashes both lists, and writes
the browser-safe `words.js`. The generated allowed-guess hashes include the
answers as well, so every daily answer remains a valid guess. No source word is
put in the generated frontend asset. It also prints today's answer and writes
the full plaintext schedule locally for operator reference.

> SHA-1 values prevent the source list from being directly published, but are
> not a secrecy guarantee: a five-letter word can be checked against a digest
> with an offline dictionary attack.

## Development

No build step — just open `index.html` in a modern browser.
All logic lives in `app.js` and `words.js`.

## File layout

```
index.html          Main page
style.css           Dark-theme stylesheet
app.js              Game engine (SHA-1, BigInt comparison, persistence)
words.js            Generated daily-answer and allowed-guess SHA-1 digests
scripts/
  generate-word-lists.js  Local generator for the ignored source lists
wordlists/           Ignored local sources and plaintext shuffled schedule
.nojekyll           Prevents GitHub Pages from running Jekyll
.github/
  workflows/
    pages.yml       CI/CD: deploy to GitHub Pages on push to master
```
