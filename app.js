const storageKey = "run-weather-coach-state";

const defaultState = {
  profile: {
    location: "London",
    goal: "10k",
    experience: "intermediate",
    raceDate: "",
    targetTime: "00:55",
    targetPace: "",
    daysPerWeek: 4,
    longRunDay: "Sunday",
    rainTolerance: 0.2,
    lifeLoad: "moderate",
    sleepQuality: "average",
    injuryStatus: "none",
    blockedDays: [],
    lifeNotes: "",
    weekdaySlots: [11, 14, 15],
    weekendSlots: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
  activities: [],
  weather: [],
  fitness: null,
  recommendations: null,
  currentPlan: [],
  aiCoach: "",
  lastInsight: "",
};

const currentStatusForm = document.querySelector("#currentStatusForm");
const goalForm = document.querySelector("#goalForm");
const activityForm = document.querySelector("#activityForm");
const weatherStatus = document.querySelector("#weatherStatus");
const weatherCards = document.querySelector("#weatherCards");
const planSummary = document.querySelector("#planSummary");
const planBoard = document.querySelector("#planBoard");
const activityInsight = document.querySelector("#activityInsight");
const activityTableWrap = document.querySelector("#activityTableWrap");
const activityDetail = document.querySelector("#activityDetail");
const clearActivitiesBtn = document.querySelector("#clearActivitiesBtn");
const resetDatabaseBtn = document.querySelector("#resetDatabaseBtn");
const csvInput = document.querySelector("#csvInput");
const csvStatus = document.querySelector("#csvStatus");
const timeWindowPickerWeekday = document.querySelector("#timeWindowPickerWeekday");
const timeWindowPickerWeekend = document.querySelector("#timeWindowPickerWeekend");
const blockedDayPicker = document.querySelector("#blockedDayPicker");
const fitnessCards = document.querySelector("#fitnessCards");
const fitnessNarrative = document.querySelector("#fitnessNarrative");
const aiCoachSummary = document.querySelector("#aiCoachSummary");
const goalProgressFill = document.querySelector("#goalProgressFill");
const goalProgressLabel = document.querySelector("#goalProgressLabel");
const goalProgressDetail = document.querySelector("#goalProgressDetail");
const currentAbilityValue = document.querySelector("#currentAbilityValue");
const targetAbilityValue = document.querySelector("#targetAbilityValue");
const abilityGapValue = document.querySelector("#abilityGapValue");
const activityCalendarRows = document.querySelector("#activityCalendarRows");
const calendarTitle = document.querySelector("#calendarTitle");
const calendarPrev = document.querySelector("#calendarPrev");
const calendarNext = document.querySelector("#calendarNext");

const sessionDefinitions = {
  speed: {
    label: "速度課",
    description: "熱身後做短間歇，提升速度上限與跑姿效率。",
  },
  tempo: {
    label: "Tempo",
    description: "穩定偏辛苦節奏跑，建立乳酸耐受與配速控制。",
  },
  easy: {
    label: "Easy Run",
    description: "以可對話強度建立有氧底，同時保留恢復能力。",
  },
  long: {
    label: "Long Run",
    description: "穩定耐力課，重點係時間在腳上與補給節奏。",
  },
  recovery: {
    label: "恢復 / 休息",
    description: "讓身體吸收訓練刺激，減少累積疲勞。",
  },
  mobility: {
    label: "活動度 / 室內代替",
    description: "做活動度、核心或輕量交叉訓練，先保護身體。",
  },
  racePace: {
    label: "比賽配速課",
    description: "用目標配速做主段，建立比賽日執行能力。",
  },
};

const state = loadState();
let calendarCursor = state.activities.length ? new Date(state.activities[0].date) : new Date();

hydrateForms();
refreshFitness();
renderAll();
generatePlan();
refreshWeather();

async function handleProfileSubmit(event) {
  event.preventDefault();
  state.profile = readProfileForm();
  persistState();
  refreshFitness();
  updateHeadlines();
  await refreshWeather();
  generatePlan();
}

currentStatusForm.addEventListener("submit", handleProfileSubmit);
goalForm.addEventListener("submit", handleProfileSubmit);

activityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(activityForm);
  const activity = normalizeActivity(Object.fromEntries(formData.entries()));
  state.activities = mergeActivities([activity], state.activities);
  persistState();
  refreshFitness();
  renderActivities();
  generatePlan();
  activityForm.reset();
  activityForm.date.valueAsDate = new Date();
});

csvInput.addEventListener("change", async (event) => {
  const files = [...(event.target.files || [])];
  if (!files.length) return;

  let imported = [];
  const importMessages = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text, file.name);
      imported = imported.concat(parsed.activities);
      importMessages.push(`${file.name}: ${parsed.message}`);
    } catch (error) {
      importMessages.push(`${file.name}: 匯入失敗 (${error.message})`);
    }
  }

  state.activities = mergeActivities(imported, state.activities);
  persistState();
  refreshFitness();
  renderActivities();
  generatePlan();
  csvStatus.textContent = `已處理 ${files.length} 個 CSV，新增 / 合併 ${imported.length} 筆活動紀錄。 ${importMessages.join(" | ")}`;
  csvInput.value = "";
});

clearActivitiesBtn.addEventListener("click", () => {
  const confirmed = window.confirm("確定清除所有已匯入 / 手動加入嘅活動紀錄？呢個動作唔可以復原。");
  if (!confirmed) return;

  state.activities = [];
  state.fitness = null;
  state.recommendations = null;
  state.aiCoach = "";
  state.currentPlan = [];
  state.lastInsight = "";
  persistState();
  refreshFitness();
  renderAll();
  generatePlan();
  csvStatus.textContent = "已清除所有舊活動資料。你可以重新匯入原始 CSV。";
});

resetDatabaseBtn.addEventListener("click", () => {
  const confirmed = window.confirm("確定重建本地資料庫？呢個動作會清除設定、活動、分析結果同課表快取，並回復預設值。");
  if (!confirmed) return;

  localStorage.removeItem(storageKey);
  const fresh = structuredClone(defaultState);
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, fresh);
  calendarCursor = new Date();
  hydrateForms();
  refreshFitness();
  renderAll();
  generatePlan();
  refreshWeather();
  csvStatus.textContent = "本地資料庫已重建。你可以重新設定目標並重新匯入 CSV。";
});

timeWindowPickerWeekday.addEventListener("click", (event) => {
  const button = event.target.closest(".chip");
  if (!button) return;
  button.classList.toggle("active");
});

timeWindowPickerWeekend.addEventListener("click", (event) => {
  const button = event.target.closest(".chip");
  if (!button) return;
  button.classList.toggle("active");
});

blockedDayPicker.addEventListener("click", (event) => {
  const button = event.target.closest(".chip");
  if (!button) return;
  button.classList.toggle("active");
});

calendarPrev.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderActivityCalendar();
});

calendarNext.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderActivityCalendar();
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return {
      ...defaultState,
      ...saved,
      profile: {
        ...defaultState.profile,
        ...(saved.profile || {}),
      },
      activities: Array.isArray(saved.activities) ? saved.activities : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function hydrateForms() {
  const { profile } = state;
  goalForm.location.value = profile.location;
  goalForm.goal.value = profile.goal;
  goalForm.experience.value = profile.experience;
  goalForm.raceDate.value = profile.raceDate || "";
  goalForm.targetTime.value = profile.targetTime || "";
  if (goalForm.targetPace) goalForm.targetPace.value = profile.targetPace || "";
  goalForm.daysPerWeek.value = profile.daysPerWeek;
  goalForm.longRunDay.value = profile.longRunDay;
  currentStatusForm.rainTolerance.value = profile.rainTolerance;
  currentStatusForm.lifeLoad.value = profile.lifeLoad;
  currentStatusForm.sleepQuality.value = profile.sleepQuality;
  currentStatusForm.injuryStatus.value = profile.injuryStatus;
  currentStatusForm.lifeNotes.value = profile.lifeNotes || "";
  activityForm.date.valueAsDate = new Date();

  document.querySelectorAll("#timeWindowPickerWeekday .chip").forEach((chip) => {
    const slot = Number(chip.dataset.slot);
    chip.classList.toggle("active", profile.weekdaySlots.includes(slot));
  });
  document.querySelectorAll("#timeWindowPickerWeekend .chip").forEach((chip) => {
    const slot = Number(chip.dataset.slot);
    chip.classList.toggle("active", profile.weekendSlots.includes(slot));
  });
  document.querySelectorAll("#blockedDayPicker .chip").forEach((chip) => {
    chip.classList.toggle("active", profile.blockedDays.includes(chip.dataset.day));
  });
}

function readProfileForm() {
  const goalValues = Object.fromEntries(new FormData(goalForm).entries());
  const statusValues = Object.fromEntries(new FormData(currentStatusForm).entries());
  const weekdaySlots = [...document.querySelectorAll("#timeWindowPickerWeekday .chip.active")].map((chip) =>
    Number(chip.dataset.slot)
  );
  const weekendSlots = [...document.querySelectorAll("#timeWindowPickerWeekend .chip.active")].map((chip) =>
    Number(chip.dataset.slot)
  );
  const blockedDays = [...document.querySelectorAll("#blockedDayPicker .chip.active")].map((chip) =>
    chip.dataset.day
  );

  return {
    location: String(goalValues.location || "").trim(),
    goal: goalValues.goal,
    experience: goalValues.experience,
    raceDate: goalValues.raceDate,
    targetTime: goalValues.targetTime,
    targetPace: String(goalValues.targetPace || "").trim(),
    daysPerWeek: Number(goalValues.daysPerWeek),
    longRunDay: goalValues.longRunDay,
    rainTolerance: Number(statusValues.rainTolerance),
    lifeLoad: statusValues.lifeLoad,
    sleepQuality: statusValues.sleepQuality,
    injuryStatus: statusValues.injuryStatus,
    blockedDays,
    lifeNotes: String(statusValues.lifeNotes || "").trim(),
    weekdaySlots: weekdaySlots.length ? weekdaySlots : [10, 11, 14, 15],
    weekendSlots: weekendSlots.length ? weekendSlots : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  };
}

async function refreshWeather() {
  const profile = state.profile;
  weatherStatus.textContent = `正在為 ${profile.location} 讀取未來 7 日逐小時預報...`;
  try {
    const coords = await geocodeLocation(profile.location);
    const weather = await fetchForecast(coords.latitude, coords.longitude);
    state.weather = summarizeDryWindows(weather, profile.weekdaySlots, profile.weekendSlots, profile.rainTolerance);
    persistState();
    renderWeather();
    generatePlan();
  } catch (error) {
    weatherStatus.textContent = `未能載入天氣：${error.message}`;
  }
}

async function geocodeLocation(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=zh&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("地點搜尋失敗");
  const data = await response.json();
  if (!data.results?.length) throw new Error("搵唔到呢個地點");
  return data.results[0];
}

async function fetchForecast(latitude, longitude) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    "&hourly=precipitation,precipitation_probability,temperature_2m,weathercode" +
    "&forecast_days=7&timezone=auto";
  const response = await fetch(url);
  if (!response.ok) throw new Error("天氣預報載入失敗");
  return response.json();
}

function summarizeDryWindows(weather, weekdaySlots, weekendSlots, rainTolerance) {
  const byDay = new Map();

  weather.hourly.time.forEach((time, index) => {
    const date = new Date(time);
    const dayKey = date.toLocaleDateString("en-CA");
    const hour = date.getHours();
    const isWeekend = [0, 6].includes(date.getDay());
    const allowedSlots = isWeekend ? weekendSlots : weekdaySlots;
    if (!allowedSlots.includes(hour)) return;

    const entry = {
      hour,
      precipitation: Number(weather.hourly.precipitation[index] || 0),
      probability: Number(weather.hourly.precipitation_probability[index] || 0),
      temperature: Number(weather.hourly.temperature_2m[index] || 0),
    };

    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey).push(entry);
  });

  return [...byDay.entries()].map(([day, entries]) => {
    const sorted = [...entries].sort((a, b) => a.probability - b.probability || a.precipitation - b.precipitation);
    const dryCandidates = sorted.filter((entry) => entry.precipitation <= rainTolerance && entry.probability <= 35);
    const best = dryCandidates[0] || sorted[0];
    return {
      day,
      entries,
      best,
      isDry: dryCandidates.length > 0,
      score: Math.round(Math.max(8, 100 - best.probability * 1.5 - best.precipitation * 35)),
    };
  });
}

function refreshFitness() {
  state.fitness = deriveFitness(state.activities, state.profile);
  state.recommendations = deriveRecommendations(state.fitness, state.profile);
  state.aiCoach = buildAiCoachNarrative(state.fitness, state.profile, state.recommendations);
  persistState();
  renderFitness();
  renderActivities();
  renderAiCoach();
  renderActivityCalendar();
}

function deriveFitness(activities, profile) {
  const recent = activities
    .filter((activity) => daysBetween(activity.date, todayIso()) <= 28)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const currentAbility = deriveCurrentAbility(activities, profile);

  if (!recent.length) {
    return {
      weeklyLoad: 0,
      consistency: 0,
      fatigue: "未知",
      readiness: "待建立",
      efficiencyScore: 0,
      raceReadiness: "未有足夠數據",
      narrative: "未有足夠訓練紀錄，先輸入或匯入最近活動。",
      targetPace: targetPaceFromProfile(profile),
      currentAbilityPace: currentAbility.currentAbilityPace,
      abilitySummary: currentAbility.summary,
    };
  }

  const last7 = recent.filter((activity) => daysBetween(activity.date, todayIso()) <= 7);
  const last14 = recent.filter((activity) => daysBetween(activity.date, todayIso()) <= 14);
  const weeklyLoad = sum(last7.map((activity) => activity.trainingLoad));
  const previousLoad = sum(
    activities
      .filter((activity) => {
        const days = daysBetween(activity.date, todayIso());
        return days > 7 && days <= 14;
      })
      .map((activity) => activity.trainingLoad)
  );
  const loadRatio = previousLoad ? weeklyLoad / previousLoad : 1;
  const fatigue = loadRatio > 1.3 ? "偏高" : loadRatio < 0.7 ? "偏低" : "穩定";
  const readiness = weeklyLoad > 430 ? "需要恢復" : "可訓練";
  const consistency = new Set(recent.map((activity) => activity.date)).size;
  const easyRuns = last14.filter((activity) => activity.type === "easy" || activity.type === "recovery");
  const efficiencyScore = easyRuns.length
    ? Math.round(
        100 -
          average(easyRuns.map((activity) => activity.rpe)) * 6 -
          Math.max(0, average(easyRuns.map((activity) => activity.avgHr || 150)) - 145) * 0.6
      )
    : 62;

  return {
    weeklyLoad: Math.round(weeklyLoad),
    consistency,
    fatigue,
    readiness,
    efficiencyScore: clamp(efficiencyScore, 35, 92),
    raceReadiness: deriveRaceReadiness(recent, profile, targetPaceFromProfile(profile)),
    narrative: buildFitnessNarrative({ weeklyLoad, previousLoad, fatigue, readiness, consistency }),
    targetPace: targetPaceFromProfile(profile),
    currentAbilityPace: currentAbility.currentAbilityPace,
    abilitySummary: currentAbility.summary,
  };
}

function deriveCurrentAbility(activities, profile) {
  const recent = activities
    .filter((activity) => daysBetween(activity.date, todayIso()) <= 42)
    .filter((activity) => activity.distance >= 3 && activity.duration > 0 && activity.pace !== "-");
  const targetDistance = distanceGoalKm(profile.goal) || 10;
  const abilityLabel = abilityLabelForGoal(profile.goal);

  if (!recent.length) {
    return {
      currentAbilityPace: targetPaceFromProfile(profile),
      summary: `未有足夠活動去估算目前${abilityLabel}能力。`,
      abilityLabel,
    };
  }

  const equivalentPaces = recent
    .map((activity) => ({
      ...activity,
      equivalentTargetPace: equivalentRacePace(activity, targetDistance),
    }))
    .filter((activity) => activity.equivalentTargetPace > 0)
    .sort((a, b) => a.equivalentTargetPace - b.equivalentTargetPace);

  const top = equivalentPaces.slice(0, Math.min(3, equivalentPaces.length));
  const weighted = average(top.map((activity) => activity.equivalentTargetPace));
  const best = top[0];

  return {
    currentAbilityPace: Math.round(weighted || best?.equivalentTargetPace || 0),
    summary: best
      ? `按最近活動推算，你目前${abilityLabel}能力大約等於配速 ${formatPace(Math.round(weighted || best.equivalentTargetPace))}。`
      : `未有足夠活動去估算目前${abilityLabel}能力。`,
    abilityLabel,
  };
}

function equivalentRacePace(activity, targetDistanceKm) {
  if (!activity.distance || !activity.duration) return 0;
  const seconds = activity.duration * 60;
  const predictedSeconds = seconds * Math.pow(targetDistanceKm / activity.distance, 1.06);
  return predictedSeconds / targetDistanceKm;
}

function deriveRaceReadiness(recent, profile, targetPace) {
  if (!profile.raceDate || !targetPace) return "未設定目標";
  const hardSessions = recent.filter((activity) => ["tempo", "interval", "race", "long"].includes(activity.type));
  if (!hardSessions.length) return "基礎中";
  const closeToGoal = hardSessions.some((activity) => {
    const paceDelta = toPaceSeconds(activity.pace) - targetPace;
    return paceDelta <= 12 && activity.distance >= distanceGoalKm(profile.goal) * 0.45;
  });
  if (closeToGoal) return "接近目標";
  if (daysUntil(profile.raceDate) < 21) return "需集中配速";
  return "持續建立中";
}

function buildFitnessNarrative(metrics) {
  const deltaText = metrics.previousLoad
    ? `${Math.round(((metrics.weeklyLoad - metrics.previousLoad) / metrics.previousLoad) * 100)}%`
    : "0%";
  return `最近 7 日訓練負荷約 ${Math.round(metrics.weeklyLoad)}，較前一週變化 ${deltaText}。` +
    ` 目前疲勞水平 ${metrics.fatigue}，整體準備度 ${metrics.readiness}，近 28 日活躍日數 ${metrics.consistency}。`;
}

function deriveRecommendations(fitness, profile) {
  const goalDistance = distanceGoalKm(profile.goal);
  const targetPace = targetPaceFromProfile(profile);
  const recentDistance = sum(
    state.activities
      .filter((activity) => daysBetween(activity.date, todayIso()) <= 14)
      .map((activity) => activity.distance)
  );
  const observedWeekly = recentDistance ? recentDistance / 2 : 0;
  const baseline =
    profile.goal === "marathon" ? 48 :
    profile.goal === "half" ? 36 :
    profile.goal === "10k" ? 26 :
    profile.goal === "5k" ? 20 :
    18;

  let weeklyDistance = Math.max(observedWeekly || 0, baseline);
  if (targetPace && targetPace < 300) weeklyDistance += 6;
  if (profile.lifeLoad === "heavy") weeklyDistance -= 5;
  if (profile.sleepQuality === "poor") weeklyDistance -= 4;
  if (profile.injuryStatus === "niggle") weeklyDistance -= 5;
  if (profile.injuryStatus === "injured") weeklyDistance -= 9;
  if (fitness.readiness === "需要恢復") weeklyDistance -= 4;
  weeklyDistance = clamp(Math.round(weeklyDistance), 12, goalDistance === 42.2 ? 80 : 55);

  const maxLongRun = clamp(
    Math.round(Math.max(goalDistance * 0.45, weeklyDistance * 0.35)),
    8,
    profile.goal === "marathon" ? 30 : profile.goal === "half" ? 24 : 18
  );

  let qualityLimit = profile.injuryStatus === "injured" ? 0 : 2;
  if (profile.sleepQuality === "poor" || profile.lifeLoad === "heavy") qualityLimit -= 1;
  if (profile.goal === "base") qualityLimit = Math.min(qualityLimit, 1);
  qualityLimit = clamp(qualityLimit, 0, 2);

  return { weeklyDistance, maxLongRun, qualityLimit };
}

function buildAiCoachNarrative(fitness, profile, recommendations) {
  const limits = [];
  if (profile.injuryStatus !== "none") limits.push("有傷患 / 不適訊號");
  if (profile.sleepQuality === "poor") limits.push("睡眠較差");
  if (profile.lifeLoad === "heavy") limits.push("工作 / 生活壓力較高");
  if (profile.blockedDays.length) limits.push(`不可跑日：${profile.blockedDays.join(", ")}`);
  if (profile.lifeNotes) limits.push(`特別安排：${profile.lifeNotes}`);

  const reasons = limits.length ? limits.join("；") : "目前冇額外限制";
  const targetPaceText = fitness.targetPace ? `目標配速約 ${formatPace(fitness.targetPace)}` : "未能估算目標配速";
  const currentAbilityText = fitness.currentAbilityPace ? `目前能力約 ${formatPace(fitness.currentAbilityPace)}` : "未能穩定估算目前能力";
  const trainingAnchor = deriveTrainingAnchorPace(fitness);
  const anchorText = trainingAnchor ? `訓練主基線先以 ${formatPace(trainingAnchor)} 附近展開` : "訓練主基線先按保守強度開始";

  return `AI 教練判斷：${targetPaceText}；${currentAbilityText}。${anchorText}。基於 ${reasons}，建議本週先跑約 ${recommendations.weeklyDistance} km，` +
    `長課約 ${recommendations.maxLongRun} km，最多 ${recommendations.qualityLimit} 課高強度。` +
    `如果之後有新紀錄、睡眠變差，或者某幾日跑唔到，課表會再自動轉保守。`;
}

function renderFitness() {
  const fitness = state.fitness || deriveFitness(state.activities, state.profile);
  const recommendations = state.recommendations || deriveRecommendations(fitness, state.profile);
  const metrics = [
    { label: "最近 7 日負荷", value: `${fitness.weeklyLoad}`, hint: "距離 x RPE" },
    { label: "穩定性", value: `${fitness.consistency} 日`, hint: "近 28 日活躍日數" },
    { label: "疲勞水平", value: fitness.fatigue, hint: "對比前一週負荷" },
    { label: "效率分數", value: `${fitness.efficiencyScore}/100`, hint: "Easy run 表現" },
    { label: "建議週跑量", value: `${recommendations.weeklyDistance} km`, hint: "系統自動建議" },
    {
      label: `目前${fitness.abilityLabel || "能力"}`,
      value: fitness.currentAbilityPace ? formatPace(fitness.currentAbilityPace) : "待估算",
      hint: `根據最近活動推算的目前${fitness.abilityLabel || "目標距離"}等效配速`,
    },
  ];

  fitnessCards.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <span class="metric-label">${metric.label}</span>
          <strong class="metric-value">${metric.value}</strong>
          <span class="metric-hint">${metric.hint}</span>
        </article>`
    )
    .join("");

  const targetPaceText = fitness.targetPace ? `目標配速約 ${formatPace(fitness.targetPace)}。` : "未能估算目標配速。";
  fitnessNarrative.textContent = `${fitness.narrative} ${fitness.abilitySummary || ""} ${targetPaceText}`;
  renderGoalProgress(fitness);
}

function renderAiCoach() {
  aiCoachSummary.textContent = state.aiCoach || "完成設定後會生成 AI 教練建議。";
}

function renderWeather() {
  weatherCards.innerHTML = "";
  if (!state.weather.length) {
    weatherStatus.textContent = "未有 dry windows。";
    document.querySelector("#headlineWindows").textContent = "未有資料";
    return;
  }

  const dryCount = state.weather.filter((day) => day.isDry).length;
  weatherStatus.textContent = `未來 7 日有 ${dryCount} 日有相對乾爽窗口。`;
  document.querySelector("#headlineWindows").textContent = `${dryCount} 日可安排戶外跑`;

  const template = document.querySelector("#weatherCardTemplate");
  state.weather.forEach((day) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = formatDayLabel(day.day);
    node.querySelector(".weather-score").textContent = `${day.score}/100`;
    node.querySelector(".weather-window").textContent = `${pad(day.best.hour)}:00 最佳，降雨機率 ${day.best.probability}%`;
    node.querySelector(".weather-meta").textContent = `${day.isDry ? "適合戶外跑" : "建議後備方案"}，預計 ${day.best.temperature}°C，雨量 ${day.best.precipitation} mm。`;
    weatherCards.appendChild(node);
  });
}

function generatePlan() {
  const profile = state.profile;
  const fitness = state.fitness || deriveFitness(state.activities, profile);
  const recommendations = state.recommendations || deriveRecommendations(fitness, profile);
  const days = state.weather.length ? state.weather : buildFallbackDays();
  const rankedDays = [...days].sort((a, b) => b.score - a.score);
  const selectableDays = rankedDays.filter((item) => !profile.blockedDays.includes(weekdayName(item.day)));
  const selected = selectableDays.slice(0, profile.daysPerWeek).map((item) => item.day);
  const longRunCandidate = days.find((day) => weekdayName(day.day) === profile.longRunDay);

  if (
    selected.length &&
    longRunCandidate &&
    !profile.blockedDays.includes(weekdayName(longRunCandidate.day)) &&
    !selected.includes(longRunCandidate.day)
  ) {
    selected[selected.length - 1] = longRunCandidate.day;
  }

  const selectedDays = new Set(selected);
  const planTypes = buildSessionSequence(profile, fitness);
  let qualityUsed = 0;

  const schedule = days.map((day) => {
    const weekday = weekdayName(day.day);
    const chosen = selectedDays.has(day.day);
    let sessionType = chosen ? planTypes.shift() || "easy" : "recovery";

    if (weekday === profile.longRunDay && chosen) {
      sessionType = "long";
    }

    if (["speed", "tempo", "racePace"].includes(sessionType)) {
      if (qualityUsed >= recommendations.qualityLimit || fitness.readiness === "需要恢復") {
        sessionType = "easy";
      } else {
        qualityUsed += 1;
      }
    }

    if (!day.isDry && sessionType !== "recovery") {
      sessionType = sessionType === "long" ? "easy" : "mobility";
    }

    return {
      day: day.day,
      weekday,
      sessionType,
      label: sessionDefinitions[sessionType].label,
      details: buildSessionDetailsDetailed(sessionType, day, profile, fitness, recommendations),
      detailTable: buildSessionTableDetailed(sessionType, day, profile, fitness, recommendations),
    };
  });

  state.currentPlan = schedule;
  persistState();
  renderPlan(schedule, fitness, recommendations);
}

function buildSessionSequence(profile, fitness) {
  const weeksToRace = profile.raceDate ? Math.max(0, Math.ceil(daysUntil(profile.raceDate) / 7)) : null;
  const nearRace = weeksToRace !== null && weeksToRace <= 4;
  const lowReadiness = fitness.readiness === "需要恢復";

  if (profile.injuryStatus === "injured") return ["easy", "mobility", "easy", "recovery", "easy", "mobility"];
  if (profile.goal === "base") return ["easy", "easy", "mobility", "long", "recovery", "easy"];
  if (lowReadiness) return ["easy", "easy", "recovery", "long", "mobility", "easy"];
  if (nearRace) return ["racePace", "easy", "tempo", "long", "recovery", "easy"];
  if (["half", "marathon"].includes(profile.goal)) return ["tempo", "easy", "racePace", "long", "recovery", "easy"];
  return ["speed", "easy", "tempo", "long", "recovery", "easy"];
}

function buildSessionDetails(sessionType, day, profile, fitness, recommendations) {
  const def = sessionDefinitions[sessionType];
  const distance = estimateDistance(sessionType, fitness, recommendations, profile.daysPerWeek);
  const targetNote = buildTargetNote(sessionType, profile, fitness);
  const hrNote = buildHrNote(sessionType);
  const weatherNote = day.best
    ? `建議 ${pad(day.best.hour)}:00 開跑，降雨機率 ${day.best.probability}%。`
    : "建議改做室內訓練。";
  return `${distance}。${def.description} ${targetNote} ${hrNote} ${weatherNote}`;
}

function buildTargetNote(sessionType, profile, fitness) {
  const trainingPace = deriveTrainingAnchorPace(fitness);
  if (!trainingPace) return "未有足夠資料估配速。";
  if (sessionType === "racePace") return `現階段比賽配速課先以 ${formatPace(trainingPace - 5)} 至 ${formatPace(trainingPace)}。`;
  if (sessionType === "tempo") return `Tempo 配速 ${formatPace(trainingPace + 5)} 至 ${formatPace(trainingPace + 12)}。`;
  if (sessionType === "speed") return `快段配速 ${formatPace(Math.max(trainingPace - 22, 205))} 至 ${formatPace(Math.max(trainingPace - 12, 215))}。`;
  if (sessionType === "easy") return `Easy 配速 ${formatPace(trainingPace + 45)} 至 ${formatPace(trainingPace + 80)}。`;
  if (sessionType === "long") return `Long run 配速 ${formatPace(trainingPace + 35)} 至 ${formatPace(trainingPace + 65)}。`;
  return "以輕鬆可控強度完成。";
}

function deriveTrainingAnchorPace(fitness) {
  const current = fitness.currentAbilityPace || 0;
  const target = fitness.targetPace || 0;
  if (current && target) {
    if (target >= current) return current;
    return Math.round(current - Math.min((current - target) * 0.3, 15));
  }
  return current || target || 0;
}

function buildHrNote(sessionType) {
  const zones = deriveHeartRateZones();
  if (!zones) {
    return sessionType === "recovery" || sessionType === "mobility"
      ? "心率以非常輕鬆為主。"
      : "未有足夠心率資料，先以可控呼吸同 RPE 執行。";
  }

  if (sessionType === "racePace") return `目標 HR ${zones.z4.low}-${zones.z4.high} bpm。`;
  if (sessionType === "tempo") return `目標 HR ${zones.z4.low}-${zones.z4.high} bpm。`;
  if (sessionType === "speed") return `快段 HR 可上到 ${zones.z5.low}-${zones.z5.high} bpm。`;
  if (sessionType === "easy") return `目標 HR ${zones.z2.low}-${zones.z2.high} bpm。`;
  if (sessionType === "long") return `前段 HR ${zones.z2.low}-${zones.z2.high} bpm，尾段最多 ${zones.z3.high} bpm。`;
  return `保持 HR 低於 ${zones.z2.high} bpm。`;
}

function buildSessionDetailsDetailed(sessionType, day, profile, fitness, recommendations) {
  const def = sessionDefinitions[sessionType];
  const distanceKm = estimateDistanceDetailedValue(sessionType, fitness, recommendations, profile.daysPerWeek);
  const structure = buildSessionStructureDetailed(sessionType, distanceKm, fitness);
  const targetNote = buildTargetNoteDetailed(sessionType, fitness);
  const hrNote = buildHrNoteDetailed(sessionType);
  const weatherNote = buildWeatherNoteDetailed(day);

  const lines = [
    `<div class="plan-detail-lead">${def.description}</div>`,
    structure ? `<div class="plan-detail-line">${structure}</div>` : "",
    targetNote ? `<div class="plan-detail-line"><strong>Pace:</strong> ${targetNote}</div>` : "",
    hrNote ? `<div class="plan-detail-line"><strong>HR:</strong> ${hrNote}</div>` : "",
    weatherNote ? `<div class="plan-detail-line"><strong>天氣:</strong> ${weatherNote}</div>` : "",
  ].filter(Boolean);

  return `<div class="plan-detail-stack">${lines.join("")}</div>`;
}

function buildSessionStructureDetailed(sessionType, distanceKm, fitness) {
  if (sessionType === "mobility") {
    return "20-30 分鐘活動度 + 核心訓練；如雙腳狀態輕鬆，可加 3-4 km 超輕鬆恢復跑。";
  }

  if (sessionType === "recovery") {
    return "休息或散步 20-30 分鐘，重點做伸展、補眠與恢復。";
  }

  if (!distanceKm) {
    return "";
  }

  const anchorPace = deriveTrainingAnchorPace(fitness);
  const warmupKm = clampDistanceDetailed(distanceKm * 0.22, 2, 3);
  const cooldownKm = clampDistanceDetailed(distanceKm * 0.18, 1.5, 3);

  if (sessionType === "easy") {
    return `全程 ${formatSessionDistanceDetailed(distanceKm)} 輕鬆完成，維持可對話強度，最後加 4 x 20 秒放鬆加速跑。`;
  }

  if (sessionType === "tempo") {
    const mainKm = clampDistanceDetailed(distanceKm - warmupKm - cooldownKm, 3, Math.max(4, distanceKm * 0.55));
    return [
      `${formatSessionDistanceDetailed(warmupKm)} 熱身`,
      `${formatSessionDistanceDetailed(mainKm)} Tempo 主段`,
      `${formatSessionDistanceDetailed(cooldownKm)} 放鬆跑`,
    ].join(" | ");
  }

  if (sessionType === "racePace") {
    const mainKm = clampDistanceDetailed(distanceKm - warmupKm - cooldownKm, 3, Math.max(5, distanceKm * 0.6));
    return [
      `${formatSessionDistanceDetailed(warmupKm)} 熱身`,
      `${formatSessionDistanceDetailed(mainKm)} 目標配速主段`,
      `${formatSessionDistanceDetailed(cooldownKm)} 放鬆跑`,
    ].join(" | ");
  }

  if (sessionType === "speed" || sessionType === "progressive") {
    const warm = clampDistanceDetailed(distanceKm * 0.25, 2, 3);
    const cooldown = clampDistanceDetailed(distanceKm * 0.15, 1.5, 2.5);
    const workSetKm = Math.max(2.4, distanceKm - warm - cooldown);
    const reps = workSetKm >= 4 ? 6 : 5;
    const repKm = reps >= 6 ? 0.6 : 0.5;
    const recoverKm = repKm <= 0.5 ? 0.25 : 0.3;
    return [
      `${formatSessionDistanceDetailed(warm)} 熱身 + drills`,
      `${reps} x ${formatSessionDistanceDetailed(repKm)} 快段，每組之間 ${formatSessionDistanceDetailed(recoverKm)} 慢跑恢復`,
      `${formatSessionDistanceDetailed(cooldown)} 放鬆跑`,
      anchorPace ? `如今日做 progressive，可改為 3 段：2 km @ ${formatPace(anchorPace + 35)} / 2 km @ ${formatPace(anchorPace + 18)} / 1-2 km @ ${formatPace(anchorPace + 5)}` : "",
    ].filter(Boolean).join(" | ");
  }

  if (sessionType === "long") {
    const earlyKm = clampDistanceDetailed(distanceKm * 0.45, 4, distanceKm * 0.5);
    const middleKm = clampDistanceDetailed(distanceKm * 0.35, 3, distanceKm * 0.4);
    const lateKm = clampDistanceDetailed(Math.max(distanceKm - earlyKm - middleKm, 2), 2, distanceKm * 0.3);
    return [
      `唔建議全程同一配速`,
      `前段 ${formatSessionDistanceDetailed(earlyKm)} 保守巡航`,
      `中段 ${formatSessionDistanceDetailed(middleKm)} 穩定有氧`,
      `尾段 ${formatSessionDistanceDetailed(lateKm)} 漸進提速完成`,
    ].join(" | ");
  }

  return `${formatSessionDistanceDetailed(distanceKm)} 完成即可，重點維持順暢步頻與穩定呼吸。`;
}

function buildTargetNoteDetailed(sessionType, fitness) {
  const anchor = deriveTrainingAnchorPace(fitness);
  if (!anchor) return "未有足夠數據，先以 RPE 配合呼吸感覺控制強度。";

  if (sessionType === "easy") {
    return `全程約 ${formatPace(anchor + 45)} - ${formatPace(anchor + 80)}，寧願慢少少都要保持放鬆。`;
  }

  if (sessionType === "tempo") {
    return `熱身/放鬆段用 ${formatPace(anchor + 50)} 左右；主段 Tempo 用 ${formatPace(anchor + 5)} - ${formatPace(anchor + 12)}。`;
  }

  if (sessionType === "racePace") {
    return `熱身/放鬆段用 ${formatPace(anchor + 45)} - ${formatPace(anchor + 70)}；主段鎖定 ${formatPace(anchor - 5)} - ${formatPace(anchor)}。`;
  }

  if (sessionType === "speed" || sessionType === "progressive") {
    return `熱身/放鬆段用 ${formatPace(anchor + 50)} 左右；快段用 ${formatPace(Math.max(anchor - 22, 205))} - ${formatPace(Math.max(anchor - 12, 215))}；恢復跑放慢到 ${formatPace(anchor + 75)} 左右。`;
  }

  if (sessionType === "long") {
    return `唔係全程一樣配速；前段 ${formatPace(anchor + 55)} - ${formatPace(anchor + 70)}，中段 ${formatPace(anchor + 35)} - ${formatPace(anchor + 50)}，尾段可漸進到 ${formatPace(anchor + 15)} - ${formatPace(anchor + 28)}。`;
  }

  return "以恢復為主，配速唔需要刻意追。";
}

function buildHrNoteDetailed(sessionType) {
  const zones = deriveHeartRateZones();
  if (!zones) {
    if (sessionType === "recovery" || sessionType === "mobility") {
      return "以放鬆恢復為主，主觀強度保持很輕鬆。";
    }
    return "未有足夠心率數據，先用 RPE 控制：Easy 4-5/10，Tempo 7/10，速度課 8/10。";
  }

  if (sessionType === "easy") {
    return `大部分時間維持 Z2 ${zones.z2.low}-${zones.z2.high} bpm。`;
  }

  if (sessionType === "tempo") {
    return `熱身/放鬆維持 Z2；主段進入 Z4 ${zones.z4.low}-${zones.z4.high} bpm。`;
  }

  if (sessionType === "racePace") {
    return `熱身/放鬆維持 Z2；主段鎖定 Z4 ${zones.z4.low}-${zones.z4.high} bpm。`;
  }

  if (sessionType === "speed" || sessionType === "progressive") {
    return `熱身/恢復段留在 Z2；快段可去到高 Z4 至 Z5 ${zones.z5.low}-${zones.z5.high} bpm，但唔好由第一組就爆。`;
  }

  if (sessionType === "long") {
    return `前半維持 Z2 ${zones.z2.low}-${zones.z2.high} bpm；中後段可升到 Z3 ${zones.z3.low}-${zones.z3.high} bpm，尾段最多輕觸低 Z4。`;
  }

  return `保持恢復強度，盡量唔好長時間高過 ${zones.z2.high} bpm。`;
}

function buildWeatherNoteDetailed(day) {
  if (!day.best) {
    return day.isDry ? "當日整體較乾爽，可按平日習慣時段完成。" : "未有明確乾爽時段，建議改室內訓練或恢復課。";
  }

  return `${pad(day.best.hour)}:00 左右最穩陣，降雨機率約 ${day.best.probability}%${day.best.temp ? `，氣溫約 ${Math.round(day.best.temp)}°C` : ""}。`;
}

function estimateDistanceDetailedValue(sessionType, fitness, recommendations, daysPerWeek) {
  const base = Math.max(4, recommendations.weeklyDistance / Math.max(daysPerWeek, 1));
  let distance =
    sessionType === "long" ? Math.min(recommendations.maxLongRun, base * 1.85) :
    sessionType === "tempo" ? base * 1.1 :
    sessionType === "speed" || sessionType === "progressive" ? base * 0.9 :
    sessionType === "racePace" ? base * 1.05 :
    sessionType === "easy" ? base :
    0;

  if (fitness.readiness === "需要恢復") distance *= 0.85;
  if (!distance) return 0;
  return clampDistanceDetailed(distance, 3, Math.max(4, recommendations.maxLongRun || distance));
}

function formatSessionDistanceDetailed(distance) {
  if (!distance) return "-";
  const rounded = Math.round(distance * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)} km` : `${rounded.toFixed(1)} km`;
}

function buildSessionTableDetailed(sessionType, day, profile, fitness, recommendations) {
  const distanceKm = estimateDistanceDetailedValue(sessionType, fitness, recommendations, profile.daysPerWeek);
  return {
    total: buildSessionTotalSummary(sessionType, distanceKm),
    totalShort: buildSessionTotalShort(sessionType, distanceKm),
    overview: {
      pace: buildTargetNoteDetailed(sessionType, fitness),
      hr: buildHrNoteDetailed(sessionType),
      weather: buildWeatherNoteDetailed(day),
    },
    rows: buildSessionTableRows(sessionType, distanceKm, fitness),
  };
}

function buildSessionTableRows(sessionType, distanceKm, fitness) {
  const zones = deriveHeartRateZones();
  const anchor = deriveTrainingAnchorPace(fitness);
  const easyPace = anchor ? `${formatPace(anchor + 45)} - ${formatPace(anchor + 80)}` : "Easy effort";
  const easyHr = zones ? `Z2 ${zones.z2.low}-${zones.z2.high}` : "RPE 4-5";
  const steadyHr = zones ? `Z3 ${zones.z3.low}-${zones.z3.high}` : "RPE 6";
  const tempoHr = zones ? `Z4 ${zones.z4.low}-${zones.z4.high}` : "RPE 7";
  const speedHr = zones ? `Z4-Z5 ${zones.z4.low}-${zones.z5.high}` : "RPE 8";

  if (sessionType === "mobility") {
    return [
      { segment: "主項", distance: "20-30 分鐘", pace: "-", hr: "恢復強度", note: "活動度、核心、臀腿穩定" },
      { segment: "可選", distance: "3-4 km", pace: "超輕鬆", hr: easyHr, note: "只在雙腳放鬆時加上" },
    ];
  }

  if (sessionType === "recovery") {
    return [
      { segment: "恢復", distance: "休息 / 20-30 分鐘", pace: "-", hr: "低壓恢復", note: "散步、伸展、補眠" },
    ];
  }

  if (!distanceKm) {
    return [];
  }

  const warmupKm = clampDistanceDetailed(distanceKm * 0.22, 2, 3);
  const cooldownKm = clampDistanceDetailed(distanceKm * 0.18, 1.5, 3);

  if (sessionType === "easy") {
    return [
      { segment: "全程", distance: formatSessionDistanceDetailed(distanceKm), pace: easyPace, hr: easyHr, note: "可對話強度" },
      { segment: "加速跑", distance: "4 x 20 秒", pace: anchor ? `${formatPace(anchor - 10)} 左右` : "順腳加速", hr: "短暫提高", note: "放鬆步幅，唔好衝爆" },
    ];
  }

  if (sessionType === "tempo") {
    const mainKm = clampDistanceDetailed(distanceKm - warmupKm - cooldownKm, 3, Math.max(4, distanceKm * 0.55));
    return [
      { segment: "熱身", distance: formatSessionDistanceDetailed(warmupKm), pace: anchor ? `${formatPace(anchor + 50)} 左右` : easyPace, hr: easyHr, note: "加入 drills" },
      { segment: "主段", distance: formatSessionDistanceDetailed(mainKm), pace: anchor ? `${formatPace(anchor + 5)} - ${formatPace(anchor + 12)}` : "Tempo effort", hr: tempoHr, note: "穩定偏辛苦但可控" },
      { segment: "放鬆", distance: formatSessionDistanceDetailed(cooldownKm), pace: easyPace, hr: easyHr, note: "回落呼吸" },
    ];
  }

  if (sessionType === "racePace") {
    const mainKm = clampDistanceDetailed(distanceKm - warmupKm - cooldownKm, 3, Math.max(5, distanceKm * 0.6));
    return [
      { segment: "熱身", distance: formatSessionDistanceDetailed(warmupKm), pace: anchor ? `${formatPace(anchor + 50)} 左右` : easyPace, hr: easyHr, note: "先跑順步頻" },
      { segment: "主段", distance: formatSessionDistanceDetailed(mainKm), pace: anchor ? `${formatPace(anchor - 5)} - ${formatPace(anchor)}` : "Goal pace", hr: tempoHr, note: "模擬比賽節奏" },
      { segment: "放鬆", distance: formatSessionDistanceDetailed(cooldownKm), pace: easyPace, hr: easyHr, note: "落返輕鬆" },
    ];
  }

  if (sessionType === "speed" || sessionType === "progressive") {
    const warm = clampDistanceDetailed(distanceKm * 0.25, 2, 3);
    const cooldown = clampDistanceDetailed(distanceKm * 0.15, 1.5, 2.5);
    const workSetKm = Math.max(2.4, distanceKm - warm - cooldown);
    const reps = workSetKm >= 4 ? 6 : 5;
    const repKm = reps >= 6 ? 0.6 : 0.5;
    const recoverKm = repKm <= 0.5 ? 0.25 : 0.3;
    return [
      { segment: "熱身", distance: formatSessionDistanceDetailed(warm), pace: anchor ? `${formatPace(anchor + 50)} 左右` : easyPace, hr: easyHr, note: "加 drills" },
      { segment: "快段", distance: `${reps} x ${formatSessionDistanceDetailed(repKm)}`, pace: anchor ? `${formatPace(Math.max(anchor - 22, 205))} - ${formatPace(Math.max(anchor - 12, 215))}` : "Fast reps", hr: speedHr, note: "專注步頻同跑姿" },
      { segment: "恢復跑", distance: `${reps} x ${formatSessionDistanceDetailed(recoverKm)}`, pace: anchor ? `${formatPace(anchor + 75)} 左右` : "Jog", hr: easyHr, note: "每組之間慢跑" },
      { segment: "放鬆", distance: formatSessionDistanceDetailed(cooldown), pace: easyPace, hr: easyHr, note: "完全放鬆收操" },
    ];
  }

  if (sessionType === "long") {
    const earlyKm = clampDistanceDetailed(distanceKm * 0.45, 4, distanceKm * 0.5);
    const middleKm = clampDistanceDetailed(distanceKm * 0.35, 3, distanceKm * 0.4);
    const lateKm = clampDistanceDetailed(Math.max(distanceKm - earlyKm - middleKm, 2), 2, distanceKm * 0.3);
    return [
      { segment: "前段", distance: formatSessionDistanceDetailed(earlyKm), pace: anchor ? `${formatPace(anchor + 55)} - ${formatPace(anchor + 70)}` : easyPace, hr: easyHr, note: "保守巡航，唔好搶" },
      { segment: "中段", distance: formatSessionDistanceDetailed(middleKm), pace: anchor ? `${formatPace(anchor + 35)} - ${formatPace(anchor + 50)}` : "Steady", hr: steadyHr, note: "穩定有氧輸出" },
      { segment: "尾段", distance: formatSessionDistanceDetailed(lateKm), pace: anchor ? `${formatPace(anchor + 15)} - ${formatPace(anchor + 28)}` : "Progressive", hr: zones ? `Z3 ${zones.z3.low}-${zones.z3.high}` : "RPE 6-7", note: "漸進提速完成，唔係全程同 pace" },
    ];
  }

  return [
    { segment: "主項", distance: formatSessionDistanceDetailed(distanceKm), pace: easyPace, hr: easyHr, note: "按身體感覺完成" },
  ];
}

function buildSessionTotalSummary(sessionType, distanceKm) {
  if (sessionType === "recovery") {
    return "全程總量：休息 / 20-30 分鐘恢復";
  }

  if (sessionType === "mobility") {
    return "全程總量：20-30 分鐘活動度，可選加 3-4 km 超輕鬆跑";
  }

  if (!distanceKm) {
    return "全程總量：-";
  }

  return `全程總距離：${formatSessionDistanceDetailed(distanceKm)}`;
}

function buildSessionTotalShort(sessionType, distanceKm) {
  if (sessionType === "recovery") {
    return "(休息 / 20-30 分鐘)";
  }

  if (sessionType === "mobility") {
    return "(20-30 分鐘活動度)";
  }

  if (!distanceKm) {
    return "(-)";
  }

  return `(${formatSessionDistanceDetailed(distanceKm)})`;
}

function clampDistanceDetailed(value, min, max) {
  return roundToHalf(clamp(value, min, max));
}

function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

function deriveHeartRateZones() {
  const recentHr = state.activities
    .map((activity) => Number(activity.avgHr || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const restingHr = average(
    state.activities
      .map((activity) => Number(activity.restingHr || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
  ) || 58;

  if (!recentHr.length) return null;

  const maxObserved = Math.max(...recentHr, 178);
  const reserve = Math.max(25, maxObserved - restingHr);

  return {
    z2: {
      low: Math.round(restingHr + reserve * 0.60),
      high: Math.round(restingHr + reserve * 0.72),
    },
    z3: {
      low: Math.round(restingHr + reserve * 0.73),
      high: Math.round(restingHr + reserve * 0.82),
    },
    z4: {
      low: Math.round(restingHr + reserve * 0.83),
      high: Math.round(restingHr + reserve * 0.90),
    },
    z5: {
      low: Math.round(restingHr + reserve * 0.91),
      high: Math.round(restingHr + reserve * 0.98),
    },
  };
}

function estimateDistance(sessionType, fitness, recommendations, daysPerWeek) {
  const base = Math.max(4, recommendations.weeklyDistance / Math.max(daysPerWeek, 1));
  let distance =
    sessionType === "long" ? Math.min(recommendations.maxLongRun, base * 1.85) :
    sessionType === "tempo" ? base * 1.1 :
    sessionType === "speed" ? base * 0.9 :
    sessionType === "racePace" ? base * 1.05 :
    sessionType === "easy" ? base :
    sessionType === "mobility" ? 0 :
    0;

  if (fitness.readiness === "需要恢復") distance *= 0.85;
  if (!distance) return "休息或做 20-30 分鐘活動度";
  return `建議距離約 ${distance.toFixed(1)} km`;
}

function renderPlan(schedule, fitness, recommendations) {
  planBoard.innerHTML = "";
  const quality = schedule.filter((item) => ["speed", "tempo", "racePace", "long"].includes(item.sessionType)).length;
  const raceLine = describeGoal(state.profile);
  planSummary.textContent =
    `${raceLine} 本週安排 ${quality} 個重點訓練日。` +
    ` 建議週跑量約 ${recommendations.weeklyDistance} km，長課約 ${recommendations.maxLongRun} km。` +
    ` 目前身體狀況：${fitness.readiness}，疲勞：${fitness.fatigue}。`;
  planBoard.innerHTML = renderPlanDetailTable(schedule);
}

function renderPlanDetailTable(schedule) {
  const rows = schedule.map((day) => {
    const overview = day.detailTable?.overview || {};
    const totalShort = day.detailTable?.totalShort || "";
    const segments = (day.detailTable?.rows || []).map((row) => {
      return `
        <div class="plan-inline-item">
          <strong>${row.segment}</strong>
          <span>${row.distance}</span>
          <span>${row.pace}</span>
          <span>${row.hr}</span>
          <span>${row.note}</span>
        </div>
      `;
    }).join("");

    return `
      <tr>
        <td class="plan-col-day">
          <div class="plan-day">${day.weekday}</div>
          <div class="plan-row-date">${formatDayLabel(day.day)}</div>
        </td>
        <td class="plan-col-session">
          <div class="plan-session-main">${day.label}</div>
          <div class="plan-session-total">${totalShort}</div>
        </td>
        <td class="plan-col-structure">
          ${segments || "-"}
        </td>
        <td class="plan-col-pace">${overview.pace || "-"}</td>
        <td class="plan-col-hr">${overview.hr || "-"}</td>
        <td class="plan-col-weather">${overview.weather || "-"}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="plan-master-wrap">
      <table class="plan-master-table">
        <thead>
          <tr>
            <th>日子</th>
            <th>課表</th>
            <th>分段細節</th>
            <th>Pace</th>
            <th>HR</th>
            <th>天氣 / 時段</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderActivities() {
  if (!state.activities.length) {
    activityInsight.textContent = "未有活動資料。";
    activityTableWrap.innerHTML = "";
    activityDetail.innerHTML = "點擊月曆或活動紀錄，即可查看該次活動分析。";
    document.querySelector("#headlineInsight").textContent = "未有活動";
    return;
  }

  const latest = state.activities[0];
  const insight = analyzeActivity(latest, state.activities.slice(0, 8), state.fitness);
  state.lastInsight = insight.summary;
  persistState();

  activityInsight.textContent = `${insight.summary} ${insight.nextStep}`;
  document.querySelector("#headlineInsight").textContent = insight.headline;

  const rows = state.activities
    .slice(0, 20)
    .map(
      (activity) => `
      <tr data-activity-key="${activityKey(activity)}">
        <td>${activity.date}</td>
        <td>${activity.type}</td>
        <td>${activity.distance.toFixed(1)}</td>
        <td>${activity.duration}</td>
        <td>${activity.pace}</td>
        <td>${activity.avgHr || "-"}</td>
        <td>${activity.rpe}</td>
        <td>${activity.trainingLoad}</td>
      </tr>`
    )
    .join("");

  activityTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>類型</th>
          <th>距離</th>
          <th>分鐘</th>
          <th>配速</th>
          <th>心率</th>
          <th>RPE</th>
          <th>負荷</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  activityTableWrap.querySelectorAll("tbody tr").forEach((row) => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const activity = state.activities.find((item) => activityKey(item) === row.dataset.activityKey);
      if (activity) renderActivityDetail(activity);
    });
  });

  renderActivityDetail(state.activities[0]);
}

function analyzeActivity(activity, recentActivities, fitness) {
  const paceSeconds = toPaceSeconds(activity.pace);
  const recentAveragePace = average(recentActivities.map((item) => toPaceSeconds(item.pace)).filter(Boolean));
  const paceGain = recentAveragePace ? recentAveragePace - paceSeconds : 0;

  let headline = "穩定推進";
  let summary = `${activity.date} 呢課 ${activity.distance.toFixed(1)} km，平均配速 ${activity.pace}，訓練負荷 ${activity.trainingLoad}。`;
  let nextStep = "下一課可照現有課表進行。";

  if (paceGain > 12 && activity.rpe <= 6) {
    headline = "效率提升";
    summary = `你今次比最近平均快約 ${Math.round(paceGain)} 秒/km，而且主觀強度仍然可控。`;
    nextStep = "可以維持一課質量課，但長課唔需要再加太多。";
  }

  if (activity.rpe >= 8 || activity.notes.includes("痛") || fitness?.readiness === "需要恢復") {
    headline = "需要恢復";
    summary = "今次活動顯示負荷偏高，或者身體有疲勞訊號。";
    nextStep = "建議下一課做 easy run、恢復跑，或者改做休息。";
  }

  return { headline, summary, nextStep };
}

function renderActivityDetail(activity) {
  const similar = state.activities
    .filter((item) => item.type === activity.type && item.date !== activity.date)
    .slice(0, 5);
  const detail = analyzeSingleActivity(activity, similar, state.fitness);
  activityDetail.innerHTML = `
    <div class="detail-title">${activity.date} · ${activity.type}</div>
    <div class="detail-grid">
      <div class="detail-section">
        <strong>表現總結</strong>
        <div>${detail.summary}</div>
      </div>
      <div class="detail-section">
        <strong>Run Dynamics</strong>
        <div>${detail.dynamics}</div>
      </div>
      <div class="detail-section">
        <strong>改善建議</strong>
        <div>${detail.improvement}</div>
      </div>
      <div class="detail-section">
        <strong>課表符合度</strong>
        <div>${detail.adherence}</div>
      </div>
    </div>`;
}

function analyzeSingleActivity(activity, comparableActivities, fitness) {
  const paceSeconds = toPaceSeconds(activity.pace);
  const comparablePace = average(comparableActivities.map((item) => toPaceSeconds(item.pace)).filter(Boolean));
  const paceDelta = comparablePace ? comparablePace - paceSeconds : 0;
  const hrText = activity.avgHr ? `平均心率 ${activity.avgHr} bpm。` : "未有心率資料。";
  const loadText = `訓練負荷 ${activity.trainingLoad}。`;
  const trendText = comparablePace
    ? paceDelta > 8
      ? `比同類近期活動快約 ${Math.round(paceDelta)} 秒/km。`
      : paceDelta < -8
        ? `比同類近期活動慢約 ${Math.round(Math.abs(paceDelta))} 秒/km。`
        : "與同類近期活動表現接近。"
    : "未有足夠同類活動作比較。";
  const readinessText = fitness?.readiness === "需要恢復"
    ? "目前整體狀態偏攰，之後一兩課建議保守。"
    : "目前整體狀態可接受，可以按計劃推進。";
  const dynamicsText = analyzeRunDynamics(activity);
  const improvementText = buildImprovementAdvice(activity);
  const adherenceText = analyzePlanAdherence(activity);
  return {
    summary: `${activity.distance.toFixed(1)} km，用時 ${activity.duration} 分鐘，配速 ${activity.pace}。${hrText} ${loadText} ${trendText} ${readinessText}`,
    dynamics: dynamicsText,
    improvement: improvementText,
    adherence: adherenceText,
  };
}

function analyzeRunDynamics(activity) {
  const hasDynamics =
    Number(activity.cadence || 0) > 0 ||
    Number(activity.groundTime || 0) > 0 ||
    Number(activity.verticalOscillation || 0) > 0;

  if (!hasDynamics) {
    return "未有足夠動態數據。呢筆活動可能係舊版匯入資料，請重新匯入原始 CSV 以啟用 cadence、GCT 同垂直振幅分析。";
  }

  const notes = [];
  if (activity.cadence) {
    if (activity.cadence < 164) notes.push(`步頻 ${Math.round(activity.cadence)} spm 偏低，可嘗試縮短步幅提升流暢度`);
    else if (activity.cadence > 184) notes.push(`步頻 ${Math.round(activity.cadence)} spm 偏高，留意有冇過度碎步`);
    else notes.push(`步頻 ${Math.round(activity.cadence)} spm 屬合理範圍`);
  }
  if (activity.groundTime) {
    if (activity.groundTime > 290) notes.push(`觸地時間 ${Math.round(activity.groundTime)} ms 偏長，可加強力量同髖伸展`);
    else if (activity.groundTime < 230) notes.push(`觸地時間 ${Math.round(activity.groundTime)} ms 相當俐落`);
  }
  if (activity.verticalOscillation) {
    if (activity.verticalOscillation > 9.5) notes.push(`垂直振幅 ${activity.verticalOscillation.toFixed(1)} cm 偏大，跑姿可再慳力少少`);
    else if (activity.verticalOscillation < 7) notes.push(`垂直振幅 ${activity.verticalOscillation.toFixed(1)} cm 控制唔錯`);
  }
  return notes.length
    ? `Run dynamics：${notes.join("；")}。`
    : "Run dynamics：未有足夠可判讀嘅動態變化，建議再累積多幾次原始活動資料。";
}

function buildImprovementAdvice(activity) {
  const suggestions = [];
  if (activity.avgHr && activity.pace !== "-") {
    suggestions.push("下次可留意相近心率下配速有冇更穩定");
  }
  if (activity.cadence && activity.cadence < 164) {
    suggestions.push("熱身後做 4-6 組 20 秒快腳步頻 drill");
  }
  if (activity.groundTime && activity.groundTime > 290) {
    suggestions.push("加入小腿、臀腿力量訓練去改善推進");
  }
  if (activity.verticalOscillation && activity.verticalOscillation > 9.5) {
    suggestions.push("專注身體微微前傾，減少上下彈跳");
  }
  return suggestions.length ? `改善建議：${suggestions.join("；")}。` : "改善建議：保持目前執行，重點係穩定累積。";
}

function analyzePlanAdherence(activity) {
  const planItem = (state.currentPlan || []).find((item) => item.day === activity.date);
  if (!planItem) return "課表對照：該日未有已生成課表可比較。";

  const planned = normalizeType(planItem.sessionType || planItem.label || "");
  const actual = normalizeType(activity.type);
  const matched =
    (planned === "easy" && ["easy", "recovery"].includes(actual)) ||
    planned === actual ||
    (planned === "long" && actual === "long") ||
    (planned === "tempo" && ["tempo", "interval", "race"].includes(actual)) ||
    (planned === "interval" && ["interval", "tempo"].includes(actual));

  return matched
    ? `課表對照：有跟到當日建議，原定 ${planItem.label}。`
    : `課表對照：原定 ${planItem.label}，今次實際做咗 ${activity.type}，有少少偏離計劃。`;
}

function renderGoalProgress(fitness) {
  const progress = calculateGoalProgress(fitness, state.profile);
  goalProgressFill.style.width = `${progress.percent}%`;
  goalProgressLabel.textContent = progress.label;
  goalProgressDetail.textContent = progress.detail;
  currentAbilityValue.textContent = progress.currentText;
  targetAbilityValue.textContent = progress.targetText;
  abilityGapValue.textContent = progress.gapText;
}

function calculateGoalProgress(fitness, profile) {
  const current = fitness.currentAbilityPace || 0;
  const target = fitness.targetPace || 0;
  if (!current || !target) {
    return {
      percent: 0,
      label: "等待足夠活動資料",
      detail: "系統需要用你最近上傳的活動去推算目前能力，之後先可以計到距離目標仲差幾多。",
      currentText: "--",
      targetText: "--",
      gapText: "--",
    };
  }

  if (target >= current) {
    return {
      percent: 100,
      label: "目標已在目前能力範圍內",
      detail: `你目前${fitness.abilityLabel || "能力"}約 ${formatPace(current)}，而目標配速約 ${formatPace(target)}。換句話講，你現階段已達到或快過目標要求。`,
      currentText: formatPace(current),
      targetText: formatPace(target),
      gapText: "已達標",
    };
  }

  const gap = current - target;
  const achieved = Math.max(0, 35 - gap);
  const percent = clamp(Math.round((achieved / 35) * 100), 6, 100);
  const targetTimeText = profile.targetTime ? `目標 ${profile.targetTime}` : `目標 ${formatPace(target)}`;
  const gapText = `${Math.floor(gap / 60)}分${String(Math.round(gap % 60)).padStart(2, "0")}秒/km`;
  return {
    percent,
    label: `${fitness.abilityLabel || "目標"}進度`,
    detail: `目前${fitness.abilityLabel || "能力"}以最近活動推算，相當於配速 ${formatPace(current)}。目標配速約 ${formatPace(target)}，即仲需要提升大約 ${gapText} 每公里。進度條代表由目前能力推進到目標所完成的大概比例。`,
    currentText: formatPace(current),
    targetText: profile.targetTime ? `${profile.targetTime}` : formatPace(target),
    gapText,
  };
}

function renderActivityCalendar() {
  activityCalendarRows.innerHTML = "";
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  calendarTitle.textContent = `${year}年 ${month + 1}月 活動月曆`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day).toLocaleDateString("en-CA");
    const activity = state.activities.find((item) => item.date === cellDate);
    cells.push({ day, cellDate, activity });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ empty: true });
  }

  for (let i = 0; i < cells.length; i += 7) {
    const weekCells = cells.slice(i, i + 7);
    const row = document.createElement("div");
    row.className = "calendar-row";

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    weekCells.forEach((item) => {
      if (item.empty) {
        const empty = document.createElement("div");
        empty.className = "calendar-cell empty";
        grid.appendChild(empty);
        return;
      }

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `calendar-cell${item.activity ? " has-activity" : ""}`;
      if (!item.activity) {
        cell.innerHTML = `<span class="calendar-day">${item.day}</span><span class="calendar-meta">沒有活動</span>`;
      } else {
        cell.innerHTML = `<span class="calendar-day">${item.day}</span><span class="calendar-meta">${item.activity.type}<br>${item.activity.distance.toFixed(1)} km<br>${item.activity.pace}</span>`;
        cell.addEventListener("click", () => renderActivityDetail(item.activity));
      }
      grid.appendChild(cell);
    });

    const summaryData = buildWeeklyMileageCard(weekCells);
    const summary = document.createElement("aside");
    summary.className = `weekly-summary${summaryData.tone ? ` ${summaryData.tone}` : ""}`;
    summary.innerHTML = summaryData.html;

    row.appendChild(grid);
    row.appendChild(summary);
    activityCalendarRows.appendChild(row);
  }
}

function buildWeeklyMileageCard(weekCells) {
  const datedCells = weekCells.filter((item) => !item.empty);
  if (!datedCells.length) {
    return {
      tone: "",
      html: `<div class="weekly-mileage-item"><div class="weekly-mileage-label">每週跑量</div><div class="weekly-mileage-value">-</div></div>`,
    };
  }

  const weekActivities = datedCells
    .map((item) => item.activity)
    .filter(Boolean);
  const total = sum(weekActivities.map((activity) => activity.distance));
  const startDate = datedCells[0].cellDate;
  const endDate = datedCells[datedCells.length - 1].cellDate;
  const recommended = state.recommendations?.weeklyDistance || 0;
  const ratio = recommended ? total / recommended : 0;
  const percent = recommended ? clamp(Math.round(ratio * 100), 0, 140) : 0;
  const status =
    !recommended ? "未有建議基線" :
    ratio < 0.75 ? "低於建議跑量" :
    ratio > 1.15 ? "高於建議跑量" :
    "接近建議跑量";
  const tone =
    !recommended ? "" :
    ratio < 0.75 ? "low" :
    ratio > 1.15 ? "high" :
    "good";

  return {
    tone,
    html: `
      <div class="weekly-mileage-item">
        <div class="weekly-mileage-label">${formatDayLabel(startDate)} - ${formatDayLabel(endDate)}</div>
        <div class="weekly-mileage-value">${total.toFixed(1)} km</div>
        <div class="weekly-mileage-status">${status}</div>
        <div class="mini-progress"><div class="mini-progress-fill" style="width:${percent}%"></div></div>
      </div>`,
  };
}

function activityKey(activity) {
  return `${activity.date}|${activity.type}|${activity.distance}|${activity.duration}`;
}


function mergeActivities(incoming, existing) {
  const byKey = new Map();
  [...incoming, ...existing].forEach((activity) => {
    const key = `${activity.date}|${activity.type}|${activity.distance}|${activity.duration}`;
    byKey.set(key, activity);
  });
  return [...byKey.values()]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 300);
}

function normalizeActivity(raw) {
  const date = normalizeDate(raw.date) || todayIso();
  const distance = normalizeNumber(raw.distance || raw.distance_km || 0);
  const duration = normalizeDuration(raw.duration || raw.duration_min || 0);
  const type = normalizeType(raw.type || "easy");
  const avgHr = normalizeNumber(raw.avgHr || raw.avg_hr || raw.heartrate || 0);
  const elevation = normalizeNumber(raw.elevation || raw.elevation_m || 0);
  const rpe = normalizeNumber(raw.rpe || 5) || 5;
  const restingHr = normalizeNumber(raw.restingHr || raw.resting_hr || 0);
  const cadence = normalizeNumber(raw.cadence || raw.cadence_spm || raw["cadence_(spm)"] || 0);
  const groundTime = normalizeNumber(raw.groundTime || raw.ground_time || raw["ground_time_(ms)"] || 0);
  const verticalOscillation = normalizeNumber(raw.verticalOscillation || raw.vertical_oscillation || raw["vertical_oscillation_(cm)"] || 0);
  const notes = String(raw.notes || "").trim();
  const paceSeconds = distance > 0 ? Math.round((duration * 60) / distance) : 0;
  const trainingLoad = Math.round(distance * rpe + duration * 0.35);

  return {
    date,
    type,
    distance,
    duration,
    avgHr,
    elevation,
    rpe,
    restingHr,
    cadence,
    groundTime,
    verticalOscillation,
    notes,
    trainingLoad,
    pace: paceSeconds ? formatPace(paceSeconds) : "-",
  };
}

function parseCsv(text, sourceName = "") {
  const trimmed = text.trim();
  if (!trimmed) return { activities: [], message: "空白檔案" };

  const [headerLine, ...lines] = trimmed.split(/\r?\n/);
  const headers = splitCsvLine(headerLine).map((header) => normalizeHeader(header));

  if (isSensorStreamFormat(headers)) {
    const activity = summarizeSensorCsv(headers, lines, sourceName);
    return {
      activities: activity ? [activity] : [],
      message: activity ? "已按感測器原始檔匯總為 1 次活動" : "未能整理出有效活動",
    };
  }

  const activities = lines
    .filter((line) => line.trim())
    .map((line) => {
      const values = splitCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      return normalizeActivity(row);
    })
    .filter((activity) => activity.date && activity.duration > 0);

  return {
    activities,
    message: activities.length ? `已讀取 ${activities.length} 筆活動` : "檔案格式已讀取，但未找到有效活動列",
  };
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function isSensorStreamFormat(headers) {
  return headers.includes("timestamp") &&
    (headers.includes("watch_distance_(meters)") || headers.includes("stryd_distance_(meters)")) &&
    headers.includes("heart_rate_(bpm)");
}

function summarizeSensorCsv(headers, lines, sourceName) {
  const rows = lines
    .filter((line) => line.trim())
    .map((line) => {
      const values = splitCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    });

  if (!rows.length) return null;

  const timestamps = rows.map((row) => Number(row.timestamp)).filter((value) => Number.isFinite(value) && value > 0);
  if (!timestamps.length) return null;

  const distanceMeters = maxNumber(rows, ["watch_distance_(meters)", "stryd_distance_(meters)"]);
  const distance = distanceMeters / 1000;
  const duration = Math.max(1, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 60));
  const avgHr = average(rows.map((row) => Number(row["heart_rate_(bpm)"] || 0)).filter((value) => value > 0));
  const elevationGain = estimateElevationGain(rows, ["watch_elevation_(m)", "stryd_elevation_(m)"]);
  const cadence = average(rows.map((row) => Number(row["cadence_(spm)"] || 0)).filter((value) => value > 0));
  const groundTime = average(rows.map((row) => Number(row["ground_time_(ms)"] || 0)).filter((value) => value > 0));
  const verticalOscillation = average(rows.map((row) => Number(row["vertical_oscillation_(cm)"] || 0)).filter((value) => value > 0));
  const paceSeconds = distance > 0 ? Math.round((duration * 60) / distance) : 0;
  const type = inferTypeFromPace(paceSeconds, distance, sourceName);
  const rpe = inferRpe(type, avgHr, duration);

  return normalizeActivity({
    date: unixToLocalDate(timestamps[0]),
    type,
    distance,
    duration,
    avgHr: Math.round(avgHr || 0),
    elevation: Math.round(elevationGain),
    rpe,
    cadence: Math.round(cadence || 0),
    groundTime: Math.round(groundTime || 0),
    verticalOscillation: Number(verticalOscillation || 0).toFixed(1),
    notes: buildSensorNotes(sourceName, cadence, rows.length),
  });
}

function maxNumber(rows, keys) {
  let max = 0;
  rows.forEach((row) => {
    keys.forEach((key) => {
      const value = Number(row[key] || 0);
      if (Number.isFinite(value) && value > max) max = value;
    });
  });
  return max;
}

function estimateElevationGain(rows, keys) {
  let gain = 0;
  let previous = null;
  rows.forEach((row) => {
    const current = firstFinite(keys.map((key) => Number(row[key] || 0)));
    if (!Number.isFinite(current)) return;
    if (previous !== null && current > previous) gain += current - previous;
    previous = current;
  });
  return gain;
}

function firstFinite(values) {
  return values.find((value) => Number.isFinite(value));
}

function inferTypeFromPace(paceSeconds, distance, sourceName) {
  const name = String(sourceName || "").toLowerCase();
  if (name.includes("race")) return "race";
  if (distance >= 18) return "long";
  if (paceSeconds > 0 && paceSeconds < 300 && distance >= 6) return "tempo";
  if (distance <= 4 && paceSeconds > 0 && paceSeconds < 330) return "interval";
  return "easy";
}

function inferRpe(type, avgHr, duration) {
  let rpe =
    type === "race" ? 9 :
    type === "tempo" ? 7 :
    type === "interval" ? 8 :
    type === "long" ? 7 :
    5;
  if (avgHr >= 170) rpe += 1;
  if (duration >= 100) rpe += 1;
  return clamp(rpe, 3, 10);
}

function buildSensorNotes(sourceName, cadence, samples) {
  const parts = ["由感測器原始 CSV 自動彙總"];
  if (sourceName) parts.push(`來源 ${sourceName}`);
  if (cadence) parts.push(`平均步頻 ${Math.round(cadence)} spm`);
  if (samples) parts.push(`${samples} 秒樣本`);
  return parts.join("，");
}

function unixToLocalDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString("en-CA");
}

function normalizeType(type) {
  const value = String(type).toLowerCase();
  if (value.includes("interval")) return "interval";
  if (value.includes("tempo")) return "tempo";
  if (value.includes("long")) return "long";
  if (value.includes("recover")) return "recovery";
  if (value.includes("cross") || value.includes("bike") || value.includes("gym")) return "cross";
  if (value.includes("race")) return "race";
  return "easy";
}

function renderAll() {
  renderWeather();
  renderActivities();
  renderFitness();
  renderAiCoach();
  updateHeadlines();
}

function updateHeadlines() {
  document.querySelector("#headlineGoal").textContent = describeGoal(state.profile);
  document.querySelector("#headlineInsight").textContent = state.fitness?.readiness || state.lastInsight || "未有活動";
}

function describeGoal(profile) {
  const goalName = {
    "5k": "5K",
    "10k": "10K",
    half: "半馬",
    marathon: "全馬",
    base: "打底期",
  }[profile.goal];

  const dateText = profile.raceDate ? formatDayLabel(profile.raceDate) : "未定日期";
  const targetTimeText = profile.targetTime ? `完賽時間 ${profile.targetTime}` : "未定時間";
  const targetPaceText = profile.targetPace ? `目標配速 ${profile.targetPace}` : "";
  return `${goalName} · ${dateText} · ${targetTimeText}${targetPaceText ? ` · ${targetPaceText}` : ""}`;
}

function abilityLabelForGoal(goal) {
  return {
    "5k": "5K",
    "10k": "10K",
    half: "半馬",
    marathon: "全馬",
    base: "打底",
  }[goal] || "能力";
}

function targetPaceFromProfile(profile) {
  if (profile.targetPace) {
    const parsed = parsePaceToSeconds(profile.targetPace);
    if (parsed) return parsed;
  }
  const distance = distanceGoalKm(profile.goal);
  const targetSeconds = timeStringToSeconds(profile.targetTime);
  if (!distance || !targetSeconds) return 0;
  return Math.round(targetSeconds / distance);
}

function parsePaceToSeconds(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function distanceGoalKm(goal) {
  return {
    "5k": 5,
    "10k": 10,
    half: 21.1,
    marathon: 42.2,
    base: 0,
  }[goal];
}

function buildFallbackDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      day: date.toLocaleDateString("en-CA"),
      best: { hour: index % 2 === 0 ? 7 : 18, probability: 25, precipitation: 0.1, temperature: 18 },
      isDry: true,
      score: 72,
    };
  });
}

function normalizeDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA");
}

function normalizeDuration(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) {
    const [hours, minutes, seconds] = text.split(":").map(Number);
    return Math.round(hours * 60 + minutes + seconds / 60);
  }
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [minutes, seconds] = text.split(":").map(Number);
    return Math.round(minutes + seconds / 60);
  }
  return Number(text.replace(/[^\d.]/g, "")) || 0;
}

function normalizeNumber(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  return Number(cleaned) || 0;
}

function formatDayLabel(day) {
  return new Date(day).toLocaleDateString("zh-HK", { month: "short", day: "numeric" });
}

function weekdayName(day) {
  return new Date(day).toLocaleDateString("en-GB", { weekday: "long" });
}

function formatPace(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function toPaceSeconds(pace) {
  if (!pace || !pace.includes(":")) return 0;
  const [mins, rest] = pace.split(":");
  return Number(mins) * 60 + Number(rest.split("/")[0]);
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

function daysBetween(dateA, dateB) {
  const diff = new Date(dateB).getTime() - new Date(dateA).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function daysUntil(date) {
  return daysBetween(todayIso(), date);
}

function timeStringToSeconds(value) {
  if (!value) return 0;
  const parts = String(value).trim().split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 2) {
    const [hours, minutes] = parts;
    return (hours * 60 + minutes) * 60;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values) {
  return values.length ? sum(values) / values.length : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}
