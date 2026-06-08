// Инициализация Telegram WebApp SDK
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

// Проставляем Username из ТГ, если есть
const userId = tg?.initDataUnsafe?.user?.id || 8501149575;
document.getElementById('prof-username').innerText = tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : `@id${userId}`;

const API_BASE_URL = window.location.origin;

// Логика переключения страниц (Home, Profile, Sub)
function switchPage(pageName) {
    // Убираем старую страницу
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-node').forEach(n => n.classList.remove('active'));
    
    // Включаем новую
    document.getElementById(`page-${pageName}`).classList.add('active-page');
    document.getElementById(`nav-btn-${pageName}`).classList.add('active');
    
    // Виброотклик при переключении меню
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    if (pageName === 'home') {
        loadLogs();
        checkUserStatusAndRender();
    }
}

// Логика выбора языка (RU/EU) на старт
function selectLang(lang) {
    localStorage.setItem('miniapp_lang', lang);
    document.getElementById('modal-lang-choice').style.display = 'none';
    document.getElementById('app-viewport').style.display = 'flex';
    translateInterface();
}

// Запоминание и перевод интерфейса
function translateInterface() {
    const lang = localStorage.getItem('miniapp_lang') || 'RU';
    document.getElementById('txt-lang-indicator').innerText = lang;
    
    // Перевод контента в зависимости от языка
    // const d = dictionary[lang];
    // document.getElementById('lbl-btn-next').innerText = d.btnNext;
    // ... (добавить полный перевод для всех лейблов)
}

// Проверка статуса оплаты и сессии для отрисовки Главной
async function checkUserStatusAndRender() {
    const response = await fetch(`${API_BASE_URL}/api/user_status/${userId}`);
    const data = await response.json();
    
    const purchaseMenu = document.getElementById('purchase-menu');
    const authMenu = document.getElementById('auth-menu');
    
    // Если сессия уже есть, скрываем покупку и авторизацию
    if (data.has_session) {
        purchaseMenu.style.display = 'none';
        authMenu.style.display = 'none';
        loadLogs();
        return;
    }
    
    // Если не оплачено, показываем только меню покупки
    if (!data.is_paid) {
        purchaseMenu.style.display = 'flex';
        authMenu.style.display = 'none';
    } else {
        // Оплачено, но сессии нет -> показываем авторизацию
        purchaseMenu.style.display = 'none';
        authMenu.style.display = 'flex';
        renderStep1(); // Инициализация первого шага
    }
}

// Пошаговая регистрация
function renderStep1() {
    document.getElementById('reg-carousel').style.transform = 'translateX(0)';
    document.getElementById('inp-code').value = '';
    document.getElementById('inp-api-id').value = '';
    document.getElementById('inp-api-hash').value = '';
    document.getElementById('inp-phone').value = '';
    
    // Анимация вылета api_id
    document.getElementById('field-api-id').style.display = 'flex';
    document.getElementById('field-api-id').classList.add('fade-in');
    
    document.getElementById('field-api-hash').style.display = 'none';
    document.getElementById('field-phone').style.display = 'none';
}

async function processRegFields() {
    const payload = {
        user_id: userId,
        api_id: document.getElementById('inp-api-id').value,
        api_hash: document.getElementById('inp-api-hash').value,
        phone: document.getElementById("inp-phone").value
    };

    if (!payload.api_id || !payload.api_hash || !payload.phone) return;

    // Оверлей подключения
    const overlay = document.getElementById('status-overlay');
    overlay.classList.add('active');

    const res = await fetch(`${API_BASE_URL}/api/auth/step1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    overlay.classList.remove('active');

    if (res.ok) {
        // Красивое переключение на шаг 2 (ввод кода)
        document.getElementById('reg-carousel').style.transform = 'translateX(-50%)';
    } else {
        tg?.showAlert('Ошибка отправки запроса в API.');
    }
}

async function processRegCode() {
    const payload = {
        user_id: userId,
        phone: document.getElementById("inp-phone").value,
        code: document.getElementById('inp-code').value
    };

    if (!payload.code) return;

    // Оверлей подключения
    const overlay = document.getElementById('status-overlay');
    overlay.classList.add('active');

    const res = await fetch(`${API_BASE_URL}/api/auth/step2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    overlay.classList.remove('active');

    if (res.ok) {
        tg?.showAlert('🎉 Юзербот успешно запущен на вашем аккаунте!');
        checkUserStatusAndRender(); // Перерисовать главную (скрыть авторизацию)
    } else {
        const data = await res.json();
        tg?.showAlert(`❌ Ошибка: ${data.detail}`);
    }
}

// Загрузка логов
async function loadLogs() {
    const logsBox = document.getElementById('logs-render-box');
    const logsPanel = document.getElementById('logs-panel');
    
    const res = await fetch(`${API_BASE_URL}/api/logs`);
    const data = await res.json();
    
    if (!data.logs || data.logs.length === 0) {
        logsPanel.style.display = 'none'; // Если логов нет, скрываем панель
        return;
    }
    
    logsPanel.style.display = 'flex';
    logsBox.innerHTML = '';
    data.logs.forEach(log => {
        const logNode = document.createElement('div');
        logNode.className = `log-node ${log.type}`;
        
        let icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        if (log.type === 'success') {
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        
        logNode.innerHTML = `${icon}<span>${log.text}</span>`;
        logsBox.appendChild(logNode);
    });
    logsBox.scrollTop = logsBox.scrollHeight; // Автоскролл
}

// Конструктор рассылки (Таргет, КД, Циклы)
let adTarget = 'all';

function setTarget(target) {
    adTarget = target;
    document.getElementById('btn-bc-all').classList.toggle('active', target === 'all');
    document.getElementById('btn-bc-select').classList.toggle('active', target === 'selected');
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// Функция пошаговой разблокировки ввода в bc
function enableNextNode(step) {
    if (step === 1) { // text typed
        if (document.getElementById('inp-ad-text').value.length > 5) {
            document.getElementById('node-cycles').classList.remove('disabled-node');
            document.getElementById('inp-cycles').disabled = false;
        }
    } else if (step === 2) { // cycles typed
        if (document.getElementById('inp-cycles').value > 0) {
            document.getElementById('node-cooldown').classList.remove('disabled-node');
            document.getElementById('inp-cooldown').disabled = false;
            document.getElementById('lbl-btn-fire').classList.remove('disabled-node');
            document.getElementById('lbl-btn-fire').disabled = false;
        }
    }
}

async function launchAdCampaign() {
    const payload = {
        text: document.getElementById('inp-ad-text').value,
        target: adTarget,
        cycles: parseInt(document.getElementById('inp-cycles').value),
        cooldown: parseInt(document.getElementById('inp-cooldown').value)
    };

    const res = await fetch(`${API_BASE_URL}/api/broadcast/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (res.ok) {
        tg?.showAlert('Рассылка запущена!');
        // Очистить поля (демо)
    }
}

// Тема, Язык
function switchTheme() {
    b = document.body;
    if (b.classList.contains('dark-theme')) {
        b.classList.replace('dark-theme', 'light-theme');
    } else {
        b.classList.replace('light-theme', 'dark-theme');
    }
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function toggleLanguage() {
    tg?.showAlert('Доступные языки: EU / RU. Переключение настраивается через меню выбора на старте.');
}

// Скролл-анимация bc-panel
const bcPanel = document.getElementById('broadcast-panel');
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
        }
    });
}, { threshold: 0.1 });

scrollObserver.observe(bcPanel);

// Профиль: Delete Session
function confirmDeleteSession() {
    tg?.showConfirm('🗑 Вы уверены, что хотите удалить рабочую сессию юзербота? Это вернет меню регистрации на Home.', async (ok) => {
        if (ok) {
            const res = await fetch(`${API_BASE_URL}/api/session/delete/${userId}`, { method: 'POST' });
            if (res.ok) {
                switchPage('home'); // Вернуться, там обновится статус
            }
        }
    });
}

// Демо-оплата СБП/Крипто
function handleSBPDemo() { tg?.showAlert('Здесь будет подключение шлюза СБП. Доступ зачислится автоматически.'); db_activate_payment_demo(); }
function handleCryptoBotDemo() { tg?.showAlert('Здесь будет кнопка оплаты CryptoBot API. Доступ зачислится автоматически.'); db_activate_payment_demo(); }
function db_activate_payment_demo() { checkUserStatusAndRender(); } // Просто перерисовать для демо

// ПЕРВИЧНЫЙ ЗАПУСК
// Проверяем, есть ли язык
if (!localStorage.getItem('miniapp_lang')) {
    document.getElementById('modal-lang-choice').style.display = 'flex';
    document.getElementById('app-viewport').style.display = 'none';
} else {
    translateInterface();
    switchPage('home'); // Старт
}
setInterval(loadLogs, 4000); // Обновлять логи каждые 4 сек
