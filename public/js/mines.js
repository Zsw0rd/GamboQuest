let sweepAudioEnabled = true;
let minesSessionId = null;
let minesGameActive = false;
const MINES_GRID = 25;

function toggleSweepAudio() {
  sweepAudioEnabled = !sweepAudioEnabled;
  const icon = document.getElementById('sweepAudioToggle');
  if (!icon) return;
  icon.textContent = sweepAudioEnabled ? '🔊' : '🔇';
  icon.style.color = sweepAudioEnabled ? 'gold' : 'red';
}

function playSweepSfx(url) {
  playSfx(url, sweepAudioEnabled);
}

document.addEventListener('DOMContentLoaded', () => {
  const minesGridEl = document.getElementById('minesGrid');
  const minesMessageEl = document.getElementById('minesMessage');
  const minesMultiplierEl = document.getElementById('minesMultiplier');
  const minesStartBtn = document.getElementById('minesStartBtn');
  const minesCashoutBtn = document.getElementById('minesCashoutBtn');
  const minesBetAmountEl = document.getElementById('minesBetAmount');
  const minesNumBombsEl = document.getElementById('minesNumBombs');

  function minesSetupGrid() {
    if (!minesGridEl) return;
    minesGridEl.innerHTML = '';
    for (let i = 0; i < MINES_GRID; i++) {
      const cell = document.createElement('div');
      cell.classList.add('mines-cell');
      cell.dataset.index = i;
      cell.addEventListener('click', minesHandleCellClick);
      minesGridEl.appendChild(cell);
    }
  }

  function minesUpdateMultiplier(mult) {
    if (minesMultiplierEl) minesMultiplierEl.textContent = `Multiplier: x${mult.toFixed(2)}`;
  }

  async function minesStartGame() {
    const userBet = parseInt(minesBetAmountEl.value, 10) || 0;
    const numBombs = parseInt(minesNumBombsEl.value, 10);
    const balance = getStoredBalance();

    if (userBet <= 0 || userBet > balance) {
      minesMessageEl.textContent = userBet <= 0 ? 'Enter a valid bet.' : 'Bet exceeds balance!';
      return;
    }

    minesStartBtn.disabled = true;
    minesMessageEl.textContent = 'Starting...';

    const result = await playGame({ game: 'mines', action: 'start', bet: userBet, numBombs });
    if (result.error) {
      alert(result.error);
      minesStartBtn.disabled = false;
      return;
    }

    minesSessionId = result.sessionId;
    minesGameActive = true;
    minesCashoutBtn.disabled = true;
    minesSetupGrid();
    minesUpdateMultiplier(result.baseMult);
    minesMessageEl.textContent = 'Game started! Click tiles carefully...';
  }

  async function minesHandleCellClick(e) {
    if (!minesGameActive || !minesSessionId) return;
    const cell = e.target;
    const cellIndex = parseInt(cell.dataset.index, 10);
    if (cell.classList.contains('minesRevealedSafe') || cell.classList.contains('minesRevealedBomb')) return;

    cell.classList.add('mines-loading');
    const result = await playGame({
      game: 'mines',
      action: 'reveal',
      sessionId: minesSessionId,
      cellIndex,
    });
    cell.classList.remove('mines-loading');

    if (result.error) { alert(result.error); return; }

    if (result.isBomb) {
      cell.classList.add('minesRevealedBomb');
      cell.style.backgroundImage = "url('images/boom.png')";
      cell.style.backgroundSize = '60%';
      cell.style.backgroundRepeat = 'no-repeat';
      cell.style.backgroundPosition = 'center';
      playSweepSfx('sfx/boomMinesfx.mp3');
      minesRevealAll(result.bombPositions);
      minesMessageEl.textContent = 'Boom! Game over.';
      minesEndGame();
      return;
    }

    cell.classList.add('minesRevealedSafe');
    cell.style.backgroundImage = "url('images/money.png')";
    cell.style.backgroundSize = '60%';
    cell.style.backgroundRepeat = 'no-repeat';
    cell.style.backgroundPosition = 'center';
    playSweepSfx('sfx/slotDingsfx.mp3');
    minesUpdateMultiplier(result.multiplier);
    minesCashoutBtn.disabled = false;

    if (result.gameOver && result.won) {
      minesRevealAll(result.bombPositions);
      minesMessageEl.textContent = `All safe tiles! You won $${result.payout}!`;
      playSweepSfx('sfx/betprsfx.mp3');
      minesEndGame();
    } else {
      minesMessageEl.textContent = `Safe! Revealed: ${result.revealedCount}. Cash out or continue.`;
    }
  }

  async function minesCashOut() {
    if (!minesGameActive || !minesSessionId) return;
    minesCashoutBtn.disabled = true;
    const result = await playGame({ game: 'mines', action: 'cashout', sessionId: minesSessionId });
    if (result.error) { alert(result.error); minesCashoutBtn.disabled = false; return; }
    minesRevealAll(result.bombPositions);
    minesMessageEl.textContent = `Cashed out! You won $${result.payout}!`;
    playSweepSfx('sfx/betprsfx.mp3');
    minesEndGame();
  }

  function minesRevealAll(bombPositions) {
    document.querySelectorAll('.mines-cell').forEach((cell, i) => {
      const isBomb = bombPositions.includes(i);
      const revealed = cell.classList.contains('minesRevealedSafe') || cell.classList.contains('minesRevealedBomb');
      if (revealed) return;
      cell.classList.add(isBomb ? 'minesRevealedBomb' : 'minesRevealedSafe');
      cell.style.backgroundImage = isBomb ? "url('images/boom.png')" : "url('images/money.png')";
      cell.style.backgroundSize = '60%';
      cell.style.backgroundRepeat = 'no-repeat';
      cell.style.backgroundPosition = 'center';
      cell.classList.add('minesGreyed');
    });
  }

  function minesEndGame() {
    minesGameActive = false;
    minesSessionId = null;
    minesStartBtn.disabled = false;
    minesCashoutBtn.disabled = true;
  }

  minesStartBtn?.addEventListener('click', minesStartGame);
  minesCashoutBtn?.addEventListener('click', minesCashOut);
  minesSetupGrid();
  universalInitializeBalance();
});
