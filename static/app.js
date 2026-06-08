const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

const API_URL = window.location.origin;
let currentLanguage = "RU";
let selectedTarget = "all";

// Языковой пакет
const dictionary = {
    RU: {
        logsTitle: "Системный журнал",
        broadcastTitle: "Параметры запуска рассылки",
        labelTarget: "1. Область действия кампании",
        labelCooldown: "2. Задержка (CoolDown): ",
        labelCycles: "3. Количество циклов повторения",
        btnLaunch: "Запустить рассылку",
        btnNext: "Далее",
        btnConfirm: "Подтвердить",
        connecting: "Подключение к серверам...",
        verifying: "Проверка кода сессии...",
        faqTitle: "Часто задаваемые вопросы (FAQ)",
        accTitle: "Мультиаккаунты"
    },
    EU: {
        logsTitle: "System Logs",
        broadcastTitle: "Broadcast Parameters",
        labelTarget: "1. Target Scope",
        labelCooldown: "2. Delay (CoolDown): ",
        labelCycles: "3. Total Cycles Count",
        btnLaunch: "Launch Campaign",
        btnNext: "Next",
        btnConfirm: "Confirm",
        connecting: "Connecting to servers...",
        verifying: "Verifying code...",
        faqTitle: "Frequently Asked Questions",
        accTitle: "Multi-Accounts"
    }
};

// Переключение темы (Светлая / Темная)
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-theme');
    
    if (isDark) {
        body.classList.replace('dark-theme', 'light-theme');
        document.querySelector('.icon-moon').style.display = 'none';
        document.querySelector('.icon-sun').style.display = 'block';
    } else {
        body.classList.replace('light-theme', 'dark-theme');
        document.querySelector('.icon-sun').style.display = 'none';
        document.querySelector('.icon-moon').style.display = 'block';
    }
    triggerHaptic();
}

// Смена языка интерфейса
function toggleLanguage() {
    currentLanguage = currentLanguage === "RU" ? "EU" : "RU";
    document.getElementById("lang-label").innerText = currentLanguage;
    
    // Перевод контента
    const t = dictionary[currentLanguage];
    document.getElementById("txt-logs-title").innerText = t.logsTitle;
    document.getElementById("txt-broadcast-title").innerText = t.broadcastTitle;
    document.getElementById("txt-label-target").innerText = t.labelTarget;
    document.getElementById("txt-label-cycles").innerText = t.labelCycles;
    document.getElementById("btn-launch").innerText = t.btnLaunch;
    document.getElementById("btn-next").innerText = t.btnNext;
    document.getElementById("btn-confirm").innerText = t.btnConfirm;
    document.getElementById("txt-faq-title").innerText = t.faqTitle;
    document.getElementById("txt-accounts-title").innerText = t.accTitle;
    
    updateCooldownLabel();
    triggerHaptic();
}

function updateCooldownLabel() {
    const val = document.getElementById("cooldown-slider").value;
    const suffix = currentLanguage === "RU" ? "с" : "s";
    document.getElementById("txt-label-cooldown").innerText = `${dictionary[currentLanguage].labelCooldown}${val}${suffix}`;
}

document.getElementById("cooldown-slider").addEventListener("input", updateCooldownLabel);

// Обработка Первого шага авторизации
async function submitStep1() {
    const payload = {
        api_id: document.getElementById("api-id").value,
        api_hash: document.getElementById("api-hash").value,
        phone: document.getElementById("phone").value
    };

    if (!payload.api_id || !payload.api_hash || !payload.phone) return;

    const overlay = document.getElementById("status-overlay");
    document.getElementById("overlay-text").innerText = dictionary[currentLanguage].connecting;
    overlay.classList.add("active");

    try {
        const res = await fetch(`${API_URL}/api/auth/step1`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            // Анимационный переход на шаг 2
            document.getElementById("auth-slider").style.transform = "translateX(-50%)";
        }
    } catch (e) {
        console.error(e);
    } finally {
        overlay.classList.remove("active");
    }
}

// Обработка Второго шага авторизации
async function submitStep2() {
    const code = document.getElementById("auth-code").value;
    if (!code) return;

    const overlay = document.getElementById("status-overlay");
    document.getElementById("overlay-text").innerText = dictionary[currentLanguage].verifying;
    overlay.classList.add("active");

    try {
        const res = await fetch(`${API_URL}/api/auth/step2`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                phone: document.getElementById("phone").value,
                code: code
            })
        });
        
        if (res.ok) {
            if (tg) tg.showAlert("Success!");
            // Возвращаем слайдер в исходное состояние
            document.getElementById("auth-slider").style.transform = "translateX(0)";
            document.getElementById("auth-code").value = "";
        } else {
            const err = await res.json();
            if (tg) tg.showAlert(`Error: ${err.detail}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        overlay.classList.remove("active");
        fetchLogs();
    }
}

// Подгрузка логов
async function fetchLogs() {
    try {
        const res = await fetch(`${API_URL}/api/logs`);
        const data = await res.json();
        const box = document.getElementById("logs-box");
        box.innerHTML = "";
        
        data.logs.forEach(log => {
            const item = document.createElement("div");
            item.className = `log-item ${log.type}`;
            
            // Динамический выбор иконки (без эмодзи)
            let iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
            if (log.type === "success") {
                iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
            }
            
            item.innerHTML = `${iconSvg}<span>${log.text}</span>`;
            box.appendChild(item);
        });
        box.scrollTop = box.scrollHeight;
    } catch (e) {
        console.error(e);
    }
}

// Логика параметров рассылки
function setTarget(type, btn) {
    selectedTarget = type;
    document.querySelectorAll(".segment-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("chats-input-container").style.display = type === "selected" ? "block" : "none";
    triggerHaptic();
}

async function launchCampaign() {
    const payload = {
        target: selectedTarget,
        chats: document.getElementById("target-chats").value,
        cooldown: parseInt(document.getElementById("cooldown-slider").value),
        cycles: parseInt(document.getElementById("cycles-count").value)
    };

    const res = await fetch(`${API_URL}/api/broadcast`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    if (res.ok && tg) {
        tg.showAlert("Campaign Launched!");
        fetchLogs();
    }
}

// Модальные окна
function openModal(id) { document.getElementById(id).style.display = "flex"; triggerHaptic(); }
function closeModal(id) { document.getElementById(id).style.display = "none"; }

function triggerHaptic() {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
}

// Анимация при скролле (Intersection Observer)
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

observer.observe(document.getElementById('broadcast-panel'));

// Старт
fetchLogs();
setInterval(fetchLogs, 4000);
