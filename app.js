// app.js

// ═══════════════════════════════════════
// TELEGRAM WEBAPP INIT
// ═══════════════════════════════════════

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#080808');
  tg.setBackgroundColor('#080808');
}

const BOT_TOKEN = '8946158118:AAENzQ0R_vR2S7Bua3HQuZkSyUxOXkaeqJY';

// Pull Telegram user data
const tgUser = tg?.initDataUnsafe?.user;
if (tgUser && !state.userId) {
  setState({
    userId: tgUser.id,
    username: tgUser.username || '',
    firstName: tgUser.first_name || 'User',
    photoUrl: tgUser.photo_url || '',
  });
}

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════

function showToast(msg, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ═══════════════════════════════════════
// LANGUAGE SELECTION
// ═══════════════════════════════════════

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('rb_lang', lang);
  const overlay = document.getElementById('lang-overlay');
  overlay.classList.add('exit');
  setTimeout(() => {
    overlay.style.display = 'none';
    bootApp();
  }, 500);
}

// Auto-skip lang if already chosen
window.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('rb_lang');
  if (savedLang) {
    currentLang = savedLang;
    document.getElementById('lang-overlay').style.display = 'none';
    bootApp();
  }
  // Code input auto-focus
  setupCodeInputs();
});

// ═══════════════════════════════════════
// BOOT APP
// ═══════════════════════════════════════

function bootApp() {
  const app = document.getElementById('app');
  app.classList.remove('hidden');
  app.classList.add('visible');
  applyTranslations();
  renderCurrentPage();
}

// ═══════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════

let currentPage = 'home';

function switchPage(page) {
  if (page === currentPage) return;
  const oldPage = document.getElementById(`page-${currentPage}`);
  const newPage = document.getElementById(`page-${page}`);
  oldPage?.classList.remove('active');
  newPage?.classList.add('active', 'slide-in');
  setTimeout(() => newPage?.classList.remove('slide-in'), 350);

  document.querySelectorAll('.nav-item').forEach((btn, i) => {
    const pages = ['home', 'profile', 'subscription', 'settings'];
    btn.classList.toggle('active', pages[i] === page);
  });

  currentPage = page;
  renderCurrentPage();
}

function renderCurrentPage() {
  switch (currentPage) {
    case 'home': renderHome(); break;
    case 'profile': renderProfile(); break;
    case 'subscription': renderSubscription(); break;
    case 'settings': renderSettings(); break;
  }
}

// ═══════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════

function renderHome() {
  const el = document.getElementById('home-content');
  if (!state.hasSubscription) {
    el.innerHTML = renderNoSubscription();
  } else if (!state.isRegistered) {
    el.innerHTML = renderRegistrationFlow();
    startRegistrationSteps();
  } else {
    el.innerHTML = renderBroadcastForm();
    initBroadcastForm();
  }
}

function renderNoSubscription() {
  return `
    <div class="glass-card" style="text-align:center; padding: 40px 24px;">
      <div style="font-size:48px; margin-bottom:16px;">🚀</div>
      <h3 style="font-family:var(--font-display); font-size:20px; font-weight:700; margin-bottom:8px; color:var(--text);">${t('sub_choose')}</h3>
      <p style="color:var(--text2); font-size:13px; margin-bottom:24px; line-height:1.6;">${t('sub_choose_sub')}</p>
      <button class="btn-primary" onclick="switchPage('subscription')">${t('sub_title')} →</button>
    </div>
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text" style="color:var(--text3);">${currentLang === 'ru' ? 'Купите подписку чтобы начать' : 'Purchase a subscription to get started'}</div>
    </div>
  `;
}

// ═══════════════════════════════════════
// REGISTRATION FLOW
// ═══════════════════════════════════════

let regStep = 0;
const regData = { hashId: '', hashApi: '', phone: '' };

function renderRegistrationFlow() {
  return `
    <div class="glass-card">
      <div class="section-label">${t('reg_title')}</div>
      <div class="step-indicator" id="reg-dots">
        <div class="step-dot active" id="dot-0"></div>
        <div class="step-dot" id="dot-1"></div>
        <div class="step-dot" id="dot-2"></div>
      </div>
      <div id="reg-step-content" class="step-wrapper"></div>
    </div>
  `;
}

function startRegistrationSteps() {
  regStep = 0;
  showRegStep(0);
}

function showRegStep(step) {
  regStep = step;
  updateRegDots(step);
  const content = document.getElementById('reg-step-content');
  if (!content) return;

  const steps = [
    {
      label: t('reg_hash_id'),
      hint: t('reg_hash_id_hint'),
      id: 'reg-hash-id',
      type: 'text',
      icon: '🔑',
    },
    {
      label: t('reg_hash_api'),
      hint: t('reg_hash_api_hint'),
      id: 'reg-hash-api',
      type: 'text',
      icon: '🔐',
    },
    {
      label: t('reg_number'),
      hint: t('reg_number_hint'),
      id: 'reg-phone',
      type: 'tel',
      icon: '📱',
    },
  ];

  const s = steps[step];
  content.innerHTML = `
    <div class="step-item">
      <div style="text-align:center; font-size:32px; margin-bottom:12px;">${s.icon}</div>
      <div class="input-group">
        <label class="input-label">${s.label}</label>
        <input class="glass-input" id="${s.id}" type="${s.type}"
          placeholder="${s.hint}" autocomplete="off" />
      </div>
      <div style="margin-top:16px;">
        <button class="btn-primary" onclick="regNext(${step})">${step === 2 ? t('reg_send_code') : t('reg_next')}</button>
      </div>
    </div>
  `;

  setTimeout(() => document.getElementById(s.id)?.focus(), 100);
}

function updateRegDots(step) {
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.className = 'step-dot';
    if (i < step) dot.classList.add('done');
    if (i === step) dot.classList.add('active');
  }
}

async function regNext(step) {
  const ids = ['reg-hash-id', 'reg-hash-api', 'reg-phone'];
  const val = document.getElementById(ids[step])?.value?.trim();
  if (!val) {
    showToast(currentLang === 'ru' ? 'Введите значение' : 'Enter a value', 'error');
    return;
  }

  if (step === 0) regData.hashId = val;
  if (step === 1) regData.hashApi = val;
  if (step === 2) {
    regData.phone = val;
    await sendVerificationCode();
    return;
  }

  // Animate exit
  const content = document.getElementById('reg-step-content');
  const item = content.querySelector('.step-item');
  if (item) {
    item.classList.add('exit');
    setTimeout(() => showRegStep(step + 1), 350);
  } else {
    showRegStep(step + 1);
  }
}

async function sendVerificationCode() {
  showToast(currentLang === 'ru' ? 'Отправляем код...' : 'Sending code...', '');
  // In real implementation: call your backend to send code via Telethon
  // Here we simulate it
  setTimeout(() => {
    openCodeModal();
  }, 800);
}

function openCodeModal() {
  document.getElementById('code-modal').classList.remove('hidden');
  setTimeout(() => document.querySelector('.code-input')?.focus(), 100);
}

async function verifyCode() {
  const inputs = document.querySelectorAll('.code-input');
  const code = Array.from(inputs).map(i => i.value).join('');
  if (code.length < 5) {
    showToast(currentLang === 'ru' ? 'Введите полный код' : 'Enter full code', 'error');
    return;
  }

  // Simulate verification — in production, call your backend
  showToast(currentLang === 'ru' ? 'Проверяем...' : 'Verifying...', '');

  setTimeout(() => {
    setState({
      isRegistered: true,
      hashId: regData.hashId,
      hashApi: regData.hashApi,
      phone: regData.phone,
    });
    document.getElementById('code-modal').classList.add('hidden');
    showToast(currentLang === 'ru' ? '✅ Регистрация завершена!' : '✅ Registration complete!', 'success');
    renderHome();
  }, 1200);
}

// ═══════════════════════════════════════
// CODE INPUT SETUP
// ═══════════════════════════════════════

function setupCodeInputs() {
  const inputs = document.querySelectorAll('.code-input');
  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && i < inputs.length - 1) {
        inputs[i + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].focus();
        inputs[i - 1].value = '';
      }
    });
  });
}

// ═══════════════════════════════════════
// BROADCAST FORM
// ═══════════════════════════════════════

let broadcastData = {
  text: '',
  cycles: 1,
  cooldown: 5,
  type: 'all',
  selectedFolders: [],
};

const mockFolders = [
  { id: 1, name: 'Маркетинг', icon: '📢', count: 42 },
  { id: 2, name: 'Продажи', icon: '💰', count: 18 },
  { id: 3, name: 'Клиенты', icon: '👥', count: 73 },
  { id: 4, name: 'Партнёры', icon: '🤝', count: 12 },
  { id: 5, name: 'Новости', icon: '📰', count: 56 },
  { id: 6, name: 'Чаты', icon: '💬', count: 31 },
];

function renderBroadcastForm() {
  return `
    <div class="glass-card broadcast-step">
      <div class="step-num">1</div>
      <div class="section-label">${t('bc_text')}</div>
      <textarea class="glass-input" id="bc-text" rows="4"
        placeholder="${t('bc_text_ph')}"
        oninput="broadcastData.text=this.value"></textarea>
    </div>

    <div class="glass-card broadcast-step">
      <div class="step-num">2</div>
      <div class="section-label">${t('bc_cycles')}</div>
      <input class="glass-input" id="bc-cycles" type="number"
        min="1" max="999" value="1"
        placeholder="${t('bc_cycles_ph')}"
        oninput="broadcastData.cycles=parseInt(this.value)||1" />
    </div>

    <div class="glass-card broadcast-step">
      <div class="step-num">3</div>
      <div class="section-label">${t('bc_cooldown')}</div>
      <input class="glass-input" id="bc-cooldown" type="number"
        min="1" max="3600" value="5"
        placeholder="${t('bc_cooldown_ph')}"
        oninput="broadcastData.cooldown=parseInt(this.value)||5" />
    </div>

    <div class="glass-card broadcast-step">
      <div class="step-num">4</div>
      <div class="section-label">${t('bc_target')}</div>
      <div class="send-type-btns">
        <button class="send-type-btn selected" id="type-all"
          onclick="setBroadcastType('all')">
          <span class="type-icon">💬</span>
          <span>${t('bc_all_chats')}</span>
          <span style="font-size:10px;color:var(--text3)">${t('bc_all_chats_desc')}</span>
        </button>
        <button class="send-type-btn" id="type-folder"
          onclick="setBroadcastType('folder')">
          <span class="type-icon">📁</span>
          <span>${t('bc_by_folder')}</span>
          <span style="font-size:10px;color:var(--text3)">${t('bc_by_folder_desc')}</span>
        </button>
      </div>
      <div id="folder-selector" style="display:none;">
        <button class="btn-secondary" style="width:100%" onclick="openFolderModal()">
          📂 ${t('bc_choose_folders')}
          <span id="folder-count-badge" style="margin-left:8px; color:var(--accent);"></span>
        </button>
      </div>
    </div>

    <div id="bc-status-area"></div>

    <button class="btn-primary" id="bc-start-btn" onclick="validateAndStartBroadcast()"
      style="margin-bottom:32px;">
      ${t('bc_start')}
    </button>
  `;
}

function initBroadcastForm() {
  broadcastData = { text: '', cycles: 1, cooldown: 5, type: 'all', selectedFolders: [] };
}

function setBroadcastType(type) {
  broadcastData.type = type;
  document.getElementById('type-all')?.classList.toggle('selected', type === 'all');
  document.getElementById('type-folder')?.classList.toggle('selected', type === 'folder');
  const folderSel = document.getElementById('folder-selector');
  if (folderSel) folderSel.style.display = type === 'folder' ? 'block' : 'none';
}

function validateAndStartBroadcast() {
  broadcastData.text = document.getElementById('bc-text')?.value?.trim();
  broadcastData.cycles = parseInt(document.getElementById('bc-cycles')?.value) || 1;
  broadcastData.cooldown = parseInt(document.getElementById('bc-cooldown')?.value) || 5;

  if (!broadcastData.text) {
    showToast(currentLang === 'ru' ? 'Введите рекламный текст' : 'Enter ad text', 'error');
    return;
  }
  if (broadcastData.type === 'folder' && broadcastData.selectedFolders.length === 0) {
    showToast(currentLang === 'ru' ? 'Выберите хотя бы одну папку' : 'Select at least one folder', 'error');
    return;
  }

  if (broadcastData.type === 'folder') {
    openReviewModal();
  } else {
    startBroadcast();
  }
}

// ═══════════════════════════════════════
// FOLDER MODAL
// ═══════════════════════════════════════

function openFolderModal() {
  const list = document.getElementById('folder-list');
  list.innerHTML = mockFolders.map(f => `
    <div class="folder-item ${broadcastData.selectedFolders.includes(f.id) ? 'selected' : ''}"
      onclick="toggleFolder(${f.id})" id="folder-${f.id}">
      <div class="folder-check">
        ${broadcastData.selectedFolders.includes(f.id) ? '<span style="color:#fff;font-size:11px;">✓</span>' : ''}
      </div>
      <span class="folder-icon">${f.icon}</span>
      <span class="folder-name">${f.name}</span>
      <span class="folder-count">${f.count}</span>
    </div>
  `).join('');
  document.getElementById('folder-modal').classList.remove('hidden');
}

function toggleFolder(id) {
  const idx = broadcastData.selectedFolders.indexOf(id);
  if (idx === -1) {
    broadcastData.selectedFolders.push(id);
  } else {
    broadcastData.selectedFolders.splice(idx, 1);
  }
  // Re-render item
  const folder = mockFolders.find(f => f.id === id);
  const el = document.getElementById(`folder-${id}`);
  if (el) {
    el.className = `folder-item ${broadcastData.selectedFolders.includes(id) ? 'selected' : ''}`;
    el.querySelector('.folder-check').innerHTML =
      broadcastData.selectedFolders.includes(id) ? '<span style="color:#fff;font-size:11px;">✓</span>' : '';
  }
}

function closeFolderModal() {
  document.getElementById('folder-modal').classList.add('hidden');
  // Update badge
  const badge = document.getElementById('folder-count-badge');
  if (badge && broadcastData.selectedFolders.length > 0) {
    badge.textContent = `(${broadcastData.selectedFolders.length})`;
  }
}

function confirmFolders() {
  if (broadcastData.selectedFolders.length === 0) {
    showToast(currentLang === 'ru' ? 'Выберите папку' : 'Select a folder', 'error');
    return;
  }
  closeFolderModal();
}

// ═══════════════════════════════════════
// REVIEW MODAL
// ═══════════════════════════════════════

function openReviewModal() {
  const list = document.getElementById('review-list');
  const selectedFolderObjects = mockFolders.filter(f => broadcastData.selectedFolders.includes(f.id));
  list.innerHTML = selectedFolderObjects.map(f => `
    <div class="review-item" onclick="removeFromReview(${f.id})">
      <span class="folder-icon">${f.icon}</span>
      <span class="folder-name">${f.name}</span>
      <span class="folder-count">${f.count} ${currentLang === 'ru' ? 'чатов' : 'chats'}</span>
      <span class="review-remove">✕</span>
    </div>
  `).join('');
  document.getElementById('review-modal').classList.remove('hidden');
}

function removeFromReview(id) {
  broadcastData.selectedFolders = broadcastData.selectedFolders.filter(f => f !== id);
  if (broadcastData.selectedFolders.length === 0) {
    closeReviewModal();
    return;
  }
  openReviewModal();
}

function closeReviewModal() {
  document.getElementById('review-modal').classList.add('hidden');
}

// ═══════════════════════════════════════
// BROADCAST EXECUTION
// ═══════════════════════════════════════

let broadcastInterval = null;
let broadcastProgress = 0;

function startBroadcast() {
  closeReviewModal();
  setState({ broadcastActive: true });

  const statusArea = document.getElementById('bc-status-area');
  if (statusArea) {
    statusArea.innerHTML = `
      <div class="broadcast-status">
        <div class="status-label pulse">${t('bc_running')}</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="font-size:13px; color:var(--text2);" id="bc-progress-text">0 / ${broadcastData.cycles}</span>
          <span style="font-size:13px; color:var(--accent);" id="bc-eta">-</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" id="bc-progress-fill" style="width:0%"></div>
        </div>
        <div style="margin-top:12px;">
          <button class="btn-danger" onclick="stopBroadcast()">${t('bc_stop')}</button>
        </div>
      </div>
    `;
  }

  document.getElementById('bc-start-btn').style.display = 'none';

  broadcastProgress = 0;
  broadcastInterval = setInterval(() => {
    broadcastProgress++;
    const pct = Math.round((broadcastProgress / broadcastData.cycles) * 100);
    const fill = document.getElementById('bc-progress-fill');
    const text = document.getElementById('bc-progress-text');
    const eta = document.getElementById('bc-eta');

    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${broadcastProgress} / ${broadcastData.cycles}`;
    const remaining = (broadcastData.cycles - broadcastProgress) * broadcastData.cooldown;
    if (eta) eta.textContent = remaining > 0 ? `~${remaining}с` : '✓';

    // Update stats
    setState({
      stats: {
        ...state.stats,
        sent: (state.stats.sent || 0) + 1,
        cycles: (state.stats.cycles || 0) + 1,
      }
    });

    if (broadcastProgress >= broadcastData.cycles) {
      clearInterval(broadcastInterval);
      setState({ broadcastActive: false });
      showToast(currentLang === 'ru' ? '✅ Рассылка завершена!' : '✅ Broadcast complete!', 'success');
      setTimeout(() => renderHome(), 1500);
    }
  }, broadcastData.cooldown * 1000);
}

function stopBroadcast() {
  if (broadcastInterval) clearInterval(broadcastInterval);
  setState({ broadcastActive: false });
  showToast(currentLang === 'ru' ? 'Рассылка остановлена' : 'Broadcast stopped', '');
  document.getElementById('bc-start-btn').style.display = 'block';
  const statusArea = document.getElementById('bc-status-area');
  if (statusArea) statusArea.innerHTML = '';
}

// ═══════════════════════════════════════
// SUBSCRIPTION PAGE
// ═══════════════════════════════════════

let selectedPlan = 'pro';
let selectedPayment = 'stars';

function renderSubscription() {
  const el = document.getElementById('subscription-content');
  el.innerHTML = `
    <p class="text-muted mb-8" style="margin-bottom:20px;">${t('sub_choose_sub')}</p>

    <!-- PLAN CARDS -->
    <div class="sub-card" onclick="selectPlan('basic')" id="plan-basic">
      <div class="sub-name">⚡ ${t('sub_plan_basic')}</div>
      <div class="sub-price">299 <span class="sub-period">${currentLang === 'ru' ? '⭐ / мес' : '⭐ / mo'}</span></div>
      <div class="sub-features">
        <div class="sub-feature">${currentLang === 'ru' ? '500 сообщений/день' : '500 messages/day'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? '1 аккаунт' : '1 account'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? 'Все чаты' : 'All chats'}</div>
      </div>
    </div>

    <div class="sub-card popular" onclick="selectPlan('pro')" id="plan-pro">
      <div class="sub-badge">⭐ Popular</div>
      <div class="sub-name">🚀 ${t('sub_plan_pro')}</div>
      <div class="sub-price">799 <span class="sub-period">${currentLang === 'ru' ? '⭐ / мес' : '⭐ / mo'}</span></div>
      <div class="sub-features">
        <div class="sub-feature">${currentLang === 'ru' ? 'Безлимит сообщений' : 'Unlimited messages'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? '3 аккаунта' : '3 accounts'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? 'Папки и фильтры' : 'Folders & filters'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? 'Приоритетная поддержка' : 'Priority support'}</div>
      </div>
    </div>

    <div class="sub-card" onclick="selectPlan('ultra')" id="plan-ultra">
      <div class="sub-name">💎 ${t('sub_plan_ultra')}</div>
      <div class="sub-price">1499 <span class="sub-period">${currentLang === 'ru' ? '⭐ / мес' : '⭐ / mo'}</span></div>
      <div class="sub-features">
        <div class="sub-feature">${currentLang === 'ru' ? 'Всё из Pro' : 'Everything in Pro'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? '10 аккаунтов' : '10 accounts'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? 'API доступ' : 'API access'}</div>
        <div class="sub-feature">${currentLang === 'ru' ? 'Белый лейбл' : 'White label'}</div>
      </div>
    </div>

    <div class="section-label mt-16" style="margin-top:24px;">${t('sub_pay_title')}</div>
    <div class="payment-methods">
      <button class="payment-btn ${selectedPayment === 'stars' ? 'selected' : ''}"
        onclick="selectPayment('stars')">
        <span class="payment-icon">⭐</span>
        <span>Stars</span>
      </button>
      <button class="payment-btn ${selectedPayment === 'crypto' ? 'selected' : ''}"
        onclick="selectPayment('crypto')">
        <span class="payment-icon">🤖</span>
        <span>CryptoBot</span>
      </button>
      <button class="payment-btn ${selectedPayment === 'sbp' ? 'selected' : ''}"
        onclick="selectPayment('sbp')">
        <span class="payment-icon">🏦</span>
        <span>СБП</span>
      </button>
    </div>

    <button class="btn-primary" onclick="purchaseSubscription()" style="margin-bottom:32px;">
      ${currentLang === 'ru' ? '💳 Оплатить подписку' : '💳 Purchase Subscription'}
    </button>
  `;

  highlightSelectedPlan();
}

function selectPlan(plan) {
  selectedPlan = plan;
  highlightSelectedPlan();
}

function highlightSelectedPlan() {
  ['basic', 'pro', 'ultra'].forEach(p => {
    const card = document.getElementById(`plan-${p}`);
    if (!card) return;
    if (p === selectedPlan) {
      card.style.borderColor = 'rgba(79,140,255,0.6)';
      card.style.background = 'rgba(79,140,255,0.1)';
    } else {
      card.style.borderColor = '';
      card.style.background = '';
    }
  });
}

function selectPayment(method) {
  selectedPayment = method;
  document.querySelectorAll('.payment-btn').forEach(btn => btn.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

async function purchaseSubscription() {
  const prices = { basic: 299, pro: 799, ultra: 1499 };
  const price = prices[selectedPlan];

  if (selectedPayment === 'stars' && tg) {
    // Telegram Stars payment
    tg.openInvoice(`https://t.me/${BOT_TOKEN}`, (status) => {
      if (status === 'paid') {
        onSubscriptionPurchased();
      }
    });
    // Fallback simulation
    simulatePurchase();
  } else {
    simulatePurchase();
  }
}

function simulatePurchase() {
  showToast(currentLang === 'ru' ? '⏳ Обработка оплаты...' : '⏳ Processing payment...', '');
  setTimeout(() => {
    onSubscriptionPurchased();
  }, 1500);
}

function onSubscriptionPurchased() {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 1);
  setState({
    hasSubscription: true,
    subscriptionPlan: selectedPlan,
    subscriptionExpiry: expiry.toISOString(),
  });
  showToast(currentLang === 'ru' ? '✅ Подписка активирована!' : '✅ Subscription activated!', 'success');
  setTimeout(() => switchPage('home'), 800);
}

// ═══════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════

function renderProfile() {
  const el = document.getElementById('profile-content');
  const name = state.firstName || (tgUser?.first_name) || 'User';
  const username = state.username || (tgUser?.username) || '';
  const photo = state.photoUrl || (tgUser?.photo_url) || '';
  const planLabels = { basic: '⚡ Basic', pro: '🚀 Pro', ultra: '💎 Ultra' };
  const planLabel = planLabels[state.subscriptionPlan] || '—';
  const subActive = state.hasSubscription;

  const expiry = state.subscriptionExpiry
    ? new Date(state.subscriptionExpiry).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US')
    : '—';

  el.innerHTML = `
    <div class="glass-card profile-hero">
      <div class="avatar-ring">
        <div class="avatar-inner">
          ${photo ? `<img src="${photo}" alt="avatar" />` : `<span>${name[0]?.toUpperCase() || '?'}</span>`}
        </div>
      </div>
      <div class="profile-name">${name}</div>
      ${username ? `<div class="profile-username">@${username}</div>` : ''}
      <div class="profile-sub-badge">
        ${subActive ? `✅ ${planLabel}` : `❌ ${t('pr_sub_inactive')}`}
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-value">${state.stats.sent || 0}</div>
        <div class="stat-label">${t('pr_stat_sent')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${state.stats.cycles || 0}</div>
        <div class="stat-label">${t('pr_stat_cycles')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${state.stats.chats || 0}</div>
        <div class="stat-label">${t('pr_stat_chats')}</div>
      </div>
    </div>

    <div class="glass-card">
      <div class="section-label">${t('pr_subscription')}</div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
        <span style="color:var(--text2); font-size:14px;">${currentLang === 'ru' ? 'План' : 'Plan'}</span>
        <span style="font-weight:600; color:var(--text);">${planLabel}</span>
      </div>
      <div class="divider"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
        <span style="color:var(--text2); font-size:14px;">${currentLang === 'ru' ? 'Истекает' : 'Expires'}</span>
        <span style="font-weight:500; color:var(--text);">${expiry}</span>
      </div>
      <div class="divider"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
        <span style="color:var(--text2); font-size:14px;">${currentLang === 'ru' ? 'Аккаунт' : 'Account'}</span>
        <span style="font-weight:500; color:${state.isRegistered ? 'var(--success)' : 'var(--danger)'};">
          ${state.isRegistered ? (currentLang === 'ru' ? 'Подключён' : 'Connected') : (currentLang === 'ru' ? 'Не подключён' : 'Not connected')}
        </span>
      </div>
    </div>

    ${state.isRegistered ? `
    <div class="glass-card">
      <div class="section-label">${currentLang === 'ru' ? 'Аккаунт Userbot' : 'Userbot Account'}</div>
      <div style="color:var(--text2); font-size:13px; margin-bottom:8px;">${state.phone}</div>
      <button class="btn-danger" onclick="disconnectAccount()">
        ${currentLang === 'ru' ? '🔌 Отключить аккаунт' : '🔌 Disconnect account'}
      </button>
    </div>
    ` : ''}

    <div style="margin-bottom: 32px;">
      <button class="btn-danger" onclick="confirmLogout()">
        ${t('pr_logout')}
      </button>
    </div>
  `;
}

function disconnectAccount() {
  if (confirm(currentLang === 'ru' ? 'Отключить аккаунт?' : 'Disconnect account?')) {
    resetRegistration();
    showToast(currentLang === 'ru' ? 'Аккаунт отключён' : 'Account disconnected', '');
    renderProfile();
  }
}

function confirmLogout() {
  if (confirm(currentLang === 'ru' ? 'Выйти из приложения?' : 'Sign out?')) {
    resetAll();
    location.reload();
  }
}

// ═══════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════

function renderSettings() {
  const el = document.getElementById('settings-content');
  el.innerHTML = `
    <div class="glass-card" style="padding:0; overflow:hidden;">
      <div class="settings-item" onclick="changeLang()">
        <div class="settings-item-left">
          <span class="settings-icon">🌍</span>
          <span class="settings-label">${t('st_language')}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="settings-value">${currentLang === 'ru' ? '🇷🇺 Русский' : '🇪🇺 English'}</span>
          <span class="settings-chevron">›</span>
        </div>
      </div>

      <div class="settings-item" onclick="toggleNotifs()">
        <div class="settings-item-left">
          <span class="settings-icon">🔔</span>
          <span class="settings-label">${t('st_notifications')}</span>
        </div>
        <div class="toggle ${state.notifications ? 'on' : ''}" id="notif-toggle"></div>
      </div>

      <div class="settings-item">
        <div class="settings-item-left">
          <span class="settings-icon">🌙</span>
          <span class="settings-label">${t('st_theme')}</span>
        </div>
        <span class="settings-value">${t('st_dark')}</span>
      </div>
    </div>

    <div class="glass-card" style="padding:0; overflow:hidden; margin-top:16px;">
      <div class="settings-item" onclick="openSupport()">
        <div class="settings-item-left">
          <span class="settings-icon">💬</span>
          <span class="settings-label">${t('st_support')}</span>
        </div>
        <span class="settings-chevron">›</span>
      </div>

      <div class="settings-item">
        <div class="settings-item-left">
          <span class="settings-icon">ℹ️</span>
          <span class="settings-label">${t('st_about')}</span>
        </div>
        <span class="settings-value">${t('st_version')}</span>
      </div>
    </div>

    <div style="margin-top:16px; margin-bottom:32px;">
      <button class="btn-danger" onclick="confirmLogout()">${t('st_logout')}</button>
    </div>

    <div style="text-align:center; color:var(--text3); font-size:11px; padding-bottom:8px;">
      RassylkaBot v1.0.0 · rassylkabot.vercel.app
    </div>
  `;
}

function changeLang() {
  currentLang = currentLang === 'ru' ? 'en' : 'ru';
  localStorage.setItem('rb_lang', currentLang);
  applyTranslations();
  renderCurrentPage();
  showToast(currentLang === 'ru' ? 'Язык изменён' : 'Language changed', '');
}

function toggleNotifs() {
  setState({ notifications: !state.notifications });
  const toggle = document.getElementById('notif-toggle');
  if (toggle) toggle.classList.toggle('on', state.notifications);
}

function openSupport() {
  if (tg) {
    tg.openTelegramLink('https://t.me/support');
  }
      }
