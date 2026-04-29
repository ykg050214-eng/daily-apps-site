const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const inputIds = [
  "monthlyRent",
  "contractEndDate",
  "noticePeriodDays",
  "renewalMultiplier",
  "renewalAdminFee",
  "renewalInsurance",
  "renewalGuarantor",
  "renewalOther",
  "movingDeposit",
  "movingKeyMoney",
  "movingBrokerFee",
  "movingInsurance",
  "movingGuarantor",
  "movingTruck",
  "movingCleaning",
  "movingLockChange",
  "movingOther",
];

const elements = Object.fromEntries(
  inputIds.map((id) => [id, document.getElementById(id)])
);

const renewalTotalElement = document.getElementById("renewalTotal");
const movingTotalElement = document.getElementById("movingTotal");
const renewalBreakdownElement = document.getElementById("renewalBreakdown");
const movingBreakdownElement = document.getElementById("movingBreakdown");
const differenceValueElement = document.getElementById("differenceValue");
const differenceMessageElement = document.getElementById("differenceMessage");
const decisionMessageElement = document.getElementById("decisionMessage");
const timelineElement = document.getElementById("timeline");
const printReportButton = document.getElementById("printReportButton");
const downloadPngButton = document.getElementById("downloadPngButton");
const exportCanvas = document.getElementById("exportCanvas");

initializeDate();
bindEvents();
render();

function initializeDate() {
  const today = new Date();
  const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  elements.contractEndDate.value = nextYear.toISOString().slice(0, 10);
}

function bindEvents() {
  Object.values(elements).forEach((input) => {
    input.addEventListener("input", render);
  });

  printReportButton.addEventListener("click", () => window.print());
  downloadPngButton.addEventListener("click", downloadComparisonCard);
}

function render() {
  const state = getState();
  const renewalTotal = calculateRenewalTotal(state);
  const movingTotal = calculateMovingTotal(state);
  const difference = movingTotal - renewalTotal;

  renewalTotalElement.textContent = formatCurrency(renewalTotal);
  movingTotalElement.textContent = formatCurrency(movingTotal);
  differenceValueElement.textContent = formatSignedCurrency(difference);

  renderBreakdown(
    renewalBreakdownElement,
    [
      ["更新料", state.monthlyRent * state.renewalMultiplier],
      ["事務手数料", state.renewalAdminFee],
      ["火災保険", state.renewalInsurance],
      ["保証会社", state.renewalGuarantor],
      ["その他", state.renewalOther],
    ]
  );

  renderBreakdown(
    movingBreakdownElement,
    [
      ["敷金", state.movingDeposit],
      ["礼金", state.movingKeyMoney],
      ["仲介手数料", state.movingBrokerFee],
      ["火災保険", state.movingInsurance],
      ["保証会社", state.movingGuarantor],
      ["引っ越し業者", state.movingTruck],
      ["クリーニング", state.movingCleaning],
      ["鍵交換", state.movingLockChange],
      ["その他", state.movingOther],
    ]
  );

  renderDecision(renewalTotal, movingTotal, difference);
  renderTimeline(state);
}

function getState() {
  return {
    monthlyRent: numberValue(elements.monthlyRent.value),
    contractEndDate: elements.contractEndDate.value,
    noticePeriodDays: numberValue(elements.noticePeriodDays.value),
    renewalMultiplier: numberValue(elements.renewalMultiplier.value),
    renewalAdminFee: numberValue(elements.renewalAdminFee.value),
    renewalInsurance: numberValue(elements.renewalInsurance.value),
    renewalGuarantor: numberValue(elements.renewalGuarantor.value),
    renewalOther: numberValue(elements.renewalOther.value),
    movingDeposit: numberValue(elements.movingDeposit.value),
    movingKeyMoney: numberValue(elements.movingKeyMoney.value),
    movingBrokerFee: numberValue(elements.movingBrokerFee.value),
    movingInsurance: numberValue(elements.movingInsurance.value),
    movingGuarantor: numberValue(elements.movingGuarantor.value),
    movingTruck: numberValue(elements.movingTruck.value),
    movingCleaning: numberValue(elements.movingCleaning.value),
    movingLockChange: numberValue(elements.movingLockChange.value),
    movingOther: numberValue(elements.movingOther.value),
  };
}

function calculateRenewalTotal(state) {
  return (
    state.monthlyRent * state.renewalMultiplier +
    state.renewalAdminFee +
    state.renewalInsurance +
    state.renewalGuarantor +
    state.renewalOther
  );
}

function calculateMovingTotal(state) {
  return (
    state.movingDeposit +
    state.movingKeyMoney +
    state.movingBrokerFee +
    state.movingInsurance +
    state.movingGuarantor +
    state.movingTruck +
    state.movingCleaning +
    state.movingLockChange +
    state.movingOther
  );
}

function renderBreakdown(container, items) {
  container.innerHTML = "";
  items
    .filter(([, value]) => value > 0)
    .forEach(([label, value]) => {
      const item = document.createElement("li");
      item.textContent = `${label}: ${formatCurrency(value)}`;
      container.appendChild(item);
    });
}

function renderDecision(renewalTotal, movingTotal, difference) {
  if (difference > 0) {
    decisionMessageElement.textContent =
      "初期費用だけを見ると更新のほうが軽く、当面の出費を抑えやすい状況です。";
    differenceMessageElement.textContent =
      `引っ越しは更新より ${formatCurrency(difference)} 高くなります。家賃や住環境の改善が差額に見合うかを確認しましょう。`;
    return;
  }

  if (difference < 0) {
    decisionMessageElement.textContent =
      "入力内容では引っ越しのほうが安く、更新料負担が大きい契約の可能性があります。";
    differenceMessageElement.textContent =
      `更新は引っ越しより ${formatCurrency(Math.abs(difference))} 高くなります。次の契約条件を取り寄せて比較すると安心です。`;
    return;
  }

  decisionMessageElement.textContent =
    "更新と引っ越しの初期費用がほぼ同じです。期限や新居条件を優先して判断できます。";
  differenceMessageElement.textContent =
    "差額はほぼありません。退去予告の締切と新居探しの手間で比較すると決めやすいです。";
}

function renderTimeline(state) {
  const endDate = parseDate(state.contractEndDate);
  if (!endDate) {
    timelineElement.innerHTML = "<p>契約満了日を入力すると期限が表示されます。</p>";
    return;
  }

  const noticeDeadline = addDays(endDate, state.noticePeriodDays * -1);
  const renewalDecision = addDays(endDate, -45);
  const estimateStart = addDays(endDate, -60);
  const packingStart = addDays(endDate, -14);

  const timelineItems = [
    ["今週中", "更新条件を確認", "管理会社の更新料、火災保険、保証会社費用を確認します。"],
    [formatDate(estimateStart), "引っ越し見積もりを取り始める", "新居候補と引っ越し業者の見積もりを同時に集めます。"],
    [formatDate(renewalDecision), "更新か引っ越しかの判断目安", "比較結果をもとに意思決定し、必要な申込や解約連絡を始めます。"],
    [formatDate(noticeDeadline), "退去予告の締切", "この日までに退去連絡が必要な想定です。契約書で再確認してください。"],
    [formatDate(packingStart), "荷造り・住所変更の開始", "転居する場合は公共料金、ネット、郵便物の手続きを始めます。"],
    [formatDate(endDate), "契約満了日", "更新書類提出や退去立会いの最終日として扱います。"],
  ];

  timelineElement.innerHTML = timelineItems
    .map(
      ([dateLabel, title, copy]) => `
        <article class="timeline-item">
          <div class="timeline-date">${dateLabel}</div>
          <div class="timeline-copy">
            <strong>${title}</strong>
            <p>${copy}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function downloadComparisonCard() {
  const state = getState();
  const renewalTotal = calculateRenewalTotal(state);
  const movingTotal = calculateMovingTotal(state);
  const difference = movingTotal - renewalTotal;
  const context = exportCanvas.getContext("2d");

  context.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
  const gradient = context.createLinearGradient(0, 0, exportCanvas.width, exportCanvas.height);
  gradient.addColorStop(0, "#f6efe3");
  gradient.addColorStop(1, "#d7efe9");
  context.fillStyle = gradient;
  context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  context.fillStyle = "#1e1b16";
  context.font = "bold 56px 'Yu Gothic UI'";
  context.fillText("賃貸更新・引っ越し費用メモ", 72, 100);

  context.fillStyle = "#6b6257";
  context.font = "28px 'Yu Gothic UI'";
  context.fillText(`契約満了日: ${formatDate(parseDate(state.contractEndDate))}`, 72, 150);

  drawCard(context, {
    x: 72,
    y: 220,
    width: 580,
    height: 340,
    title: "更新する場合",
    amount: formatCurrency(renewalTotal),
    accent: "#0f766e",
    lines: [
      `更新料: ${formatCurrency(state.monthlyRent * state.renewalMultiplier)}`,
      `火災保険: ${formatCurrency(state.renewalInsurance)}`,
      `保証会社: ${formatCurrency(state.renewalGuarantor)}`,
      `その他: ${formatCurrency(state.renewalAdminFee + state.renewalOther)}`,
    ],
  });

  drawCard(context, {
    x: 748,
    y: 220,
    width: 580,
    height: 340,
    title: "引っ越す場合",
    amount: formatCurrency(movingTotal),
    accent: "#f97316",
    lines: [
      `敷金礼金: ${formatCurrency(state.movingDeposit + state.movingKeyMoney)}`,
      `仲介+保険: ${formatCurrency(state.movingBrokerFee + state.movingInsurance)}`,
      `保証+引っ越し: ${formatCurrency(state.movingGuarantor + state.movingTruck)}`,
      `その他: ${formatCurrency(state.movingCleaning + state.movingLockChange + state.movingOther)}`,
    ],
  });

  context.fillStyle = "#1e1b16";
  context.font = "bold 42px 'Yu Gothic UI'";
  context.fillText(`差額: ${formatSignedCurrency(difference)}`, 72, 640);

  context.fillStyle = "#6b6257";
  context.font = "28px 'Yu Gothic UI'";
  const message =
    difference > 0
      ? "更新のほうが当面の現金負担を抑えやすい結果です。"
      : difference < 0
        ? "引っ越しのほうが安く、更新料の負担が大きい可能性があります。"
        : "初期費用は同程度です。条件面で比較しましょう。";
  context.fillText(message, 72, 700);

  const link = document.createElement("a");
  link.download = "rent-compare-card.png";
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

function drawCard(context, card) {
  context.fillStyle = "rgba(255,255,255,0.88)";
  roundRect(context, card.x, card.y, card.width, card.height, 28);
  context.fill();

  context.fillStyle = card.accent;
  context.font = "bold 34px 'Yu Gothic UI'";
  context.fillText(card.title, card.x + 36, card.y + 64);

  context.fillStyle = "#1e1b16";
  context.font = "bold 56px 'Yu Gothic UI'";
  context.fillText(card.amount, card.x + 36, card.y + 148);

  context.fillStyle = "#6b6257";
  context.font = "28px 'Yu Gothic UI'";
  card.lines.forEach((line, index) => {
    context.fillText(line, card.x + 36, card.y + 220 + index * 44);
  });
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

function numberValue(value) {
  return Number(value || 0);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function formatSignedCurrency(value) {
  const absolute = formatCurrency(Math.abs(value));
  if (value > 0) {
    return `+${absolute}`;
  }
  if (value < 0) {
    return `-${absolute}`;
  }
  return absolute;
}

function formatDate(date) {
  if (!date) {
    return "未設定";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
