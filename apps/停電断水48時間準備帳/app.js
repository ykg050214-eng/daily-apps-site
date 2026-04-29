const STORAGE_KEY = "outage-prep-notebook-state-v1";

const supplyItems = [
  {
    id: "water",
    title: "飲料水",
    category: "生命線",
    description: "1人あたり1日3Lを基準に用意します。",
    needsDate: false,
    quantityLabel: "保有量 (L)",
    baseNeed: (state) => state.familySize * state.days * 3,
  },
  {
    id: "food",
    title: "非常食",
    category: "生命線",
    description: "温め不要ですぐ食べられるものを優先します。",
    needsDate: true,
    quantityLabel: "食数",
    baseNeed: (state) => state.familySize * state.days * 3,
  },
  {
    id: "battery",
    title: "モバイルバッテリー",
    category: "電源",
    description: "スマホ1人1日2回充電を目安にします。",
    needsDate: true,
    quantityLabel: "充電回数分",
    baseNeed: (state) => state.familySize * state.days * 2,
  },
  {
    id: "lights",
    title: "照明",
    category: "電源",
    description: "懐中電灯またはランタンを各部屋分確保します。",
    needsDate: false,
    quantityLabel: "台数",
    baseNeed: (state) => Math.max(2, state.familySize),
  },
  {
    id: "cash",
    title: "現金",
    category: "移動・買い出し",
    description: "停電時に電子決済が使えない場面を想定します。",
    needsDate: false,
    quantityLabel: "保有額 (円)",
    baseNeed: (state) => state.familySize * state.days * 4000,
  },
  {
    id: "sanitary",
    title: "簡易トイレ・衛生用品",
    category: "断水",
    description: "簡易トイレ、ウェットティッシュ、紙皿など。",
    needsDate: false,
    quantityLabel: "セット数",
    baseNeed: (state) => Math.max(2, state.familySize * state.days),
  },
];

const actionCards = [
  {
    title: "1. 公式情報の確認",
    copy: "自治体、気象庁、電力会社などの公式情報をまず確認し、避難情報の有無を把握します。",
  },
  {
    title: "2. 冷蔵庫は必要な時だけ開ける",
    copy: "停電直後は冷気を逃がさないことが重要です。保冷剤や凍らせた飲み物があると安心です。",
  },
  {
    title: "3. 水は飲用・手洗い・トイレで配分",
    copy: "飲用を最優先にし、次に手洗い、最後にトイレ用途を考えます。浴槽の残り湯も活用します。",
  },
  {
    title: "4. 連絡手段を節電モードに",
    copy: "画面輝度を下げ、不要な通信を切り、家族との集合方法を先に決めておきます。",
  },
];

const elements = {
  familySize: document.getElementById("familySize"),
  hoursTarget: document.getElementById("hoursTarget"),
  hasInfant: document.getElementById("hasInfant"),
  hasPet: document.getElementById("hasPet"),
  preparednessScore: document.getElementById("preparednessScore"),
  scoreLabel: document.getElementById("scoreLabel"),
  scoreMessage: document.getElementById("scoreMessage"),
  neededWater: document.getElementById("neededWater"),
  waterHint: document.getElementById("waterHint"),
  neededBattery: document.getElementById("neededBattery"),
  neededCash: document.getElementById("neededCash"),
  waterStatus: document.getElementById("waterStatus"),
  powerStatus: document.getElementById("powerStatus"),
  cashStatus: document.getElementById("cashStatus"),
  supplyChecklist: document.getElementById("supplyChecklist"),
  actionCards: document.getElementById("actionCards"),
  alerts: document.getElementById("alerts"),
  notes: document.getElementById("notes"),
  saveImageButton: document.getElementById("saveImageButton"),
  resetButton: document.getElementById("resetButton"),
  exportCanvas: document.getElementById("exportCanvas"),
};

let appState = loadState();

renderActionCards();
renderChecklist();
bindEvents();
render();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    familySize: 3,
    hoursTarget: 48,
    hasInfant: false,
    hasPet: true,
    notes: "",
    items: {
      water: { checked: false, quantity: 12, expiresAt: "" },
      food: { checked: false, quantity: 10, expiresAt: nextDate(120) },
      battery: { checked: false, quantity: 6, expiresAt: nextDate(180) },
      lights: { checked: true, quantity: 3, expiresAt: "" },
      cash: { checked: false, quantity: 12000, expiresAt: "" },
      sanitary: { checked: false, quantity: 2, expiresAt: "" },
    },
  };
}

function bindEvents() {
  elements.familySize.addEventListener("input", handleBaseChange);
  elements.hoursTarget.addEventListener("change", handleBaseChange);
  elements.hasInfant.addEventListener("change", handleBaseChange);
  elements.hasPet.addEventListener("change", handleBaseChange);
  elements.notes.addEventListener("input", () => {
    appState.notes = elements.notes.value;
    persistState();
  });
  elements.resetButton.addEventListener("click", resetState);
  elements.saveImageButton.addEventListener("click", exportStatusCard);
}

function handleBaseChange() {
  appState.familySize = clamp(Number(elements.familySize.value || 1), 1, 10);
  appState.hoursTarget = Number(elements.hoursTarget.value);
  appState.hasInfant = elements.hasInfant.checked;
  appState.hasPet = elements.hasPet.checked;
  persistState();
  render();
}

function render() {
  syncControls();

  const state = getDerivedState();
  const score = calculateScore(state);

  elements.preparednessScore.textContent = `${score}%`;
  elements.scoreLabel.textContent = score >= 80 ? "かなり整っています" : score >= 50 ? "あと少しで安心" : "優先補充が必要です";
  elements.scoreMessage.textContent = buildScoreMessage(state, score);
  document.documentElement.style.setProperty("--score-angle", `${(score / 100) * 360}deg`);

  elements.neededWater.textContent = `${state.requirements.water}L`;
  elements.waterHint.textContent = `${state.familySize}人 × ${state.days}日 × 3L`;
  elements.neededBattery.textContent = `${state.requirements.battery}回分`;
  elements.neededCash.textContent = formatCurrency(state.requirements.cash);

  elements.waterStatus.textContent = buildPill("水", state.items.water.quantity, state.requirements.water, "L");
  elements.powerStatus.textContent = buildPill("電源", state.items.battery.quantity, state.requirements.battery, "回");
  elements.cashStatus.textContent = buildPill("現金", state.items.cash.quantity, state.requirements.cash, "円");

  renderChecklistValues(state);
  renderAlerts(state);
}

function syncControls() {
  elements.familySize.value = appState.familySize;
  elements.hoursTarget.value = String(appState.hoursTarget);
  elements.hasInfant.checked = appState.hasInfant;
  elements.hasPet.checked = appState.hasPet;
  elements.notes.value = appState.notes;
}

function getDerivedState() {
  const familySize = appState.familySize;
  const days = appState.hoursTarget / 24;
  const requirements = {
    water: familySize * days * 3 + (appState.hasInfant ? days * 1.5 : 0) + (appState.hasPet ? days * 1 : 0),
    battery: familySize * days * 2 + (appState.hasInfant ? 1 : 0),
    cash: familySize * days * 4000 + (appState.hasPet ? 3000 : 0),
    food: familySize * days * 3 + (appState.hasInfant ? days * 2 : 0),
    lights: Math.max(2, familySize),
    sanitary: Math.max(2, familySize * days + (appState.hasPet ? 1 : 0)),
  };

  return {
    familySize,
    days,
    requirements,
    hasInfant: appState.hasInfant,
    hasPet: appState.hasPet,
    items: appState.items,
  };
}

function calculateScore(state) {
  const scoredItems = [
    ratio(state.items.water.quantity, state.requirements.water),
    ratio(state.items.food.quantity, state.requirements.food),
    ratio(state.items.battery.quantity, state.requirements.battery),
    ratio(state.items.cash.quantity, state.requirements.cash),
    ratio(state.items.sanitary.quantity, state.requirements.sanitary),
    ratio(state.items.lights.quantity, state.requirements.lights),
  ];

  const checkedBoost = Object.values(state.items).filter((item) => item.checked).length / supplyItems.length;
  const average = scoredItems.reduce((sum, value) => sum + value, 0) / scoredItems.length;
  return Math.round(Math.min(1, average * 0.8 + checkedBoost * 0.2) * 100);
}

function buildScoreMessage(state, score) {
  if (score < 50) {
    return `まずは水 ${state.requirements.water}L と非常食 ${state.requirements.food}食を優先して補充すると、48時間の安心感が大きく上がります。`;
  }

  if (score < 80) {
    return "主要な備えは揃っています。期限が近いものと不足量のある項目だけ先に埋めるのがおすすめです。";
  }

  return "必要量はかなり満たせています。期限切れと持ち出し動線を月1回だけ見直せば維持しやすい状態です。";
}

function renderActionCards() {
  elements.actionCards.innerHTML = actionCards
    .map(
      (item) => `
        <article class="action-card">
          <strong>${item.title}</strong>
          <p>${item.copy}</p>
        </article>
      `
    )
    .join("");
}

function renderChecklist() {
  const grouped = groupByCategory(supplyItems);

  elements.supplyChecklist.innerHTML = Object.entries(grouped)
    .map(([category, items]) => {
      const rows = items
        .map((item) => {
          const value = appState.items[item.id];
          return `
            <label class="check-row">
              <input data-item-id="${item.id}" data-field="checked" type="checkbox" ${value.checked ? "checked" : ""}>
              <div class="check-main">
                <strong>${item.title}</strong>
                <span class="checklist-meta">${item.description}</span>
              </div>
              ${item.needsDate ? `<input data-item-id="${item.id}" data-field="expiresAt" type="date" value="${value.expiresAt || ""}">` : ""}
              <input data-item-id="${item.id}" data-field="quantity" type="number" min="0" step="1" value="${value.quantity}">
            </label>
          `;
        })
        .join("");

      return `
        <article class="checklist-card">
          <div class="checklist-title">
            <div>
              <h3>${category}</h3>
              <p class="checklist-meta">必要量と期限を見ながら、家庭にある量を記録します。</p>
            </div>
          </div>
          <div class="checklist-items">${rows}</div>
        </article>
      `;
    })
    .join("");

  elements.supplyChecklist.querySelectorAll("[data-item-id]").forEach((input) => {
    input.addEventListener("input", handleItemInput);
    input.addEventListener("change", handleItemInput);
  });
}

function renderChecklistValues(state) {
  supplyItems.forEach((item) => {
    const quantityInput = elements.supplyChecklist.querySelector(`[data-item-id="${item.id}"][data-field="quantity"]`);
    if (!quantityInput) {
      return;
    }

    const requirement = Math.ceil(state.requirements[item.id]);
    quantityInput.title = `必要目安: ${requirement}${item.id === "cash" ? "円" : ""}`;
  });
}

function handleItemInput(event) {
  const { itemId, field } = event.target.dataset;
  if (!itemId || !field) {
    return;
  }

  if (field === "checked") {
    appState.items[itemId].checked = event.target.checked;
  } else if (field === "quantity") {
    appState.items[itemId].quantity = Number(event.target.value || 0);
  } else if (field === "expiresAt") {
    appState.items[itemId].expiresAt = event.target.value;
  }

  persistState();
  render();
}

function renderAlerts(state) {
  const alerts = supplyItems
    .filter((item) => item.needsDate)
    .map((item) => {
      const expiresAt = appState.items[item.id].expiresAt;
      const dayDiff = expiresAt ? Math.ceil((new Date(`${expiresAt}T00:00:00`) - startOfToday()) / 86400000) : null;

      if (dayDiff === null) {
        return {
          level: "warn",
          title: `${item.title} の期限が未登録です`,
          copy: "備蓄の有効期限が分からないと、いざという時に使えない可能性があります。",
        };
      }

      if (dayDiff < 0) {
        return {
          level: "warn",
          title: `${item.title} の期限が切れています`,
          copy: "優先的に買い替えるか、状態を確認してください。",
        };
      }

      if (dayDiff <= 30) {
        return {
          level: "soon",
          title: `${item.title} の期限が ${dayDiff} 日以内です`,
          copy: "今月中に入れ替えると安心です。",
        };
      }

      return {
        level: "ok",
        title: `${item.title} はしばらく大丈夫です`,
        copy: `期限まであと ${dayDiff} 日あります。月1回の見直しで十分です。`,
      };
    });

  elements.alerts.innerHTML = alerts
    .map(
      (alert) => `
        <article class="alert-card ${alert.level}">
          <strong>${alert.title}</strong>
          <p class="alert-copy">${alert.copy}</p>
        </article>
      `
    )
    .join("");
}

function exportStatusCard() {
  const state = getDerivedState();
  const score = calculateScore(state);
  const context = elements.exportCanvas.getContext("2d");
  const canvas = elements.exportCanvas;

  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0b1722");
  gradient.addColorStop(1, "#143246");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#edf7ff";
  context.font = "bold 52px 'Yu Gothic UI'";
  context.fillText("停電断水48時間準備帳", 70, 95);
  context.fillStyle = "#9ab0c1";
  context.font = "28px 'Yu Gothic UI'";
  context.fillText(`家族人数 ${state.familySize}人 / 目標 ${state.days * 24}時間`, 70, 140);

  drawBox(context, 70, 190, 390, 250, "#122735");
  context.fillStyle = "#58f2cf";
  context.font = "bold 30px 'Yu Gothic UI'";
  context.fillText("備えスコア", 102, 238);
  context.fillStyle = "#edf7ff";
  context.font = "bold 92px 'Yu Gothic UI'";
  context.fillText(`${score}%`, 102, 340);
  context.fillStyle = "#9ab0c1";
  context.font = "26px 'Yu Gothic UI'";
  context.fillText("48時間を乗り切る準備の目安", 102, 390);

  drawBox(context, 500, 190, 380, 250, "#112b33");
  drawBox(context, 920, 190, 380, 250, "#1f2734");

  context.fillStyle = "#6bc8ff";
  context.font = "bold 30px 'Yu Gothic UI'";
  context.fillText("必要量", 532, 238);
  context.fillStyle = "#edf7ff";
  context.font = "bold 44px 'Yu Gothic UI'";
  context.fillText(`${state.requirements.water}L`, 532, 308);
  context.fillText(`${state.requirements.battery}回分`, 532, 364);
  context.fillText(formatCurrency(state.requirements.cash), 532, 420);

  context.fillStyle = "#ffcc66";
  context.font = "bold 30px 'Yu Gothic UI'";
  context.fillText("現在の状態", 952, 238);
  context.fillStyle = "#edf7ff";
  context.font = "bold 44px 'Yu Gothic UI'";
  context.fillText(`水 ${appState.items.water.quantity}L`, 952, 308);
  context.fillText(`電源 ${appState.items.battery.quantity}回分`, 952, 364);
  context.fillText(`現金 ${formatCurrency(appState.items.cash.quantity)}`, 952, 420);

  drawBox(context, 70, 490, 1230, 300, "#0f2230");
  context.fillStyle = "#edf7ff";
  context.font = "bold 32px 'Yu Gothic UI'";
  context.fillText("次にやること", 102, 540);
  context.fillStyle = "#9ab0c1";
  context.font = "28px 'Yu Gothic UI'";
  const tasks = [
    `飲料水を ${Math.max(0, state.requirements.water - appState.items.water.quantity)}L 追加する`,
    `モバイルバッテリーを ${Math.max(0, state.requirements.battery - appState.items.battery.quantity)}回分 追加する`,
    `非常食とバッテリーの期限を今月中に見直す`,
  ];
  tasks.forEach((task, index) => {
    context.fillText(`• ${task}`, 102, 600 + index * 58);
  });

  const link = document.createElement("a");
  link.download = "outage-prep-status.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  appState = loadState();
  renderChecklist();
  render();
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    groups[item.category] ??= [];
    groups[item.category].push(item);
    return groups;
  }, {});
}

function ratio(actual, required) {
  return Math.min(1, actual / required);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function buildPill(label, actual, required, unit) {
  return `${label} ${actual}/${Math.ceil(required)}${unit}`;
}

function drawBox(context, x, y, width, height, fill) {
  context.fillStyle = fill;
  roundRect(context, x, y, width, height, 28);
  context.fill();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
