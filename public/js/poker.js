let pokerAudioEnabled = true;
let pokerSessionId = null;

function togglePokerAudio() {
  pokerAudioEnabled = !pokerAudioEnabled;
  const icon = document.getElementById('pokerAudioToggle');
  if (!icon) return;
  icon.textContent = pokerAudioEnabled ? AUDIO_ON_ICON : AUDIO_OFF_ICON;
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
  let shownCommunityCount = 0;

  function pokerMsg(msg) { if (gameMsgEl) gameMsgEl.textContent = msg; }
  function pokerPot(p) { if (potEl) potEl.textContent = formatCurrency(p); }
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

  function setCardImage(id, card) {
    const el = document.getElementById(id);
    if (!el || !card) return;
    el.src = `images/cards/${card}.png`;
    el.dataset.card = card;
  }

  function showCommCards(cards, street) {
    const ids = ['comm-card-1', 'comm-card-2', 'comm-card-3', 'comm-card-4', 'comm-card-5'];
    const count = street === 'flop' ? 3 : street === 'turn' ? 4 : street === 'river' || street === 'showdown' ? 5 : 0;
    for (let i = 0; i < count; i++) {
      const el = document.getElementById(ids[i]);
      if (el && cards[i] && el.dataset.card !== cards[i]) {
        el.src = `images/cards/${cards[i]}.png`;
        el.dataset.card = cards[i];
        if (i >= shownCommunityCount) playPokerSfx('sfx/cardsDrawnsfx.mp3');
      }
    }
    shownCommunityCount = Math.max(shownCommunityCount, count);
  }

  function resetTableCards() {
    shownCommunityCount = 0;
    [
      'player-card-1',
      'player-card-2',
      'bot1-card-1',
      'bot1-card-2',
      'bot2-card-1',
      'bot2-card-2',
      'comm-card-1',
      'comm-card-2',
      'comm-card-3',
      'comm-card-4',
      'comm-card-5',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.src = 'images/cards/back_card.png';
        el.dataset.card = 'back';
      }
    });
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
    resetTableCards();
    pokerMsg('Dealing new hand...');

    const result = await playGame({ game: 'poker', action: 'new_hand', buyIn: 50 });
    if (result.error) {
      showErrorPopup(result.error);
      pokerDisableBtns();
      if (newGameBtn) newGameBtn.disabled = false;
      return;
    }

    pokerSessionId = result.sessionId;
    pokerPot(result.pot);
    showPlayerCards(result.playerCards);
    pokerMsg('Preflop - your turn.');
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

    if (result.error) { showErrorPopup(result.error); pokerEnableBtns(); return; }

    processEvents(result.events);
    if (result.state) {
      pokerPot(result.state.pot);
      showCommCards(result.state.commCards, result.state.street);
    }

    if (result.revealed) {
      if (result.revealed.bot1Cards) {
        setCardImage('bot1-card-1', result.revealed.bot1Cards[0]);
        setCardImage('bot1-card-2', result.revealed.bot1Cards[1]);
      }
      if (result.revealed.bot2Cards) {
        setCardImage('bot2-card-1', result.revealed.bot2Cards[0]);
        setCardImage('bot2-card-2', result.revealed.bot2Cards[1]);
      }
      showCommCards(result.revealed.commCards, 'showdown');
    }

    if (result.gameOver) {
      pokerSessionId = null;
      const handText = result.playerHand ? ` with ${result.playerHand}` : '';
      const winningHandText = result.winningHand ? ` with ${result.winningHand}` : '';
      const winnerLabel = result.winner === 'bot1' ? 'Bot 1' : result.winner === 'bot2' ? 'Bot 2' : 'Opponent';
      if (result.winner === 'player') {
        pokerMsg(result.tie
          ? `Split pot${result.payout ? ` - you receive ${formatCurrency(result.payout)}` : ''}${handText}.`
          : `You win${result.payout ? ` ${formatCurrency(result.payout)}` : ''}${handText}!`);
        playPokerSfx('sfx/winsfx.mp3');
      } else {
        pokerMsg(`${winnerLabel} wins the pot${winningHandText}.`);
        playPokerSfx('sfx/slotLosesfx.mp3');
      }
      if (newGameBtn) newGameBtn.disabled = false;
    } else {
      pokerMsg('Your turn...');
      pokerEnableBtns();
    }
  }

  betBtn?.addEventListener('click', () => pokerDoAction('bet'));
  raiseBtn?.addEventListener('click', () => pokerDoAction('raise', 100));
  foldBtn?.addEventListener('click', () => pokerDoAction('fold'));
  newGameBtn?.addEventListener('click', pokerStartGame);

  universalInitializeBalance();
  pokerStartGame();
});
