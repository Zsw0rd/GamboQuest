let rouletteAudioEnabled = true;

function toggleRouletteAudio() {
  rouletteAudioEnabled = !rouletteAudioEnabled;
  const icon = document.getElementById('rouletteAudioToggle');
  if (!icon) return;
  icon.textContent = rouletteAudioEnabled ? AUDIO_ON_ICON : AUDIO_OFF_ICON;
  icon.style.color = rouletteAudioEnabled ? 'gold' : 'red';
}

function playRouletteSfx(url) {
  playSfx(url, rouletteAudioEnabled);
}

function initRouletteGame() {
  let isSpinning = false;
  let selectedCoinValue = 10;
  let bets = {};

  const spinBtn = document.getElementById('spinBtn');
  const clearBtn = document.getElementById('clearBtn');
  const rouletteMessage = document.getElementById('rouletteMessage');
  const wheel = document.getElementById('rouletteWheel');

  if (wheel) wheel.style.transition = 'transform 6s cubic-bezier(0.32, 0.64, 0.45, 1)';

  window.selectCoin = function (el) {
    document.querySelectorAll('.coin-img').forEach((ci) => ci.classList.remove('coin-selected'));
    el.classList.add('coin-selected');
    const amount = parseInt(el.dataset.amount, 10);
    if (Number.isSafeInteger(amount) && amount > 0) selectedCoinValue = amount;
  };

  window.placeBet = function (spot) {
    if (isSpinning) { showErrorPopup('Cannot place bets while spinning!'); return; }
    const pending = Object.values(bets).reduce((a, b) => a + b, 0);
    const balance = getStoredBalance();
    if (balance < pending + selectedCoinValue) { showErrorPopup('Insufficient balance!'); return; }
    if (!bets[spot]) bets[spot] = 0;
    bets[spot] += selectedCoinValue;
    if (rouletteMessage) {
      const total = Object.values(bets).reduce((a, b) => a + b, 0);
      rouletteMessage.textContent = `Bet $${selectedCoinValue} on ${spot}. Pending total: $${total}`;
    }
    playRouletteSfx('sfx/betprsfx.mp3');
  };

  window.clearBets = function () {
    if (isSpinning) return;
    bets = {};
    if (rouletteMessage) rouletteMessage.textContent = 'All bets cleared!';
  };

  window.spinWheel = async function () {
    if (isSpinning) return;
    let totalBet = 0;
    for (const k in bets) totalBet += bets[k];
    if (totalBet <= 0) { showErrorPopup('Place a bet first!'); return; }

    isSpinning = true;
    if (spinBtn) spinBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    playRouletteSfx('sfx/slotSpinsfx.mp3');
    if (rouletteMessage) rouletteMessage.textContent = 'Spinning...';

    const betsCopy = { ...bets };
    bets = {};

    const [result] = await Promise.all([
      playGame({ game: 'roulette', action: 'spin', bets: betsCopy }),
      delay(300),
    ]);

    if (result.error) {
      showErrorPopup(result.error);
      isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
      return;
    }

    if (wheel) wheel.style.transform = `rotate(${result.finalAngle}deg)`;

    setTimeout(() => {
      if (rouletteMessage) {
        rouletteMessage.textContent = result.totalWon > 0
          ? `Number ${result.winningNum}! You won $${result.totalWon}!`
          : `Number ${result.winningNum}. Better luck next time.`;
      }
      if (result.totalWon > 0) playRouletteSfx('sfx/slotJackpotsfx.mp3');
      else playRouletteSfx('sfx/slotLosesfx.mp3');

      setTimeout(() => {
        isSpinning = false;
        if (spinBtn) spinBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
        if (wheel) {
          wheel.style.transition = 'none';
          wheel.style.transform = 'rotate(0deg)';
          wheel.offsetHeight;
          wheel.style.transition = 'transform 6s cubic-bezier(0.32,0.64,0.45,1)';
        }
      }, 1200);
    }, 6000);
  };

  window.showBetInfo = function () {
    const overlay = document.getElementById('betsInfoOverlay');
    const list = document.getElementById('betsList');
    if (!overlay || !list) return;

    list.replaceChildren();
    const entries = Object.entries(bets);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No active bets yet.';
      list.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      entries.forEach(([spot, amount]) => {
        const li = document.createElement('li');
        li.textContent = `${spot}: $${amount}`;
        ul.appendChild(li);
      });
      list.appendChild(ul);
    }

    overlay.style.display = 'block';
  };

  window.closeBetInfo = function () {
    const overlay = document.getElementById('betsInfoOverlay');
    if (overlay) overlay.style.display = 'none';
  };

  window.hoverInside = function (el, active) {
    if (el) el.classList.toggle('highlighted', Boolean(active));
  };

  window.hoverOutside = function (key, active) {
    document.querySelectorAll('.bet-image, .bet-outside, .bet-zero').forEach((el) => {
      const match = el.dataset.outside === key ||
        el.dataset.range === key ||
        el.dataset.dozen === key ||
        el.dataset.color === key ||
        el.dataset.evenodd === key;
      if (match) el.classList.toggle('highlighted', Boolean(active));
    });
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  await universalInitializeBalance();
  initRouletteGame();
});
