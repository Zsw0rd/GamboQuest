let rouletteAudioEnabled = true;

function toggleRouletteAudio() {
  rouletteAudioEnabled = !rouletteAudioEnabled;
  const icon = document.getElementById('rouletteAudioToggle');
  if (!icon) return;
  icon.textContent = rouletteAudioEnabled ? '🔊' : '🔇';
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
    selectedCoinValue = parseInt(el.dataset.amount, 10);
  };

  window.placeBet = function (spot) {
    if (isSpinning) { alert('Cannot place bets while spinning!'); return; }
    const pending = Object.values(bets).reduce((a, b) => a + b, 0);
    const balance = getStoredBalance();
    if (balance < pending + selectedCoinValue) { alert('Insufficient balance!'); return; }
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
    if (totalBet <= 0) { alert('Place a bet first!'); return; }

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
      alert(result.error);
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
}

document.addEventListener('DOMContentLoaded', async () => {
  await universalInitializeBalance();
  initRouletteGame();
});
