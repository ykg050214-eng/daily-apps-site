const STORAGE_KEY = "night-phone-off-routine-v1";
const STEP_LIMIT = 3;
const FOCUS_DURATION = 60;

const defaultState = {
  bedtime: "23:30",
  dropSpot: "ベッドから手が届かない充電台",
  steps: ["SNSを閉じる", "スマホを充電場所へ置く", "照明を落として深呼吸する"],
  completions: {},
};

const elements = {
  startFocusButton: document.getElementById("startFocusButton"),
  markDoneButton: document.getElementById("markDoneButton"),
  streakCount: document.getElementById("streakCount"),
  streakMessage: document.getElementById("streakMessage"),
  weeklyRate: document.getElementById("weeklyRate"),
  weeklyMessage: document.getElementById("weeklyMessage"),
  bedtimeDisplay: document.getElementById("bedtimeDisplay"),
  stepPreview: document.getElementById("stepPreview"),
  routineInputs: document.getElementById("routineInputs"),
  bedtimeInput: document.getElementById("bedtimeInput"),
  dropSpotInput: document.getElementById("dropSpotInput"),
  settingsHint: document.getElementById("settingsHint"),
  weekTracker: document.getElementById("weekTracker"),
  emptyState: document.getElementById("emptyState"),
  todayStatus: document.getElementById("todayStatus"),
  focusOverlay: document.getElementById("focusOverlay"),
  focusTitle: document.getElementById("focusTitle"),
  focusStepName: document.getElementById("focusStepName"),
  focusCountdown: document.getElementById("focusCountdown"),
  focusStepDots: document.getElementById("focusStepDots"),
  focusHint: document.getElementById("focusHint"),
  nextStepButton: document.getElementById("nextStepButton"),
  closeOverlayButton: document.getElementById("closeOverlayButton"),
};

let appState = loadState();
let focusState = {
  active: false,
  stepIndex: 0,
  remaining: FOCUS_DURATION,
  intervalId: null,
};

renderRoutineInputs();
bindEvents();
render();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return structuredClone(defaultState);
  }

  try {
    return {
      ...structuredClone(defaultState),
      ...JSON.parse(saved),
    };
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    return structuredClone(defaultState);
  }
}

function bindEvents() {
  elements.startFocusButton.addEventListener("click", startFocusMode);
  elements.markDoneButton.addEventListener("click", markTodayDone);
  elements.bedtimeInput.addEventListener("change", handleSettingsChange);
  elements.dropSpotInput.addEventListener("input", handleSettingsChange);
  elements.nextStepButton.addEventListener("click", advanceFocusStep);
  elements.closeOverlayButton.addEventListener("click", closeFocusMode);
}

function handleSettingsChange() {
  appState.bedtime = elements.bedtimeInput.value || defaultState.bedtime;
  appState.dropSpot = elements.dropSpotInput.value.trim() || defaultState.dropSpot;
  persistState();
  render();
}

function renderRoutineInputs() {
  elements.routineInputs.innerHTML = Array.from({ length: STEP_LIMIT }, (_, index) => {
    const value = appState.steps[index] || "";
    return `
      <label class="routine-row">
        <span class="step-number">${index + 1}</span>
        <input
          data-step-index="${index}"
          type="text"
          maxlength="34"
          placeholder="ルーティンを入力"
          value="${escapeHtml(value)}"
        >
      </label>
    `;
  }).join("");

  elements.routineInputs.querySelectorAll("[data-step-index]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.stepIndex);
      appState.steps[index] = event.target.value;
      persistState();
      render();
    });
  });
}

function render() {
  const todayKey = getDateKey(new Date());
  const steps = cleanedSteps();
  const completions = appState.completions;
  const weekDays = getLastSevenDays();
  const completedCount = weekDays.filter((day) => completions[day.key]).length;
  const weeklyRate = Math.round((completedCount / weekDays.length) * 100);
  const streak = calculateStreak(completions);
  const isDoneToday = Boolean(completions[todayKey]);

  elements.bedtimeDisplay.textContent = appState.bedtime;
  elements.bedtimeInput.value = appState.bedtime;
  elements.dropSpotInput.value = appState.dropSpot;
  elements.streakCount.textContent = `${streak}日`;
  elements.weeklyRate.textContent = `${weeklyRate}%`;
  elements.streakMessage.textContent = streak >= 3 ? "流れが身体に入り始めています。" : "まずは3日続けると切り替えやすくなります。";
  elements.weeklyMessage.textContent = weeklyRate >= 70 ? "今週はかなり安定しています。" : "就寝10分前にだけ開くのがコツです。";
  elements.todayStatus.textContent = isDoneToday ? "今日はもう完了しています。" : `目標就寝時刻の10分前、${recommendedStart(appState.bedtime)} に開くのがおすすめです。`;
  elements.settingsHint.textContent = steps.length < STEP_LIMIT
    ? "空欄は残して大丈夫です。3ステップ以内に絞るほど、寝る前は迷わず動けます。"
    : `置き場所は「${appState.dropSpot}」です。最後のステップでそこへ置く流れにすると戻りづらくなります。`;
  elements.emptyState.textContent = completedCount === 0
    ? "まだ達成記録がありません。今夜1回終えるだけで、この欄に習慣の積み上がりが出始めます。"
    : "続けるコツは、内容を変えないことです。順番を固定すると寝る前の意思決定が減ります。";

  renderStepPreview(steps);
  renderWeekTracker(weekDays, todayKey, completions);
}

function renderStepPreview(steps) {
  if (steps.length === 0) {
    elements.stepPreview.innerHTML = `
      <article class="step-card">
        <div class="step-meta">
          <strong>まずは1つだけ入れて始められます</strong>
          <span class="subtle-copy">例: スマホを充電場所へ置く</span>
        </div>
      </article>
    `;
    return;
  }

  elements.stepPreview.innerHTML = steps.map((step, index) => `
    <article class="step-card">
      <span class="step-number">${index + 1}</span>
      <div class="step-meta">
        <strong>${escapeHtml(step)}</strong>
        <span class="subtle-copy">${stepSubcopy(index, step)}</span>
      </div>
    </article>
  `).join("");
}

function renderWeekTracker(weekDays, todayKey, completions) {
  elements.weekTracker.innerHTML = weekDays.map((day) => {
    const done = Boolean(completions[day.key]);
    return `
      <article class="day-tile ${done ? "done" : ""} ${day.key === todayKey ? "today" : ""}">
        <div>
          <strong>${day.label}</strong>
          <span>${day.dateLabel}</span>
        </div>
        <div class="stamp">${done ? "Done" : "Rest"}</div>
      </article>
    `;
  }).join("");
}

function startFocusMode() {
  const steps = cleanedSteps();
  if (steps.length === 0) {
    elements.settingsHint.textContent = "ルーティンが空です。まずは1ステップだけ入れると始められます。";
    return;
  }

  focusState.active = true;
  focusState.stepIndex = 0;
  focusState.remaining = FOCUS_DURATION;
  openOverlay();
  runCountdown();
}

function openOverlay() {
  elements.focusOverlay.classList.remove("hidden");
  elements.focusOverlay.setAttribute("aria-hidden", "false");
  renderFocusState();
}

function closeFocusMode() {
  clearInterval(focusState.intervalId);
  focusState.intervalId = null;
  focusState.active = false;
  elements.focusOverlay.classList.add("hidden");
  elements.focusOverlay.setAttribute("aria-hidden", "true");
}

function runCountdown() {
  clearInterval(focusState.intervalId);
  focusState.intervalId = setInterval(() => {
    focusState.remaining -= 1;
    if (focusState.remaining <= 0) {
      advanceFocusStep();
      return;
    }
    renderFocusState();
  }, 1000);
}

function advanceFocusStep() {
  const steps = cleanedSteps();
  if (focusState.stepIndex >= steps.length - 1) {
    markTodayDone();
    closeFocusMode();
    return;
  }

  focusState.stepIndex += 1;
  focusState.remaining = FOCUS_DURATION;
  renderFocusState();
  runCountdown();
}

function renderFocusState() {
  const steps = cleanedSteps();
  const currentStep = steps[focusState.stepIndex];
  const progressRatio = focusState.remaining / FOCUS_DURATION;
  const progressAngle = `${Math.max(0, progressRatio) * 360}deg`;

  elements.focusStepName.textContent = currentStep;
  elements.focusCountdown.textContent = String(focusState.remaining);
  elements.focusHint.textContent = focusState.stepIndex === steps.length - 1
    ? `最後は「${appState.dropSpot}」に置いて、そのまま触らない流れにします。`
    : "次の行動を考えず、今の1つだけ終えることに集中します。";
  elements.focusTitle.textContent = `ステップ ${focusState.stepIndex + 1} / ${steps.length}`;
  document.documentElement.style.setProperty("--progress-angle", progressAngle);
  elements.focusStepDots.innerHTML = steps.map((_, index) => `
    <span class="focus-step-dot ${index === focusState.stepIndex ? "active" : ""}"></span>
  `).join("");
  elements.nextStepButton.textContent = focusState.stepIndex === steps.length - 1 ? "完了して閉じる" : "次のステップへ";
}

function markTodayDone() {
  appState.completions[getDateKey(new Date())] = true;
  persistState();
  render();
}

function calculateStreak(completions) {
  let streak = 0;
  const cursor = new Date();
  if (!completions[getDateKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = getDateKey(cursor);
    if (!completions[key]) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function cleanedSteps() {
  return appState.steps.map((step) => step.trim()).filter(Boolean).slice(0, STEP_LIMIT);
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: getDateKey(date),
      label: new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date),
      dateLabel: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date),
    };
  });
}

function recommendedStart(bedtime) {
  const [hourString, minuteString] = bedtime.split(":");
  const date = new Date();
  date.setHours(Number(hourString), Number(minuteString), 0, 0);
  date.setMinutes(date.getMinutes() - 10);
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stepSubcopy(index, step) {
  if (index === 0) {
    return "まず視線を奪うものを閉じます。";
  }
  if (index === 1) {
    return "手から離して、戻るまでの距離を作ります。";
  }
  return `最後は「${appState.dropSpot}」へ置く流れが自然です。`;
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
