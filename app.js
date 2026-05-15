// AI启智录 - 核心逻辑

// ─── API Config ───
const API_BASE = "https://ai-diary.3177981404.workers.dev";

const TODAY = getTodayStr();
let currentDate = TODAY;
let diaryCache = {};     // { date: diary }
let diaryDates = [];     // ["2026-05-15", ...]
let loadAbort = null;    // AbortController for in-flight diary load
let apiAvailable = true; // Tracks if Cloudflare Worker is reachable

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
    apiAvailable = false;
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
  initGitalk();
}

async function fetchDiary(dateStr, signal) {
  if (diaryCache[dateStr]) return diaryCache[dateStr];
  if (!apiAvailable) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

    const resp = await fetch(`${API_BASE}/api/diary/${dateStr}`, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const diary = await resp.json();
      diaryCache[dateStr] = diary;
      return diary;
    }
  } catch(e) {
    if (e.name === "AbortError") throw e;
    apiAvailable = false;
    console.warn("Fetch diary failed:", dateStr);
  }
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
  showDiaryLoading();
  updateUrl(dateStr);

  if (loadAbort) loadAbort.abort();
  loadAbort = new AbortController();

  try {
    await loadDiary(dateStr, loadAbort.signal);
  } catch(e) {
    if (e.name === "AbortError") return;
    showDiaryError();
  }
}

function showDiaryLoading() {
  if (diaryContent) diaryContent.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner-outer"><div class="spinner-inner"></div></div>
      <p>加载中...</p>
    </div>`;
}

function showDiaryError() {
  if (diaryContent) diaryContent.innerHTML = `
    <div class="diary-empty">
      <div class="diary-empty-icon">⚠️</div>
      <h2>加载失败</h2>
      <p>请求超时或网络异常，请稍后重试</p>
    </div>`;
}

async function loadDiary(dateStr, signal) {
  const diary = await fetchDiary(dateStr, signal);

  if (!diary) {
    if (diaryTitle) diaryTitle.textContent = "今日无记录";
    if (diaryDate) diaryDate.textContent = "----";
    if (diaryModel) diaryModel.textContent = "";
    document.querySelectorAll(".diary-meta .diary-date").forEach(el => el.style.display = "none");
    if (diaryContent) diaryContent.innerHTML = `
      <div class="diary-empty">
        <div class="diary-empty-icon">📖</div>
        <h2>${formatDateDisplay(dateStr)}的日记尚未生成</h2>
        <p>AI启智录每天23:00更新，届时请再来查看</p>
      </div>`;
    if (diaryFooter) diaryFooter.style.display = "none";
    return;
  }

  document.querySelectorAll(".diary-meta .diary-date").forEach(el => el.style.display = "");
  if (diaryTitle) diaryTitle.textContent = diary.title;
  if (diaryDate) diaryDate.textContent = formatDateDisplay(dateStr);
  if (diaryModel) diaryModel.textContent = diary.model || "未知";
  if (diaryContent) diaryContent.innerHTML = renderContent(diary.content);

  if (diary.sources && diary.sources.length > 0) {
    if (sourceLinks) sourceLinks.innerHTML = diary.sources.map(s =>
      `<a href="${s.url}" target="_blank" class="source-link">${s.title}</a>`
    ).join("");
    if (diaryFooter) diaryFooter.style.display = "flex";
  } else {
    if (diaryFooter) diaryFooter.style.display = "none";
  }
}

// ─── Gitalk (site-wide) ───
let gitalkInited = false;

function initGitalk() {
  if (gitalkInited) return;
  gitalkInited = true;

  const container = document.getElementById("gitalk-container");
  if (!container || typeof Gitalk === "undefined") return;

  const gitalk = new Gitalk({
    clientID: "Ov23liLIH2WD13EmHhXG",
    repo: "ai-diary",
    owner: "tianzhanda",
    admin: ["tianzhanda"],
    id: "ai-diary-comments",
    distractionFreeMode: false,
    language: "zh-CN",
  });
  gitalk.render("gitalk-container");
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

function renderContent(content) {
  if (!content) return "";
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  if (typeof marked !== "undefined" && marked.parse) {
    return marked.parse(content);
  }
  return content.split(/\n\n+/).map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join("\n");
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
  localStorage.setItem("theme", theme);
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
