let diceAudioEnabled = true;

function toggleDiceAudio() {
  diceAudioEnabled = !diceAudioEnabled;
  const icon = document.getElementById('diceAudioToggle');
  if (!icon) return;
  icon.textContent = diceAudioEnabled ? AUDIO_ON_ICON : AUDIO_OFF_ICON;
  icon.style.color = diceAudioEnabled ? 'gold' : 'red';
}

function initDiceGame() {
  const diceSlider = document.getElementById('diceSlider');
  const diceRoll = document.getElementById('diceRoll');
  const diceChance = document.getElementById('diceChance');
  const diceMultiplier = document.getElementById('diceMultiplier');
  const diceProfit = document.getElementById('diceProfit');
  const diceBetAmount = document.getElementById('diceBetAmount');
  const rollMessage = document.getElementById('rollMessage');
  const diceResultMsg = document.getElementById('diceResultMessage');
  const rollToggleBtn = document.getElementById('rollToggleBtn');
  const sliderTrack = document.querySelector('.slider-track');

  let isRollUnder = true;

  function updateProfit() {
    const bet = parseFloat(diceBetAmount?.value) || 0;
    const mult = parseFloat(diceMultiplier?.value) || 2;
    if (diceProfit) diceProfit.value = (bet * (mult - 1)).toFixed(4);
  }

  function updateSliderTrack() {
    if (!sliderTrack) return;
    const threshold = parseInt(diceRoll?.value, 10) || 50;
    sliderTrack.style.background = isRollUnder
      ? `linear-gradient(to right, blue 0%, blue ${threshold}%, red ${threshold}%, red 100%)`
      : `linear-gradient(to right, red 0%, red ${threshold}%, blue ${threshold}%, blue 100%)`;
  }

  function updateFromValue(val) {
    val = Math.max(2, Math.min(98, val));
    if (diceSlider) diceSlider.value = val;
    if (diceRoll) diceRoll.value = val;
    const chance = isRollUnder ? val : 100 - val;
    if (diceChance) diceChance.value = chance.toFixed(0);
    const mult = (100 / chance) * 0.99;
    if (diceMultiplier) diceMultiplier.value = mult.toFixed(4);
    updateProfit();
    updateSliderTrack();
  }

  diceSlider?.addEventListener('input', () => updateFromValue(parseInt(diceSlider.value, 10)));
  diceRoll?.addEventListener('input', () => updateFromValue(parseInt(diceRoll.value, 10) || 50));
  diceBetAmount?.addEventListener('input', updateProfit);
  rollToggleBtn?.addEventListener('click', () => {
    isRollUnder = !isRollUnder;
    rollToggleBtn.textContent = isRollUnder ? 'Roll Under' : 'Roll Over';
    updateFromValue(parseInt(diceSlider?.value, 10) || 50);
  });

  window.dicePlaceBet = async function () {
    const bet = Math.floor(parseFloat(diceBetAmount?.value) || 0);
    const threshold = parseInt(diceRoll?.value, 10) || 50;
    if (bet <= 0) { showErrorPopup('Invalid bet amount!'); return; }
    if (bet > getStoredBalance()) { showErrorPopup('Insufficient balance!'); return; }

    const rollBtn = document.querySelector('.dice-roll-btn, button[onclick*="dicePlaceBet"]');
    if (rollBtn) rollBtn.disabled = true;

    const animStart = Date.now();
    let display = 0;
    const tick = setInterval(() => {
      display = (display + Math.random() * 15) % 100;
      if (rollMessage) rollMessage.textContent = `Rolling... ${display.toFixed(2)}`;
    }, 40);

    const [result] = await Promise.all([
      playGame({ game: 'dice', action: 'roll', bet, threshold, rollUnder: isRollUnder }),
      delay(700),
    ]);

    clearInterval(tick);
    if (rollBtn) rollBtn.disabled = false;

    if (result.error) { showErrorPopup(result.error); return; }

    if (rollMessage) rollMessage.textContent = `Roll = ${result.rollResult.toFixed(2)}`;
    if (result.won) {
      playSfx('sfx/winsfx.mp3', diceAudioEnabled);
      if (diceResultMsg) diceResultMsg.textContent = `You won $${result.profit}! Balance: $${result.balance}`;
    } else {
      playSfx('sfx/slotLosesfx.mp3', diceAudioEnabled);
      if (diceResultMsg) diceResultMsg.textContent = `You lost $${bet}. Balance: $${result.balance}`;
    }
  };

  updateFromValue(50);
}

document.addEventListener('DOMContentLoaded', async () => {
  await universalInitializeBalance();
  initDiceGame();
});
