let rouletteAudioEnabled = true;
const ROULETTE_MAX_TOTAL_BET = 1000;
const ROULETTE_DEFAULT_COIN_SRC = 'images/bet_coins/10GQC.png';
const ROULETTE_SEGMENT_ANGLE = 360 / 37;
const ROULETTE_WHEEL_SPIN_MS = 5800;
const ROULETTE_BALL_SPIN_MS = 7200;
const ROULETTE_CHIP_SETTLE_MS = 1200;
const ROULETTE_BALL_RIM_TOP = 11;

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
  let selectedCoinSrc = ROULETTE_DEFAULT_COIN_SRC;
  let bets = {};
  let betChipImages = {};
  let currentWheelRotation = 0;
  let currentBallRotation = 0;

  const spinBtn = document.getElementById('spinBtn');
  const clearBtn = document.getElementById('clearBtn');
  const rouletteMessage = document.getElementById('rouletteMessage');
  const wheel = document.getElementById('rouletteWheel');
  const wheelContainer = document.querySelector('.wheel-container');
  const ballTrack = document.getElementById('rouletteBallTrack');
  const ball = document.getElementById('rouletteBall');
  const tableContainer = document.querySelector('.table-container');
  const chipLayer = document.getElementById('rouletteChipLayer');

  if (wheel) wheel.style.transform = `rotate(${currentWheelRotation}deg)`;
  if (ballTrack) ballTrack.style.transform = `rotate(${currentBallRotation}deg)`;
  if (ball) ball.style.top = `${ROULETTE_BALL_RIM_TOP}%`;
  if (wheelContainer) wheelContainer.classList.add('is-ball-on-rim');

  function totalBetAmount(source = bets) {
    return Object.values(source).reduce((sum, amount) => sum + amount, 0);
  }

  function randomIntBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomAngle(min, max) {
    return Math.random() * (max - min) + min;
  }

  function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function shortestAngleDelta(fromAngle, toAngle) {
    let delta = normalizeAngle(toAngle) - normalizeAngle(fromAngle);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function rotationEndingAt(currentRotation, targetAngle, direction, fullSpins) {
    const baseRotation = currentRotation + direction * fullSpins * 360;
    return baseRotation + shortestAngleDelta(baseRotation, targetAngle);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function setWheelRotation(angle) {
    currentWheelRotation = angle;
    if (wheel) wheel.style.transform = `rotate(${angle}deg)`;
  }

  function setBallRotation(angle) {
    currentBallRotation = angle;
    if (ballTrack) ballTrack.style.transform = `rotate(${angle}deg)`;
  }

  function findBetTarget(spot) {
    const allTargets = document.querySelectorAll('.bet-image, .bet-outside, .bet-zero');
    for (const el of allTargets) {
      if (
        el.dataset.spot === spot ||
        el.dataset.outside === spot ||
        el.alt === spot ||
        el.getAttribute('onclick')?.includes(`'${spot}'`)
      ) {
        return el;
      }
    }
    return null;
  }

  function renderBetChips(source = bets) {
    if (!chipLayer || !tableContainer) return;
    chipLayer.replaceChildren();
    const containerRect = tableContainer.getBoundingClientRect();

    Object.entries(source).forEach(([spot, amount]) => {
      const target = findBetTarget(spot);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const chip = document.createElement('div');
      chip.className = 'roulette-chip';
      chip.dataset.spot = spot;
      chip.style.left = `${rect.left + rect.width / 2 - containerRect.left}px`;
      chip.style.top = `${rect.top + rect.height / 2 - containerRect.top}px`;

      const img = document.createElement('img');
      img.src = betChipImages[spot] || selectedCoinSrc || ROULETTE_DEFAULT_COIN_SRC;
      img.alt = '';

      const label = document.createElement('span');
      label.textContent = formatCurrency(amount);

      chip.append(img, label);
      chipLayer.appendChild(chip);
    });
  }

  function startSpinAnimation(result) {
    const wheelSpins = randomIntBetween(4, 7);
    const wheelExtraAngle = randomAngle(0, 360);
    const wheelStartRotation = currentWheelRotation;
    const ballStartRotation = currentBallRotation;
    const finalWheelRotation = wheelStartRotation + wheelSpins * 360 + wheelExtraAngle;
    const wheelIndex = Number.isInteger(result.wheelIndex) ? result.wheelIndex : 0;
    const pocketJitter = randomAngle(-ROULETTE_SEGMENT_ANGLE * 0.42, ROULETTE_SEGMENT_ANGLE * 0.42);
    const targetBallAngle = normalizeAngle(finalWheelRotation + wheelIndex * ROULETTE_SEGMENT_ANGLE + pocketJitter);
    const ballSpins = randomIntBetween(6, 9);
    const finalBallRotation = rotationEndingAt(ballStartRotation, targetBallAngle, -1, ballSpins);

    if (wheelContainer) wheelContainer.classList.add('is-ball-on-rim', 'is-spinning');
    if (ball) ball.style.top = `${ROULETTE_BALL_RIM_TOP}%`;

    return new Promise((resolve) => {
      const startedAt = performance.now();

      function tick(now) {
        const elapsed = now - startedAt;
        const wheelSpinProgress = Math.min(1, elapsed / ROULETTE_WHEEL_SPIN_MS);
        const ballSpinProgress = Math.min(1, elapsed / ROULETTE_BALL_SPIN_MS);
        const wheelProgress = easeOutCubic(wheelSpinProgress);
        const ballProgress = easeOutQuint(ballSpinProgress);

        setWheelRotation(wheelStartRotation + ((finalWheelRotation - wheelStartRotation) * wheelProgress));
        setBallRotation(ballStartRotation + ((finalBallRotation - ballStartRotation) * ballProgress));

        if (wheelSpinProgress < 1 || ballSpinProgress < 1) {
          requestAnimationFrame(tick);
          return;
        }

        setWheelRotation(finalWheelRotation);
        setBallRotation(finalBallRotation);
        if (ball) ball.style.top = `${ROULETTE_BALL_RIM_TOP}%`;
        resolve();
      }

      requestAnimationFrame(tick);
    });
  }

  function settleBetChips(settledBets) {
    document.querySelectorAll('.roulette-chip').forEach((chip) => {
      const settlement = settledBets?.[chip.dataset.spot];
      chip.classList.add(settlement?.won ? 'roulette-chip-win' : 'roulette-chip-lose');
    });
  }

  function highlightWinningSpot(winningNum) {
    const target = findBetTarget(String(winningNum));
    if (!target) return;
    target.classList.add('roulette-winning-spot');
    setTimeout(() => target.classList.remove('roulette-winning-spot'), 2200);
  }

  window.selectCoin = function (el) {
    if (!el) return;
    document.querySelectorAll('.coin-img').forEach((ci) => ci.classList.remove('coin-selected'));
    el.classList.add('coin-selected');
    const amount = parseInt(el.dataset.amount, 10);
    if (Number.isSafeInteger(amount) && amount > 0) selectedCoinValue = amount;
    selectedCoinSrc = el.getAttribute('src') || ROULETTE_DEFAULT_COIN_SRC;
  };

  window.placeBet = function (spot) {
    if (isSpinning) { showErrorPopup('Cannot place bets while spinning!'); return; }
    const pending = totalBetAmount();
    const balance = getStoredBalance();
    if (balance < pending + selectedCoinValue) { showErrorPopup('Insufficient balance!'); return; }
    if (pending + selectedCoinValue > ROULETTE_MAX_TOTAL_BET) {
      showErrorPopup(`Roulette bets are limited to ${formatCurrency(ROULETTE_MAX_TOTAL_BET)} per spin`);
      return;
    }
    if (!bets[spot]) bets[spot] = 0;
    bets[spot] += selectedCoinValue;
    betChipImages[spot] = selectedCoinSrc;
    renderBetChips();
    if (rouletteMessage) {
      const total = totalBetAmount();
      rouletteMessage.textContent = `Bet ${formatCurrency(selectedCoinValue)} on ${spot}. Pending total: ${formatCurrency(total)}`;
    }
    playRouletteSfx('sfx/betprsfx.mp3');
  };

  window.clearBets = function () {
    if (isSpinning) return;
    bets = {};
    betChipImages = {};
    renderBetChips();
    if (rouletteMessage) rouletteMessage.textContent = 'All bets cleared!';
  };

  window.spinWheel = async function () {
    if (isSpinning) return;
    const totalBet = totalBetAmount();
    if (totalBet <= 0) { showErrorPopup('Place a bet first!'); return; }

    isSpinning = true;
    if (spinBtn) spinBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    playRouletteSfx('sfx/slotSpinsfx.mp3');
    if (rouletteMessage) rouletteMessage.textContent = 'Spinning...';

    const betsCopy = { ...bets };
    const betChipImagesCopy = { ...betChipImages };

    const [result] = await Promise.all([
      playGame({ game: 'roulette', action: 'spin', bets: betsCopy }),
      delay(300),
    ]);

    if (result.error) {
      showErrorPopup(result.error);
      bets = betsCopy;
      betChipImages = betChipImagesCopy;
      renderBetChips();
      isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
      return;
    }

    await startSpinAnimation(result);

    if (wheelContainer) wheelContainer.classList.remove('is-spinning');
    highlightWinningSpot(result.winningNum);
    settleBetChips(result.settledBets || {});
    if (rouletteMessage) {
      rouletteMessage.textContent = result.totalWon > 0
        ? `Number ${result.winningNum}! You won ${formatCurrency(result.totalWon)}!`
        : `Number ${result.winningNum}. Better luck next time.`;
    }
    if (result.totalWon > 0) playRouletteSfx('sfx/slotJackpotsfx.mp3');
    else playRouletteSfx('sfx/slotLosesfx.mp3');

    await delay(ROULETTE_CHIP_SETTLE_MS);
    bets = {};
    betChipImages = {};
    renderBetChips();
    isSpinning = false;
    if (spinBtn) spinBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
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
        li.textContent = `${spot}: ${formatCurrency(amount)}`;
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

  window.addEventListener('resize', () => renderBetChips(), { passive: true });
}

document.addEventListener('DOMContentLoaded', async () => {
  await universalInitializeBalance();
  initRouletteGame();
});
