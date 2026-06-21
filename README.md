# Qwirkle Scorekeeper

A live scorecard for Qwirkle — 2 to 4 players, turn-by-turn entry, automatic
Qwirkle highlighting, and a running leaderboard. Built to be passed around
the table on a phone, or pulled up on everyone's own phone at once.

## What it does

- Set up a game with 2–4 player names
- Tap "Add score" on each turn — enter the points, flip the Qwirkle switch
  if they completed a line of 6
- Live leaderboard with the current leader highlighted in gold
- Turn-by-turn table; Qwirkle turns flash, final-tile bonus shows in gold
- "End game" walks you through the +6 final-tile bonus (per official rules,
  whoever empties their hand first gets 6 bonus points)
- Game history is saved automatically — past games and scores stick around
- Undo button if you fat-finger a score

This tracks scores only — it doesn't simulate the board itself. You still
play with the real tiles; this just keeps score so nobody has to do math at
the table.

## Scoring rules baked in

- 1 point per tile in every line a play creates or extends
- A Qwirkle (completing a line of all 6 colors/shapes) is worth 12+ points
  total — the app doesn't auto-calculate this, you enter your already-totaled
  turn score and just flag it as a Qwirkle so it's highlighted
- +6 bonus for the player who plays their last tile when the bag runs dry

## Keeping it cheap — sleep when idle

This app has no database connections, telemetry, or background jobs, which
makes it a good fit for Railway's **Serverless** mode (formerly called
"App-Sleeping"). It puts the service to sleep after about 10 minutes with no
traffic, and automatically wakes it back up the moment someone opens the
link — you only pay for compute while it's actually running.

To turn it on:

1. In Railway, open your project → the service → **Settings → Deploy**.
2. Scroll to **Serverless** and toggle **Enable Serverless** on.
3. Redeploy if prompted.

A couple of things to expect:

- The *first* request after it's been asleep takes a few extra seconds to
  "wake up," and very occasionally that first load shows an error — just
  reload once and it'll be fine.
- If you know game night is starting, opening the link a minute early gets
  it warmed up before anyone's first turn.

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

Data is stored in a JSON file at `./data/qwirkle.json` — no database setup
needed.

## Deploying to Railway

### Option A — GitHub (recommended)

1. Create a new GitHub repo and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Qwirkle scorekeeper"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/qwirkle-scorekeeper.git
   git push -u origin main
   ```
2. In Railway: **New Project → Deploy from GitHub repo** → pick the repo.
3. Railway auto-detects Node.js and runs `npm install` + `npm start`. No
   config needed.
4. Once deployed, open the generated `*.up.railway.app` URL — that's your app.

### Option B — Railway CLI (no GitHub needed)

```bash
npm install -g @railway/cli
railway login
cd qwirkle-app
railway init
railway up
```

### Keeping data across redeploys

By default Railway's filesystem is wiped on every redeploy. Since this app
stores games in a JSON file, add a **Volume** so scores survive:

1. In your Railway project → your service → **Settings → Volumes**.
2. Add a volume, mount path `/app/data`.
3. Redeploy. The app already reads `DB_DIR` from the environment, so if you
   ever want a different path, set the `DB_DIR` variable in Railway to match
   your mount path.

Without a volume, the app still works fine for a single game night — scores
just reset if the service redeploys or restarts.

## A note on multiple phones at once

Everyone can open the same Railway URL on their own phone and watch the
leaderboard update live (it polls every few seconds). Score *entry* isn't
conflict-proof, though — if two people tap "Add score" at the exact same
moment, the second submission can land on the wrong turn. For score entry,
it's safest to have one phone "driving" while everyone else just watches.

## Project structure

```
qwirkle-app/
├── server.js          Express server + JSON file storage + REST API
├── package.json
├── public/
│   ├── index.html      App shell + modals
│   ├── style.css        Visual design (dark, Qwirkle-colored)
│   ├── app.js            All frontend logic (no build step, no framework)
│   └── tiles-bg.jpg       Background photo of physical Qwirkle tiles
└── data/                Created automatically — game data lives here
```
