let pokerAudioEnabled = true;
let pokerSessionId = null;

function togglePokerAudio() {
  pokerAudioEnabled = !pokerAudioEnabled;
  const icon = document.getElementById('pokerAudioToggle');
  if (!icon) return;
  icon.textContent = pokerAudioEnabled ? '🔊' : '🔇';
  icon.style.color = pokerAudioEnabled ? 'gold' : 'red';
}

function playPokerSfx(url) {
  playSfx(url, pokerAudioEnabled);
}

document.addEventListener('DOMContentLoaded', () => {
  const gameMsgEl = document.getElementById('game-message');
  const potEl = document.getElementById('pot-value');
  const betBtn = document.getElementById('pokerBet-btn');
  const raiseBtn = document.getElementById('pokerRaise-btn');
  const foldBtn = document.getElementById('pokerFold-btn');
  const newGameBtn = document.getElementById('pokerNew-game-btn');
  const bot1NameEl = document.getElementById('bot1-name');
  const bot2NameEl = document.getElementById('bot2-name');

  function pokerMsg(msg) { if (gameMsgEl) gameMsgEl.textContent = msg; }
  function pokerPot(p) { if (potEl) potEl.textContent = `$${p}`; }
  function pokerDisableBtns() { [betBtn, raiseBtn, foldBtn].forEach((b) => { if (b) b.disabled = true; }); }
  function pokerEnableBtns() {
    if (betBtn) betBtn.disabled = false;
    if (raiseBtn) raiseBtn.disabled = false;
    if (foldBtn) foldBtn.disabled = false;
  }

  function showPlayerCards(cards) {
    if (cards?.[0]) document.getElementById('player-card-1').src = `images/cards/${cards[0]}.png`;
    if (cards?.[1]) document.getElementById('player-card-2').src = `images/cards/${cards[1]}.png`;
  }

  function showCommCards(cards, street) {
    const ids = ['comm-card-1', 'comm-card-2', 'comm-card-3', 'comm-card-4', 'comm-card-5'];
    const count = street === 'flop' ? 3 : street === 'turn' ? 4 : street === 'river' || street === 'showdown' ? 5 : 0;
    for (let i = 0; i < count; i++) {
      const el = document.getElementById(ids[i]);
      if (el && cards[i]) {
        el.src = `images/cards/${cards[i]}.png`;
        playPokerSfx('sfx/cardsDrawnsfx.mp3');
      }
    }
  }

  function processEvents(events) {
    events?.forEach((ev) => {
      if (ev.actor === 'bot1' && ev.action === 'fold') bot1NameEl.textContent = 'Bot 1 (Folded)';
      if (ev.actor === 'bot2' && ev.action === 'fold') bot2NameEl.textContent = 'Bot 2 (Folded)';
      if (ev.action === 'advance_street') pokerMsg(`Street: ${ev.street}`);
    });
  }

  async function pokerStartGame() {
    pokerDisableBtns();
    if (newGameBtn) newGameBtn.disabled = true;
    bot1NameEl.textContent = 'Bot 1';
    bot2NameEl.textContent = 'Bot 2';
    pokerMsg('Dealing new hand...');

    const result = await playGame({ game: 'poker', action: 'new_hand', buyIn: 50 });
    if (result.error) { alert(result.error); pokerEnableBtns(); return; }

    pokerSessionId = result.sessionId;
    pokerPot(result.pot);
    showPlayerCards(result.playerCards);
    pokerMsg("Preflop — your turn.");
    pokerEnableBtns();
  }

  async function pokerDoAction(playerAction, amount = 0) {
    if (!pokerSessionId) return;
    pokerDisableBtns();
    const result = await playGame({
      game: 'poker',
      action: 'action',
      sessionId: pokerSessionId,
      playerAction,
      amount,
    });

    if (result.error) { alert(result.error); pokerEnableBtns(); return; }

    processEvents(result.events);
    if (result.state) {
      pokerPot(result.state.pot);
      showCommCards(result.state.commCards, result.state.street);
    }

    if (result.revealed) {
      if (result.revealed.bot1Cards) {
        document.getElementById('bot1-card-1').src = `images/cards/${result.revealed.bot1Cards[0]}.png`;
        document.getElementById('bot1-card-2').src = `images/cards/${result.revealed.bot1Cards[1]}.png`;
      }
      if (result.revealed.bot2Cards) {
        document.getElementById('bot2-card-1').src = `images/cards/${result.revealed.bot2Cards[0]}.png`;
        document.getElementById('bot2-card-2').src = `images/cards/${result.revealed.bot2Cards[1]}.png`;
      }
      showCommCards(result.revealed.commCards, 'showdown');
    }

    if (result.gameOver) {
      pokerSessionId = null;
      if (result.winner === 'player') {
        pokerMsg(`You win${result.payout ? ` $${result.payout}` : ''}!`);
        playPokerSfx('sfx/winsfx.mp3');
      } else {
        pokerMsg(`${result.winner || 'Opponent'} wins the pot.`);
        playPokerSfx('sfx/slotLosesfx.mp3');
      }
      if (newGameBtn) newGameBtn.disabled = false;
    } else {
      pokerMsg('Your turn...');
      pokerEnableBtns();
    }
  }

  betBtn?.addEventListener('click', () => pokerDoAction('bet'));
  raiseBtn?.addEventListener('click', () => pokerDoAction('raise', 50));
  foldBtn?.addEventListener('click', () => pokerDoAction('fold'));
  newGameBtn?.addEventListener('click', pokerStartGame);

  universalInitializeBalance();
  pokerStartGame();
});
