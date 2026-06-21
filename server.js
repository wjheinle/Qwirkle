const express = require('express');
const path = require('path');
const fs = require('fs');

// Persistent data directory. On Railway, mount a Volume at this path
// (e.g. /app/data) so games survive redeploys. Locally it just creates
// a ./data folder next to this file.
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'qwirkle.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { nextGameId: 1, nextTurnId: 1, games: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to read DB file, starting fresh:', e.message);
    return { nextGameId: 1, nextTurnId: 1, games: [] };
  }
}

let db = loadDB();

function saveDB() {
  // write to a temp file then rename, so a crash mid-write can't corrupt the data file
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function findGame(id) {
  return db.games.find((g) => g.id === Number(id));
}

function withTotals(game) {
  const totals = {};
  game.players.forEach((p) => (totals[p] = 0));
  game.turns.forEach((t) => {
    totals[t.player_name] = (totals[t.player_name] || 0) + t.points;
  });
  return { ...game, totals };
}

function pickWinner(game, totals) {
  let winner = game.players[0];
  game.players.forEach((p) => {
    if ((totals[p] || 0) > (totals[winner] || 0)) winner = p;
  });
  return winner;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// List all games (most recent first)
app.get('/api/games', (req, res) => {
  const sorted = [...db.games].sort((a, b) => b.id - a.id);
  res.json(sorted.map(withTotals));
});

// Get one game
app.get('/api/games/:id', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(withTotals(game));
});

// Create a new game
app.post('/api/games', (req, res) => {
  const { players } = req.body;
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
    return res.status(400).json({ error: 'Need 2 to 4 players' });
  }
  const clean = players.map((p) => String(p).trim()).filter(Boolean);
  if (clean.length !== players.length) {
    return res.status(400).json({ error: 'Player names cannot be blank' });
  }

  const game = {
    id: db.nextGameId++,
    created_at: new Date().toISOString(),
    status: 'active',
    players: clean,
    current_player: 0,
    winner: null,
    turns: [],
  };
  db.games.push(game);
  saveDB();
  res.json(withTotals(game));
});

// Add a turn for the current player
app.post('/api/games/:id/turns', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is already over' });

  const points = Number(req.body.points);
  const qwirkle = !!req.body.qwirkle;
  if (!Number.isFinite(points) || points < 0 || !Number.isInteger(points)) {
    return res.status(400).json({ error: 'Points must be a whole number 0 or greater' });
  }

  const playerIndex = game.current_player;
  const playerName = game.players[playerIndex];

  game.turns.push({
    id: db.nextTurnId++,
    player_index: playerIndex,
    player_name: playerName,
    points,
    qwirkle,
    final_bonus: false,
    created_at: new Date().toISOString(),
  });

  game.current_player = (playerIndex + 1) % game.players.length;
  saveDB();
  res.json(withTotals(game));
});

// Undo the most recent turn
app.post('/api/games/:id/undo', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const last = game.turns[game.turns.length - 1];
  if (!last) return res.status(400).json({ error: 'Nothing to undo' });

  game.turns.pop();
  game.current_player = last.player_index;
  game.status = 'active';
  game.winner = null;
  saveDB();
  res.json(withTotals(game));
});

// End the game. Optionally award the 6-point final-tile bonus to a player.
app.post('/api/games/:id/end', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'active') return res.status(400).json({ error: 'Game already ended' });

  const { finalPlayer } = req.body;
  if (finalPlayer && game.players.includes(finalPlayer)) {
    game.turns.push({
      id: db.nextTurnId++,
      player_index: game.players.indexOf(finalPlayer),
      player_name: finalPlayer,
      points: 6,
      qwirkle: false,
      final_bonus: true,
      created_at: new Date().toISOString(),
    });
  }

  const { totals } = withTotals(game);
  game.status = 'completed';
  game.winner = pickWinner(game, totals);
  saveDB();
  res.json(withTotals(game));
});

// Reopen a completed game (in case "End Game" was tapped by mistake)
app.post('/api/games/:id/reopen', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  game.status = 'active';
  game.winner = null;
  saveDB();
  res.json(withTotals(game));
});

// Delete a game entirely
app.delete('/api/games/:id', (req, res) => {
  db.games = db.games.filter((g) => g.id !== Number(req.params.id));
  saveDB();
  res.json({ ok: true });
});

// Fallback to the SPA shell for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Qwirkle scorekeeper running on port ${PORT}`);
  console.log(`Data file: ${DB_FILE}`);
});
