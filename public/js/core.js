/* GAMBOQUEST core: auth, wallet, game API, popups, performance utilities */

const AUDIO_ON_ICON = '\u{1F50A}';
const AUDIO_OFF_ICON = '\u{1F507}';
const GAME_CURRENCY = 'GQC';

function formatCurrency(amount) {
  return `${amount} ${GAME_CURRENCY}`;
}

function ensurePopupRoot() {
  let root = document.getElementById('gamboquestPopupRoot');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'gamboquestPopupRoot';
  root.className = 'popup-root';
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'false');
  document.body.appendChild(root);
  return root;
}

function showPopup(message, type = 'info', timeout = 4200) {
  const root = ensurePopupRoot();
  const popup = document.createElement('div');
  const cleanType = ['success', 'error', 'info'].includes(type) ? type : 'info';
  popup.className = `gamboquest-popup gamboquest-popup-${cleanType}`;
  popup.setAttribute('role', cleanType === 'error' ? 'alert' : 'status');

  const text = document.createElement('span');
  text.textContent = String(message || 'Something happened.');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'gamboquest-popup-close';
  close.setAttribute('aria-label', 'Dismiss message');
  close.textContent = 'x';

  const dismiss = () => {
    popup.classList.add('is-hiding');
    window.setTimeout(() => popup.remove(), 180);
  };
  close.addEventListener('click', dismiss);

  popup.append(text, close);
  root.appendChild(popup);
  window.setTimeout(dismiss, timeout);
}

function showErrorPopup(message) {
  showPopup(message, 'error');
}

function showSuccessPopup(message) {
  showPopup(message, 'success');
}

function storeAuthSession(data) {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('tokenExpiresAt', String(data.expiresAt || ''));
  localStorage.setItem('username', data.username);
  localStorage.setItem('balance', String(data.balance));
}

function clearAuthSession() {
  ['accessToken', 'refreshToken', 'tokenExpiresAt', 'username', 'balance', 'sessionToken'].forEach((k) =>
    localStorage.removeItem(k)
  );
}

function isLoggedIn() {
  return Boolean(localStorage.getItem('accessToken'));
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('accessToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function refreshAuthSession() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) return false;
    storeAuthSession(data);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithAuth(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    if (await refreshAuthSession()) {
      res = await fetch(url, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      });
    }
  }
  return res;
}

async function ensureGuestSession() {
  if (isLoggedIn()) return null;
  let token = sessionStorage.getItem('guestToken');
  if (token) return token;
  const res = await fetch('/api/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not start guest session');
  sessionStorage.setItem('guestToken', data.guestToken);
  sessionStorage.setItem('guestBalance', String(data.balance));
  return data.guestToken;
}

function applyServerBalance(balance) {
  if (isLoggedIn()) localStorage.setItem('balance', String(balance));
  else sessionStorage.setItem('guestBalance', String(balance));
  universalUpdateDisplayBalance();
}

function getStoredBalance() {
  if (isLoggedIn()) return parseInt(localStorage.getItem('balance') || '0', 10);
  return parseInt(sessionStorage.getItem('guestBalance') || '0', 10);
}

async function playGame(payload) {
  if (!isLoggedIn()) {
    payload.guestToken = await ensureGuestSession();
  }
  const res = await fetchWithAuth('/api/game', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error || 'Game request failed' };
  }
  if (typeof data.balance === 'number') applyServerBalance(data.balance);
  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const _audioCache = new Map();
function playSfx(url, enabled = true) {
  if (!enabled || !url) return;
  try {
    let base = _audioCache.get(url);
    if (!base) {
      base = new Audio(url);
      base.preload = 'auto';
      _audioCache.set(url, base);
    }
    const sfx = base.cloneNode();
    sfx.play().catch(() => {});
  } catch {}
}

function universalOpenPage(page) {
  window.location.href = page;
}

async function userSignupWithEmail(username, email, password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'signup', username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) { showErrorPopup(data.error || 'Signup failed'); return false; }
  if (data.requiresEmailConfirmation) {
    showPopup(data.message || 'Check your email to confirm your account.', 'info');
    return false;
  }
  storeAuthSession(data);
  return true;
}

async function userLoginWithEmail(email, password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password }),
  });
  const data = await res.json();
  if (!res.ok) { showErrorPopup(data.error || 'Login failed'); return false; }
  storeAuthSession(data);
  return true;
}

async function userGuestLogin() {
  clearAuthSession();
  localStorage.setItem('username', 'Guest');
  try {
    await ensureGuestSession();
  } catch {
    sessionStorage.setItem('guestBalance', '1000');
  }
  window.location.href = 'gamindex.html';
}

async function userLogout() {
  if (isLoggedIn()) {
    try {
      await fetchWithAuth('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) });
    } catch {}
  }
  clearAuthSession();
  sessionStorage.removeItem('guestToken');
  sessionStorage.removeItem('guestBalance');
  window.location.href = 'index.html';
}

async function getUserBalance() {
  if (!isLoggedIn()) return getStoredBalance();
  const res = await fetchWithAuth('/api/balance', {
    method: 'POST',
    body: JSON.stringify({ action: 'get' }),
  });
  const data = await res.json();
  if (!res.ok) return 0;
  applyServerBalance(data.balance);
  if (data.username) localStorage.setItem('username', data.username);
  return data.balance;
}

async function claimDailyBonus() {
  if (!isLoggedIn()) { showErrorPopup('Log in to claim your daily bonus.'); return; }
  const res = await fetchWithAuth('/api/balance', {
    method: 'POST',
    body: JSON.stringify({ action: 'claim_daily_bonus' }),
  });
  const data = await res.json();
  if (!res.ok) { showErrorPopup(data.error || 'Could not claim daily bonus'); return; }
  applyServerBalance(data.balance);
  showSuccessPopup(`Daily bonus claimed: +${formatCurrency(100)}`);
}

function universalUpdateDisplayBalance() {
  const balEl = document.getElementById('balance');
  if (!balEl) return;
  const username = localStorage.getItem('username') || 'Guest';
  const bal = getStoredBalance();
  balEl.textContent = `User: ${username} | Balance: ${formatCurrency(bal)}`;
}

async function universalInitializeBalance() {
  if (isLoggedIn()) await getUserBalance();
  else await ensureGuestSession().catch(() => {
    if (!sessionStorage.getItem('guestBalance')) sessionStorage.setItem('guestBalance', '1000');
  });
  universalUpdateDisplayBalance();
}

async function handleSignup(ev) {
  ev.preventDefault();
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  if (await userSignupWithEmail(username, email, password)) window.location.href = 'gamindex.html';
}

async function handleLogin(ev) {
  ev.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (await userLoginWithEmail(email, password)) window.location.href = 'gamindex.html';
}

function homeFilterCards() {
  const query = document.getElementById('searchBar')?.value.toLowerCase() || '';
  let anyVisible = false;
  document.querySelectorAll('.slotcard').forEach((card) => {
    const name = card.querySelector('h2')?.textContent.toLowerCase() || '';
    const show = name.includes(query);
    card.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });
  const msg = document.getElementById('noResultsMessage');
  if (msg) msg.style.display = anyVisible ? 'none' : 'block';
}

function cardImg(card) {
  return `images/cards/${card.suit}_${card.rank}.png`;
}

function initBackgroundVideo() {
  const video = document.getElementById('bgVideo') || document.getElementById('bgVideolog');
  if (video) {
    video.preload = 'none';
    video.setAttribute('loading', 'lazy');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initBackgroundVideo();
});
