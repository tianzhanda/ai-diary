// AI启智录 - 核心逻辑

// ─── API Config ───
const API_BASE = "https://ai-diary.3177981404.workers.dev";

// ─── Giscus Config ───
const GISCUS_REPO = "tianzhanda/tianzhanda.github.io";
const GISCUS_REPO_ID = "R_kgDORbj5Tw";
const GISCUS_CATEGORY = "Announcements";
const GISCUS_CATEGORY_ID = "DIC_kwDORbj5T84C9GAQ";

const TODAY = getTodayStr();
let currentDate = TODAY;
let diaryCache = {};     // { date: diary }
let diaryDates = [];     // ["2026-05-15", ...]

// ─── DOM refs ───
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const todayBtn = document.getElementById("todayBtn");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const diaryTitle = document.getElementById("diaryTitle");
const diaryDate = document.getElementById("diaryDate");
const diaryModel = document.getElementById("diaryModel");
const diaryContent = document.getElementById("diaryContent");
const diaryFooter = document.getElementById("diaryFooter");
const sourceLinks = document.getElementById("sourceLinks");

// ─── Data Loading ───
async function loadAllData() {
  try {
    const resp = await fetch(`${API_BASE}/api/diaries`);
    if (resp.ok) {
      const list = await resp.json();
      diaryDates = list.map(d => d.date).sort().reverse();
      // Preload a few recent diaries
      for (const item of list.slice(0, 5)) {
        try {
          const r = await fetch(`${API_BASE}/api/diary/${item.date}`);
          if (r.ok) diaryCache[item.date] = await r.json();
        } catch(e) {}
      }
    }
  } catch(e) {
    console.warn("API unavailable, using fallback data");
    // Fallback to hardcoded data if available
    if (typeof DIARY_DATA !== 'undefined') {
      diaryDates = Object.keys(DIARY_DATA).sort().reverse();
      diaryCache = DIARY_DATA;
    }
  }

  initCalendar();
  const initialDate = loadFromUrl();
  currentDate = initialDate;
  selectDate(initialDate);
  renderCalendar();
}

async function fetchDiary(dateStr) {
  if (diaryCache[dateStr]) return diaryCache[dateStr];
  try {
    const resp = await fetch(`${API_BASE}/api/diary/${dateStr}`);
    if (resp.ok) {
      const diary = await resp.json();
      diaryCache[dateStr] = diary;
      return diary;
    }
  } catch(e) {}
  return null;
}

// ─── Helpers ───
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const dayOfWeek = new Date(parseInt(y), parseInt(m)-1, parseInt(d)).getDay();
  return `${y}年${parseInt(m)}月${parseInt(d)}日 星期${weekdays[dayOfWeek]}`;
}

function getDiarySet() {
  return new Set(diaryDates);
}

// ─── Calendar ───
let currentYear, currentMonth;

function initCalendar() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
}

function renderCalendar() {
  calendarTitle.textContent = `${currentYear}年${currentMonth + 1}月`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

  const diarySet = getDiarySet();
  let html = "";

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const dateStr = `${prevMonthYear()}-${String(prevMonthNum()).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    html += `<div class="cal-day other-month ${diarySet.has(dateStr) ? 'has-diary' : ''}" data-date="${dateStr}">${day}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === TODAY;
    const isSelected = dateStr === currentDate;
    const hasDiary = diarySet.has(dateStr);
    let cls = isToday ? "today" : "";
    cls += isSelected ? " selected" : "";
    cls += hasDiary ? " has-diary" : "";
    html += `<div class="cal-day ${cls}" data-date="${dateStr}">${d}</div>`;
  }

  // Next month days
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - totalCells % 7) % 7;
  for (let d = 1; d <= remaining; d++) {
    const dateStr = `${nextMonthYear()}-${String(nextMonthNum()).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += `<div class="cal-day other-month ${diarySet.has(dateStr) ? 'has-diary' : ''}" data-date="${dateStr}">${d}</div>`;
  }

  calendarGrid.innerHTML = html;

  // Click handlers
  document.querySelectorAll(".cal-day").forEach(el => {
    el.addEventListener("click", () => {
      const date = el.dataset.date;
      if (date) selectDate(date);
    });
  });

  function prevMonthYear() { return currentMonth === 0 ? currentYear - 1 : currentYear; }
  function prevMonthNum() { return currentMonth === 0 ? 12 : currentMonth; }
  function nextMonthYear() { return currentMonth === 11 ? currentYear + 1 : currentYear; }
  function nextMonthNum() { return currentMonth === 11 ? 1 : currentMonth + 2; }
}

prevMonthBtn.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

todayBtn.addEventListener("click", () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  renderCalendar();
  selectDate(TODAY);
});

// ─── Select date and load diary ───
async function selectDate(dateStr) {
  currentDate = dateStr;
  renderCalendar();
  await loadDiary(dateStr);
  updateGiscus(dateStr);
  updateUrl(dateStr);
}

async function loadDiary(dateStr) {
  const diary = await fetchDiary(dateStr);

  if (!diary) {
    if (diaryTitle) diaryTitle.textContent = "今日无记录";
    if (diaryDate) diaryDate.textContent = formatDateDisplay(dateStr);
    if (diaryContent) diaryContent.innerHTML = `
      <div class="diary-empty">
        <div class="diary-empty-icon">📖</div>
        <h2>这一天的日记尚未生成</h2>
        <p>AI启智录每天23:00更新，届时请再来查看</p>
      </div>`;
    if (diaryFooter) diaryFooter.style.display = "none";
    return;
  }

  if (diaryTitle) diaryTitle.textContent = diary.title;
  if (diaryDate) diaryDate.textContent = formatDateDisplay(dateStr);
  if (diaryModel) diaryModel.textContent = diary.model || "未知";
  if (diaryContent) diaryContent.innerHTML = diary.content;

  if (diary.sources && diary.sources.length > 0) {
    if (sourceLinks) sourceLinks.innerHTML = diary.sources.map(s =>
      `<a href="${s.url}" target="_blank" class="source-link">${s.title}</a>`
    ).join("");
    if (diaryFooter) diaryFooter.style.display = "flex";
  } else {
    if (diaryFooter) diaryFooter.style.display = "none";
  }
}

// ─── Giscus ───
function updateGiscus(dateStr) {
  const container = document.getElementById("giscus-container");
  container.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", GISCUS_REPO);
  script.setAttribute("data-repo-id", GISCUS_REPO_ID);
  script.setAttribute("data-category", GISCUS_CATEGORY);
  script.setAttribute("data-category-id", GISCUS_CATEGORY_ID);
  script.setAttribute("data-mapping", "specific");
  script.setAttribute("data-term", `ai-diary-${dateStr}`);
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("crossorigin", "anonymous");
  script.async = true;

  container.appendChild(script);
}

// ─── Search ───
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  if (query.length < 1) {
    searchResults.innerHTML = "";
    return;
  }

  const results = [];
  for (const [date, diary] of Object.entries(diaryCache)) {
    const searchText = (diary.title + " " + stripHtml(diary.content)).toLowerCase();
    if (searchText.includes(query)) {
      results.push({ date, ...diary });
    }
  }

  if (results.length === 0) {
    searchResults.innerHTML = `<div class="search-empty">没有找到匹配的日记</div>`;
    return;
  }

  searchResults.innerHTML = results.slice(0, 20).map(r => {
    const snippet = stripHtml(r.content).substring(0, 80);
    return `
      <div class="search-result-item" data-date="${r.date}">
        <div class="search-result-date">${r.date}</div>
        <div class="search-result-title">${r.title}</div>
        <div class="search-result-snippet">${snippet}...</div>
      </div>`;
  }).join("");

  document.querySelectorAll(".search-result-item").forEach(el => {
    el.addEventListener("click", () => {
      selectDate(el.dataset.date);
      searchInput.value = "";
      searchResults.innerHTML = "";
    });
  });
});

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// ─── URL sync ───
function updateUrl(dateStr) {
  const url = new URL(window.location);
  url.searchParams.set("date", dateStr);
  window.history.replaceState({ date: dateStr }, "", url);
}

function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");
  if (dateParam && diaryDates.includes(dateParam)) return dateParam;
  if (diaryDates.length > 0 && diaryDates[0] <= TODAY) return diaryDates[0];
  return TODAY;
}

// ─── Theme ───
const themeToggle = document.getElementById("themeToggle");

function getPreferredTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  setGiscusTheme(theme === "dark" ? "dark" : "light");
  localStorage.setItem("theme", theme);
}

function setGiscusTheme(theme) {
  const iframe = document.querySelector("iframe.giscus-frame");
  if (iframe) {
    iframe.contentWindow.postMessage({ giscus: { setConfig: { theme } } }, "https://giscus.app");
  }
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});

window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
  if (!localStorage.getItem("theme")) {
    applyTheme(e.matches ? "light" : "dark");
  }
});

applyTheme(getPreferredTheme());

// ─── Init ───
loadAllData();
