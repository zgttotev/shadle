# Shadle

A daily word-guessing game where you find the secret 5-letter word by
comparing **SHA-1 checksums** — no letter hints, just higher/lower distances.

## Live game

Deployed automatically to **GitHub Pages** on every push to `main`.
Enable Pages in your repository settings: *Settings → Pages → Source →
GitHub Actions*, then push.

## How it works

1. The standard Wordle answer list is **deterministically shuffled** with a
   fixed seed (`0x5348444C`, ASCII "SHDL") so every player sees the same
   word on the same day, without any server.
2. Each day's secret word is `shuffledList[dayNumber % listLength]`, where
   `dayNumber` counts UTC days since **2024-01-01**.
3. Checksums are computed in-browser with the **Web Crypto API** (`SHA-1`).
4. Each hash is treated as a **160-bit integer** (via `BigInt`).  Distance is
   the absolute difference expressed as a percentage of the full hash space
   (0 % = exact match, 100 % = opposite extremes).
5. A **daily stamp** (SHA-1 of the day number, first 8 hex chars) is shown in
   the header.  This proves the secret word was committed to before play began —
   the stamp changes only when the underlying word list or epoch changes.

## Private gist (word-list override)

To use a custom shuffled word list stored in a private / unlisted gist:

1. Create a **secret gist** containing a JSON array of 5-letter strings, e.g.
   ```json
   ["crane","focal","blush","…"]
   ```
2. Copy the **raw URL** of the gist file.
3. Add a `<script>` block **before** `app.js` in `index.html`:
   ```html
   <script>window.SHADLE_GIST_URL = 'https://gist.githubusercontent.com/…/raw/…';</script>
   ```
4. Push — the app fetches that list at startup and uses it as the answer
   sequence instead of the embedded one.  If the fetch fails the embedded list
   is used as a fallback.

> **Why a gist?**  A secret (unlisted) gist is not indexed by GitHub, making
> it harder for players to discover future words.  The SHA-1 checksums
> published via the daily stamp let anyone verify the game is fair after the
> fact, even without knowing the word order in advance.

## Development

No build step — just open `index.html` in a modern browser.
All logic lives in `app.js` and `words.js`.

## File layout

```
index.html          Main page
style.css           Dark-theme stylesheet
app.js              Game engine (SHA-1, BigInt comparison, persistence)
words.js            Word bank + seeded shuffle → ANSWERS / VALID_WORDS
.nojekyll           Prevents GitHub Pages from running Jekyll
.github/
  workflows/
    pages.yml       CI/CD: deploy to GitHub Pages on push to main
```
