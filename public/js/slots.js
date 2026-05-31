const SLOT_SYMBOLS = [
  { id: 'triple_diamonds', img: 'images/triple_diamonds.png', three: 50, two: 0 },
  { id: 'diamond', img: 'images/diamond.png', three: 25, two: 0 },
  { id: 'coins', img: 'images/coins.png', three: 10, two: 0 },
  { id: 'apple', img: 'images/apple.png', three: 4, two: 1.5 },
  { id: 'mango', img: 'images/mango.png', three: 2, two: 1.3 },
];

let slotAudioEnabled = true;

function toggleSlotAudio() {
  slotAudioEnabled = !slotAudioEnabled;
  const icon = document.getElementById('slotAudioToggle');
  if (!icon) return;
  icon.textContent = slotAudioEnabled ? AUDIO_ON_ICON : AUDIO_OFF_ICON;
  icon.style.color = slotAudioEnabled ? 'gold' : 'red';
}

function startReelSpin(reelId, intervalMs = 80) {
  let idx = 0;
  return setInterval(() => {
    idx = (idx + 1) % SLOT_SYMBOLS.length;
    document.getElementById(reelId).src = SLOT_SYMBOLS[idx].img;
  }, intervalMs);
}

async function stopReel(reelId, targetIndex, intervalId, waitMs) {
  await delay(waitMs);
  clearInterval(intervalId);
  document.getElementById(reelId).src = SLOT_SYMBOLS[targetIndex].img;
  playSfx('sfx/slotDingsfx.mp3', slotAudioEnabled);
}

async function slotPlaySlot() {
  const betInput = document.getElementById('betAmount');
  const resultMessage = document.getElementById('resultMessage');
  const spinButton = document.getElementById('spinButton');
  if (!betInput || !spinButton) return;

  const bet = parseInt(betInput.value, 10);
  const balance = getStoredBalance();
  if (isNaN(bet) || bet <= 0) { showErrorPopup('Please enter a valid bet amount.'); return; }
  if (bet > balance) { showErrorPopup('Insufficient balance.'); return; }

  spinButton.disabled = true;
  resultMessage.textContent = '';
  playSfx('sfx/slotSpinsfx.mp3', slotAudioEnabled);

  const i1 = startReelSpin('slot1');
  const i2 = startReelSpin('slot2');
  const i3 = startReelSpin('slot3');

  const [result] = await Promise.all([
    playGame({ game: 'slots', action: 'spin', bet }),
    delay(900),
  ]);

  if (result.error) {
    clearInterval(i1); clearInterval(i2); clearInterval(i3);
    showErrorPopup(result.error);
    spinButton.disabled = false;
    return;
  }

  await stopReel('slot1', result.reels[0], i1, 400);
  await stopReel('slot2', result.reels[1], i2, 400);
  await stopReel('slot3', result.reels[2], i3, 400);

  if (result.winnings > 0) {
    resultMessage.textContent = `You won $${result.winnings}!`;
    playSfx('sfx/slotJackpotsfx.mp3', slotAudioEnabled);
  } else {
    resultMessage.textContent = 'You lost! Better luck next time.';
    playSfx('sfx/slotLosesfx.mp3', slotAudioEnabled);
  }
  spinButton.disabled = false;
}

document.addEventListener('DOMContentLoaded', async () => {
  await universalInitializeBalance();
});
