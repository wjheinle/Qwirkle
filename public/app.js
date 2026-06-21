// ---------- background decoration ----------

const BG_SHAPES = ['shp-circle', 'shp-square', 'shp-diamond', 'shp-clover', 'shp-star', 'shp-x'];
const BG_COLORS = ['var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--green)', 'var(--blue)', 'var(--purple)'];

function paintBackgroundTiles() {
  const group = document.getElementById('bgTilesGroup');
  if (!group || group.childElementCount) return; // only paint once
  const COUNT = 26;
  const svgNS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < COUNT; i++) {
    const use = document.createElementNS(svgNS, 'use');
    const shape = BG_SHAPES[Math.floor(Math.random() * BG_SHAPES.length)];
    const color = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
    const x = Math.random() * 100;
    const y = Math.random() * 200;
    const size = 6 + Math.random() * 7; // viewBox units
    const rotation = Math.floor(Math.random() * 360);
    const opacity = 0.05 + Math.random() * 0.07;

    use.setAttribute('href', `#${shape}`);
    use.setAttribute('x', x - size / 2);
    use.setAttribute('y', y - size / 2);
    use.setAttribute('width', size);
    use.setAttribute('height', size);
    use.setAttribute('fill', color);
    use.setAttribute('opacity', opacity.toFixed(2));
    use.setAttribute('transform', `rotate(${rotation} ${x} ${y})`);
    group.appendChild(use);
  }
}

// ---------- helpers ----------

const PLAYER_COLORS = ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--purple)'];

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------- app state ----------

const app = document.getElementById('app');
let pollTimer = null;
let currentGame = null;

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// ---------- router ----------

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  paintBackgroundTiles();
  route();
});

function route() {
  stopPolling();
  closeModals();
  const hash = location.hash || '#/';
  const gameMatch = hash.match(/^#\/game\/(\d+)/);
  if (gameMatch) {
    renderGame(Number(gameMatch[1]));
  } else {
    renderHome();
  }
}

// ---------- home screen ----------

let setupPlayers = ['', ''];

async function renderHome() {
  app.innerHTML = `
    <div class="brand">
      <div class="eyebrow">Scorekeeper</div>
      <h1>QWIRKLE</h1>
      <div class="tag">2&ndash;4 players &middot; live scoring</div>
    </div>
    <div class="panel" id="setupPanel">
      <h3>New Game</h3>
      <div class="order-hint">First in the list goes first. Use the arrows or shuffle to set the order.</div>
      <div id="playerInputs"></div>
      <div class="setup-actions">
        <button class="btn ghost small" id="addPlayerBtn">+ Add player</button>
        <button class="btn ghost small" id="shuffleBtn">🎲 Shuffle order</button>
      </div>
      <div class="setup-actions" style="margin-top:10px">
        <button class="btn primary block" id="startGameBtn">Start game</button>
      </div>
    </div>
    <div class="panel" id="activePanel" style="display:none">
      <h3>In progress</h3>
      <div id="activeList"></div>
    </div>
    <div class="panel" id="historyPanel" style="display:none">
      <h3>Past games</h3>
      <div id="historyList"></div>
    </div>
  `;

  renderPlayerInputs();
  document.getElementById('addPlayerBtn').addEventListener('click', () => {
    if (setupPlayers.length >= 4) return;
    setupPlayers.push('');
    renderPlayerInputs();
  });
  document.getElementById('shuffleBtn').addEventListener('click', () => {
    for (let i = setupPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [setupPlayers[i], setupPlayers[j]] = [setupPlayers[j], setupPlayers[i]];
    }
    renderPlayerInputs();
    showToast('Order shuffled');
  });
  document.getElementById('startGameBtn').addEventListener('click', startGame);

  try {
    const games = await api('GET', '/api/games');
    const active = games.filter((g) => g.status === 'active');
    const completed = games.filter((g) => g.status === 'completed');

    if (active.length) {
      document.getElementById('activePanel').style.display = '';
      const list = document.getElementById('activeList');
      active.forEach((g) => list.appendChild(gameRow(g)));
    }

    if (completed.length) {
      document.getElementById('historyPanel').style.display = '';
      const list = document.getElementById('historyList');
      completed.slice(0, 15).forEach((g) => list.appendChild(gameRow(g)));
    }
  } catch (e) {
    showToast(e.message);
  }
}

function renderPlayerInputs() {
  const wrap = document.getElementById('playerInputs');
  wrap.innerHTML = '';
  setupPlayers.forEach((val, i) => {
    const row = el(`
      <div class="player-input-row">
        <span class="order-badge">${i + 1}</span>
        <span class="player-swatch" style="background:${PLAYER_COLORS[i]}"></span>
        <input type="text" placeholder="Player ${i + 1} name" value="${val.replace(/"/g, '&quot;')}" maxlength="20">
        <div class="order-arrows">
          <button type="button" class="order-up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&#9650;</button>
          <button type="button" class="order-down" ${i === setupPlayers.length - 1 ? 'disabled' : ''} aria-label="Move down">&#9660;</button>
        </div>
        ${setupPlayers.length > 2 ? '<button class="remove-btn" type="button">&times;</button>' : ''}
      </div>
    `);
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => (setupPlayers[i] = e.target.value));

    row.querySelector('.order-up').addEventListener('click', () => {
      if (i === 0) return;
      [setupPlayers[i - 1], setupPlayers[i]] = [setupPlayers[i], setupPlayers[i - 1]];
      renderPlayerInputs();
    });
    row.querySelector('.order-down').addEventListener('click', () => {
      if (i === setupPlayers.length - 1) return;
      [setupPlayers[i + 1], setupPlayers[i]] = [setupPlayers[i], setupPlayers[i + 1]];
      renderPlayerInputs();
    });

    const removeBtn = row.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        setupPlayers.splice(i, 1);
        renderPlayerInputs();
      });
    }
    wrap.appendChild(row);
  });
}

async function startGame() {
  const names = setupPlayers.map((n) => n.trim());
  if (names.some((n) => !n)) return showToast('Give every player a name');
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    return showToast('Player names must be unique');
  }
  try {
    const game = await api('POST', '/api/games', { players: names });
    setupPlayers = ['', ''];
    location.hash = `#/game/${game.id}`;
  } catch (e) {
    showToast(e.message);
  }
}

function gameRow(g) {
  const playersStr = g.players.join(', ');
  const scoresStr = g.players.map((p) => g.totals[p] ?? 0).join(' &ndash; ');
  const row = el(`
    <div class="game-row">
      <div>
        <div class="gnames">${playersStr}</div>
        <div class="gmeta">${fmtDate(g.created_at)} &middot; ${g.status === 'active' ? 'in progress' : 'final'}</div>
      </div>
      <div>
        <div class="gscore">${scoresStr}</div>
        ${g.winner ? `<div class="gwinner">${g.winner} won</div>` : ''}
      </div>
    </div>
  `);
  row.addEventListener('click', () => (location.hash = `#/game/${g.id}`));
  return row;
}

// ---------- game screen ----------

async function renderGame(id) {
  app.innerHTML = `<div class="brand"><div class="eyebrow">Loading&hellip;</div></div>`;
  try {
    currentGame = await api('GET', `/api/games/${id}`);
  } catch (e) {
    showToast(e.message);
    location.hash = '#/';
    return;
  }
  drawGame();
  pollTimer = setInterval(async () => {
    try {
      const fresh = await api('GET', `/api/games/${id}`);
      currentGame = fresh;
      drawGame();
    } catch (e) {
      /* silent — keep last known state */
    }
  }, 4000);
}

function drawGame() {
  const g = currentGame;
  const isActive = g.status === 'active';
  const ranked = g.players.slice().sort((a, b) => (g.totals[b] || 0) - (g.totals[a] || 0));
  const topScore = g.totals[ranked[0]] || 0;
  const isTie = g.players.filter((p) => (g.totals[p] || 0) === topScore).length > 1;

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" id="backBtn">&larr; All games</button>
      ${isActive ? '<button class="btn danger small" id="endBtn">End game</button>' : ''}
    </div>
    <div class="brand" style="margin-bottom:14px">
      <div class="eyebrow">Live Scorecard</div>
      <h1 style="font-size:38px">QWIRKLE</h1>
    </div>

    ${
      !isActive
        ? `<div class="winner-banner">
            <div class="eyebrow">${isTie ? 'It\u2019s a tie' : 'Winner'}</div>
            <h2>${isTie ? ranked.filter((p) => g.totals[p] === topScore).join(' & ') : g.winner || ranked[0]}</h2>
            <div class="score">${ranked.map((p) => `${p} ${g.totals[p] || 0}`).join(' &middot; ')}</div>
          </div>`
        : `<div class="turn-banner">
            <div>
              <div class="label"><span class="pulse-dot"></span>Up next</div>
              <div class="who">${g.players[g.current_player]}</div>
            </div>
            <button class="btn primary" id="scoreBtn">Add score</button>
          </div>`
    }

    <div class="board" id="board"></div>

    <div class="table-card">
      <table>
        <thead><tr id="theadRow"><th>Turn</th></tr></thead>
        <tbody id="tbody"></tbody>
        <tfoot><tr id="tfootRow"></tr></tfoot>
      </table>
    </div>

    <div class="legend"><span class="qmark">&#9679;</span> flashing tile = Qwirkle &middot; gold number = final-tile bonus</div>

    ${
      isActive
        ? `<div class="game-actions">
            <button class="btn ghost" id="undoBtn" ${g.turns.length === 0 ? 'disabled' : ''}>Undo last score</button>
          </div>`
        : `<div class="game-actions">
            <button class="btn ghost" id="reopenBtn">Reopen game</button>
            <button class="btn primary" id="newGameBtn">New game</button>
          </div>`
    }
  `;

  // leaderboard
  const board = document.getElementById('board');
  g.players.forEach((name, i) => {
    const total = g.totals[name] || 0;
    const isLead = ranked[0] === name && !isTie;
    const isTurn = isActive && g.current_player === i;
    const place = ranked.indexOf(name) + 1;
    const ord = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : '4th';
    board.appendChild(
      el(`
      <div class="card ${isLead ? 'lead' : ''} ${isTurn ? 'active-turn' : ''}">
        <div class="rank">${ord}</div>
        <div class="name"><span class="swatch" style="background:${PLAYER_COLORS[i]}"></span>${name}</div>
        <div class="total">${total}</div>
      </div>
    `)
    );
  });

  // table head
  const theadRow = document.getElementById('theadRow');
  g.players.forEach((name, i) => {
    theadRow.appendChild(el(`<th><span class="swatch" style="background:${PLAYER_COLORS[i]}"></span>${name}</th>`));
  });

  // table body — group turns into rounds of N players
  const tbody = document.getElementById('tbody');
  const n = g.players.length;
  const rounds = Math.ceil(g.turns.length / n) || 0;
  for (let r = 0; r < rounds; r++) {
    const tr = document.createElement('tr');
    tr.appendChild(el(`<td>${r + 1}</td>`));
    for (let p = 0; p < n; p++) {
      const turnsForPlayer = g.turns.filter((t) => t.player_index === p);
      const t = turnsForPlayer[r];
      if (!t) {
        tr.appendChild(el(`<td>&mdash;</td>`));
      } else {
        const isQ = !!t.qwirkle;
        const isFinal = !!t.final_bonus;
        tr.appendChild(
          el(`<td><span class="cell ${isQ ? 'qwirkle' : ''} ${isFinal ? 'final-bonus' : ''}">${t.points}${
            isQ ? '<span class="qmark">&#9733;</span>' : ''
          }${isFinal ? '<span class="qmark">+</span>' : ''}</span></td>`)
        );
      }
    }
    tbody.appendChild(tr);
  }

  // table foot
  const tfootRow = document.getElementById('tfootRow');
  tfootRow.appendChild(el(`<td>Total</td>`));
  g.players.forEach((name) => tfootRow.appendChild(el(`<td>${g.totals[name] || 0}</td>`)));

  // wire up controls
  document.getElementById('backBtn').addEventListener('click', () => (location.hash = '#/'));

  const scoreBtn = document.getElementById('scoreBtn');
  if (scoreBtn) scoreBtn.addEventListener('click', openEntryModal);

  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) undoBtn.addEventListener('click', undoTurn);

  const endBtn = document.getElementById('endBtn');
  if (endBtn) endBtn.addEventListener('click', openEndModal);

  const reopenBtn = document.getElementById('reopenBtn');
  if (reopenBtn) reopenBtn.addEventListener('click', reopenGame);

  const newGameBtn = document.getElementById('newGameBtn');
  if (newGameBtn) newGameBtn.addEventListener('click', () => (location.hash = '#/'));
}

// ---------- score entry modal ----------

function openEntryModal() {
  const modal = document.getElementById('entryModal');
  document.getElementById('entryPlayerName').textContent = currentGame.players[currentGame.current_player];
  const pointsInput = document.getElementById('entryPoints');
  pointsInput.value = '';
  document.getElementById('entryQwirkle').checked = false;
  modal.classList.remove('hidden');
  setTimeout(() => pointsInput.focus(), 50);
}

function closeModals() {
  document.getElementById('entryModal')?.classList.add('hidden');
  document.getElementById('endModal')?.classList.add('hidden');
}

document.getElementById('entryCancel').addEventListener('click', closeModals);
document.getElementById('entryModal').addEventListener('click', (e) => {
  if (e.target.id === 'entryModal') closeModals();
});
document.getElementById('entrySubmit').addEventListener('click', async () => {
  const points = Number(document.getElementById('entryPoints').value);
  if (!Number.isFinite(points) || points < 0 || !Number.isInteger(points)) {
    return showToast('Enter a whole number, 0 or more');
  }
  const qwirkle = document.getElementById('entryQwirkle').checked;
  try {
    currentGame = await api('POST', `/api/games/${currentGame.id}/turns`, { points, qwirkle });
    closeModals();
    drawGame();
  } catch (e) {
    showToast(e.message);
  }
});
document.getElementById('entryPoints').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('entrySubmit').click();
});

async function undoTurn() {
  try {
    currentGame = await api('POST', `/api/games/${currentGame.id}/undo`);
    drawGame();
  } catch (e) {
    showToast(e.message);
  }
}

// ---------- end game modal ----------

function openEndModal() {
  const list = document.getElementById('endPlayerList');
  list.innerHTML = '';
  currentGame.players.forEach((name, i) => {
    const btn = el(`
      <button class="end-player-btn" type="button">
        <span class="swatch" style="background:${PLAYER_COLORS[i]}"></span>
        ${name} played their last tile (+6)
      </button>
    `);
    btn.addEventListener('click', () => endGame(name));
    list.appendChild(btn);
  });
  document.getElementById('endModal').classList.remove('hidden');
}

document.getElementById('endCancel').addEventListener('click', closeModals);
document.getElementById('endModal').addEventListener('click', (e) => {
  if (e.target.id === 'endModal') closeModals();
});
document.getElementById('endNoBonus').addEventListener('click', () => endGame(null));

async function endGame(finalPlayer) {
  try {
    currentGame = await api('POST', `/api/games/${currentGame.id}/end`, { finalPlayer });
    closeModals();
    drawGame();
    showToast(`Game over — ${currentGame.winner} wins!`);
  } catch (e) {
    showToast(e.message);
  }
}

async function reopenGame() {
  try {
    currentGame = await api('POST', `/api/games/${currentGame.id}/reopen`);
    drawGame();
  } catch (e) {
    showToast(e.message);
  }
}
