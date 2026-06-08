const tgWindow = window.Telegram?.WebApp;
if (tgWindow) {
    tgWindow.expand();
    tgWindow.ready();
}

const SERVER_ENDPOINT = window.location.origin;
let activeLang = "RU";
let currentTargetOption = "all";

const localization = {
    RU: {
        btnNext: "Далее",
        btnConfirm: "Подтвердить",
        connecting: "Подключение к серверам...",
        bcTitle: "Параметры рассылки",
        bcScope: "1. Область действия",
        bcCooldown: "2. Задержка (CoolDown): ",
        bcCycles: "3. Циклы",
        btnFire: "Запустить рассыл",
        faqHeader: "FAQ",
        accHeader: "Мультиаккаунты",
        close: "Закрыть"
    },
    EU: {
        btnNext: "Next",
        btnConfirm: "Confirm",
        connecting: "Connecting to servers...",
        bcTitle: "Broadcast Setup",
        bcScope: "1. Target Scope",
        bcCooldown: "2. Delay (CoolDown): ",
        bcCycles: "3. Cycles count",
        btnFire: "Launch Broadcast",
        faqHeader: "Help Center",
        accHeader: "Multi-Accounts",
        close: "Close"
    }
};

function switchTheme() {
    const b = document.body;
    if (b.classList.contains("dark-theme")) {
        b.classList.replace("dark-theme", "light-theme");
        document.querySelector(".moon-icon").style.display = "none";
        document.querySelector(".sun-icon").style.display = "block";
    } else {
        b.classList.replace("light-theme", "dark-theme");
        document.querySelector(".sun-icon").style.display = "none";
        document.querySelector(".moon-icon").style.display = "block";
    }
    vibrate();
}

function toggleLanguage() {
    activeLang = activeLang === "RU" ? "EU" : "RU";
    document.getElementById("lang-indicator").innerText = activeLang;
    
    const pack = localization[activeLang];
    document.getElementById("lbl-btn-next").innerText = pack.btnNext;
    document.getElementById("lbl-btn-confirm").innerText = pack.btnConfirm;
    document.getElementById("lbl-server-connecting").innerText = pack.connecting;
    document.getElementById("lbl-bc-title").innerText = pack.bcTitle;
    document.getElementById("lbl-bc-scope").innerText = pack.bcScope;
    document.getElementById("lbl-bc-cycles").innerText = pack.bcCycles;
    document.getElementById("lbl-btn-fire").innerText = pack.btnFire;
    document.getElementById("lbl-faq-header").innerText = pack.faqHeader;
    document.getElementById("lbl-acc-header").innerText = pack.accHeader;
    document.getElementById("lbl-faq-close").innerText = pack.close;
    document.getElementById("lbl-acc-close").innerText = pack.close;
    
    syncSliderLabel();
    vibrate();
}

function syncSliderLabel() {
    const val = document.getElementById("slider-cooldown").value;
    document.getElementById("val-cooldown").innerText = `${val}s`;
}

// Пошаговый степпер авторизации
async function processStep1() {
    const payload = {
        api_id: document.getElementById("inp-api-id").value,
        api_hash: document.getElementById("inp-api-hash").value,
        phone: document.getElementById("inp-phone").value
    };

    if (!payload.api_id || !payload.api_hash || !payload.phone) return;

    const overlay = document.getElementById("server-status-overlay");
    overlay.classList.add("show");

    try {
        const response = await fetch(`${SERVER_ENDPOINT}/api/auth/step1`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            // Анимационный сдвиг к вводу кода
            document.getElementById("auth-carousel").style.transform = "translateX(-50%)";
        }
    } catch (err) {
        console.error(err);
    } finally {
        overlay.classList.remove("show");
    }
}

async function processStep2() {
    const codeVal = document.getElementById("inp-code").value;
    if (!codeVal) return;

    const overlay = document.getElementById("server-status-overlay");
    overlay.classList.add("show");

    try {
        const response = await fetch(`${SERVER_ENDPOINT}/api/auth/step2`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                phone: document.getElementById("inp-phone").value,
                code: codeVal
            })
        });
        
        if (response.ok) {
            document.getElementById("auth-carousel").style.transform = "translateX(0)";
            document.getElementById("inp-code").value = "";
            if (tgWindow) tgWindow.showAlert("Авторизация выполнена успешно");
        } else {
            if (tgWindow) tgWindow.showAlert("Ошибка проверки кода");
        }
    } catch (err) {
        console.error(err);
    } finally {
        overlay.classList.remove("show");
        loadSystemLogs();
    }
}

// Загрузка логов
async function loadSystemLogs() {
    try {
        const response = await fetch(`${SERVER_ENDPOINT}/api/logs`);
        const data = await response.json();
        const container = document.getElementById("logs-render-container");
        container.innerHTML = "";
        
        data.logs.forEach(item => {
            const row = document.createElement("div");
            row.className = `log-line ${item.type}`;
            
            let icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
            if (item.type === "success") {
                icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            }
            
            row.innerHTML = `${icon}<span>${item.text}</span>`;
            container.appendChild(row);
        });
        container.scrollTop = container.scrollHeight;
    } catch (e) {
        console.error(e);
    }
}

function changeTargetType(type) {
    currentTargetOption = type;
    document.getElementById("btn-tg-all").classList.toggle("active", type === "all");
    document.getElementById("btn-tg-select").classList.toggle("active", type === "selected");
    document.getElementById("chats-box-view").style.display = type === "selected" ? "block" : "none";
    vibrate();
}

async function executeCampaignLaunch() {
    const payload = {
        target_type: currentTargetOption,
        chats: document.getElementById("inp-target-chats").value,
        cooldown: parseInt(document.getElementById("slider-cooldown").value),
        cycles: parseInt(document.getElementById("inp-cycles").value)
    };

    const res = await fetch(`${SERVER_ENDPOINT}/api/broadcast/start`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    
    if (res.ok && tgWindow) {
        tgWindow.showAlert("Рассылка запущена!");
        loadSystemLogs();
    }
}

function toggleModal(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === "flex" ? "none" : "flex";
    vibrate();
}

function vibrate() {
    if (tgWindow?.HapticFeedback) tgWindow.HapticFeedback.impactOccurred("light");
}

// Наблюдатель за скроллом для плавной анимации появления нижнего блока
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("reveal");
        }
    });
}, { threshold: 0.05 });

scrollObserver.observe(document.getElementById("broadcast-panel"));

// Первичный запуск цикла обновлений логов
loadSystemLogs();
setInterval(loadSystemLogs, 4000);
