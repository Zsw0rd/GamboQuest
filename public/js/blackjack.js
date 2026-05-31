let blackjackAudioEnabled = true;
let bjSessionId = null;
let bjBet = 0;

function toggleBlackjackAudio() {
  blackjackAudioEnabled = !blackjackAudioEnabled;
  const icon = document.getElementById('bjAudioToggle');
  if (!icon) return;
  icon.textContent = blackjackAudioEnabled ? AUDIO_ON_ICON : AUDIO_OFF_ICON;
  icon.style.color = blackjackAudioEnabled ? 'gold' : 'red';
}

function bjDisableBetButtons() {
  document.querySelectorAll('#bettingArea button').forEach((b) => { b.disabled = true; });
}

function bjEnableBetButtons() {
  document.querySelectorAll('#bettingArea button').forEach((b) => { b.disabled = false; });
}

function bjRenderHand(hand, containerId, hideFirst = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  hand.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    const img = hideFirst && i === 0 ? 'images/cards/back_card.png' : cardImg(card);
    el.style.backgroundImage = `url('${img}')`;
    container.appendChild(el);
  });
}

function bjHandValue(hand) {
  let v = 0, aces = 0;
  hand.forEach((c) => {
    if (['J', 'Q', 'K'].includes(c.rank)) v += 10;
    else if (c.rank === 'A') { v += 11; aces++; }
    else v += parseInt(c.rank, 10);
  });
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

async function bjAnimateDeal(playerHand, dealerHand) {
  document.getElementById('hitButton').disabled = true;
  document.getElementById('standButton').disabled = true;
  bjRenderHand([], 'playerCards');
  bjRenderHand([], 'dealerCards');

  await delay(400);
  bjRenderHand([dealerHand[0]], 'dealerCards');
  playSfx('sfx/cardsDrawnsfx.mp3', blackjackAudioEnabled);
  await delay(500);
  bjRenderHand(playerHand.slice(0, 1), 'playerCards');
  playSfx('sfx/cardsDrawnsfx.mp3', blackjackAudioEnabled);
  await delay(500);
  bjRenderHand(dealerHand.slice(0, 1), 'dealerCards');
  playSfx('sfx/cardsDrawnsfx.mp3', blackjackAudioEnabled);
  await delay(500);
  bjRenderHand(playerHand, 'playerCards');
  playSfx('sfx/cardsDrawnsfx.mp3', blackjackAudioEnabled);
}

async function blackJackPlaceBet(amount) {
  if (bjSessionId) return;
  const balance = getStoredBalance();
  if (balance < amount) { showErrorPopup('Insufficient balance!'); return; }

  bjBet = amount;
  bjDisableBetButtons();
  document.getElementById('currentBet').textContent = `$${amount}`;
  document.getElementById('gameMessage').textContent = 'Dealing...';

  const result = await playGame({ game: 'blackjack', action: 'start', bet: amount });
  if (result.error) {
    showErrorPopup(result.error);
    bjEnableBetButtons();
    return;
  }

  bjSessionId = result.sessionId;
  await bjAnimateDeal(result.playerHand, result.dealerHand);

  if (result.gameOver) {
    bjRenderHand(result.dealerHand, 'dealerCards', false);
    bjEndRound(result);
    return;
  }

  document.getElementById('hitButton').disabled = false;
  document.getElementById('standButton').disabled = false;
  document.getElementById('gameMessage').textContent = `Your hand: ${bjHandValue(result.playerHand)}`;
}

async function blackJackHit() {
  if (!bjSessionId) return;
  document.getElementById('hitButton').disabled = true;
  const result = await playGame({ game: 'blackjack', action: 'hit', sessionId: bjSessionId });
  if (result.error) {
    showErrorPopup(result.error);
    document.getElementById('hitButton').disabled = false;
    return;
  }

  playSfx('sfx/cardsDrawnsfx.mp3', blackjackAudioEnabled);
  bjRenderHand(result.playerHand, 'playerCards');

  if (result.gameOver) {
    bjEndRound(result);
    return;
  }

  document.getElementById('gameMessage').textContent = `Your hand: ${result.playerValue}`;
  document.getElementById('hitButton').disabled = false;
}

async function blackJackStand() {
  if (!bjSessionId) return;
  document.getElementById('hitButton').disabled = true;
  document.getElementById('standButton').disabled = true;
  document.getElementById('gameMessage').textContent = 'Dealer plays...';

  const result = await playGame({ game: 'blackjack', action: 'stand', sessionId: bjSessionId });
  if (result.error) {
    showErrorPopup(result.error);
    document.getElementById('hitButton').disabled = false;
    document.getElementById('standButton').disabled = false;
    return;
  }

  const dealerHand = result.dealerHand;
  let shown = [dealerHand[0]];
  bjRenderHand(shown, 'dealerCards', false);

  for (let i = 1; i < dealerHand.length; i++) {
    await delay(600);
    shown = dealerHand.slice(0, i + 1);
    bjRenderHand(shown, 'dealerCards', false);
    playSfx('sfx/cardsDrawnsfx.mp3', blackjackAudioEnabled);
  }

  bjEndRound(result);
}

function bjEndRound(result) {
  const msg = document.getElementById('gameMessage');
  if (result.result === 'win' || result.result === 'blackjack') {
    msg.textContent = `You win! +$${result.payout}`;
    playSfx('sfx/winsfx.mp3', blackjackAudioEnabled);
  } else if (result.result === 'tie') {
    msg.textContent = `Push - bet returned ($${result.payout})`;
  } else {
    msg.textContent = 'You lose!';
    playSfx('sfx/slotLosesfx.mp3', blackjackAudioEnabled);
  }
  bjSessionId = null;
  bjBet = 0;
  document.getElementById('currentBet').textContent = '$0';
  document.getElementById('hitButton').disabled = true;
  document.getElementById('standButton').disabled = true;
  bjEnableBetButtons();
}

document.addEventListener('DOMContentLoaded', () => universalInitializeBalance());
