const API_BASE = "https://ai-diary.3177981404.workers.dev";

const TODAY = getTodayStr();
let currentDate = TODAY;
let diaryCache = {};
let diaryDates = [];
let diaryListData = [];
let loadAbort = null;
let apiAvailable = true;
let contribYear;

const diaryTitle = document.getElementById("diaryTitle");
const diaryDate = document.getElementById("diaryDate");
const diaryModel = document.getElementById("diaryModel");
const diaryContent = document.getElementById("diaryContent");
const diaryFooter = document.getElementById("diaryFooter");
const sourceLinks = document.getElementById("sourceLinks");

const searchToggle = document.getElementById("searchToggle");
const searchOverlay = document.getElementById("searchOverlay");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const searchClose = document.getElementById("searchClose");

const prevYear = document.getElementById("prevYear");
const nextYear = document.getElementById("nextYear");
const contribYearInput = document.getElementById("contribYear");
const contribToday = document.getElementById("contribToday");
const contribGrid = document.getElementById("contribGrid");
const contribTooltip = document.getElementById("contribTooltip");

async function loadAllData() {
  try {
    const resp = await fetch(`${API_BASE}/api/diaries`);
    if (resp.ok) {
      const list = await resp.json();
      diaryListData = list;
      diaryDates = list.map(d => d.date).sort().reverse();
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
      diaryListData = diaryDates.map(date => ({
        date,
        title: DIARY_DATA[date]?.title || "",
        snippet: ""
      }));
    }
  }

  const now = new Date();
  contribYear = now.getFullYear();
  contribYearInput.value = contribYear;

  const initialDate = loadFromUrl();
  currentDate = initialDate;
  selectDate(initialDate);
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

function renderContributionGraph(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const startDayOfWeek = startDate.getDay();

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endDate - startDate) / msPerDay) + 1;

  const totalCells = startDayOfWeek + totalDays;
  const totalWeeks = Math.ceil(totalCells / 7);

  const cellDate = new Date(startDate);
  cellDate.setDate(cellDate.getDate() - startDayOfWeek);

  const diarySet = getDiarySet();
  let html = '';

  for (let col = 0; col < totalWeeks; col++) {
    for (let row = 0; row < 7; row++) {
      const y = cellDate.getFullYear();
      const m = String(cellDate.getMonth() + 1).padStart(2, '0');
      const d = String(cellDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const isInYear = y === year;
      const hasDiary = diarySet.has(dateStr);
      const isToday = dateStr === TODAY;

      let cls = 'contrib-cell';
      if (hasDiary) cls += ' has-diary';
      if (!isInYear) cls += ' other-year';
      if (isToday) cls += ' today-cell';

      html += `<div class="${cls}" data-date="${dateStr}"></div>`;

      cellDate.setDate(cellDate.getDate() + 1);
    }
  }

  contribGrid.innerHTML = html;

  contribGrid.querySelectorAll(".contrib-cell").forEach(el => {
    el.addEventListener("click", () => {
      const date = el.dataset.date;
      if (date) selectDate(date);
    });

    el.addEventListener("mouseenter", () => {
      const date = el.dataset.date;
      if (!date) return;
      contribTooltip.textContent = formatDateDisplay(date);
      const rect = el.getBoundingClientRect();
      contribTooltip.style.left = `${rect.left + rect.width / 2}px`;
      contribTooltip.style.top = `${rect.top}px`;
      contribTooltip.style.display = "block";
    });

    el.addEventListener("mouseleave", () => {
      contribTooltip.style.display = "none";
    });
  });
}

prevYear.addEventListener("click", () => {
  contribYear--;
  contribYearInput.value = contribYear;
  renderContributionGraph(contribYear);
});

nextYear.addEventListener("click", () => {
  contribYear++;
  contribYearInput.value = contribYear;
  renderContributionGraph(contribYear);
});

contribYearInput.addEventListener("change", () => {
  let val = parseInt(contribYearInput.value);
  if (isNaN(val) || val < 2020) val = 2020;
  if (val > 2030) val = 2030;
  contribYear = val;
  contribYearInput.value = contribYear;
  renderContributionGraph(contribYear);
});

contribToday.addEventListener("click", () => {
  const now = new Date();
  contribYear = now.getFullYear();
  contribYearInput.value = contribYear;
  renderContributionGraph(contribYear);
  selectDate(TODAY);
});

async function selectDate(dateStr) {
  currentDate = dateStr;
  renderContributionGraph(contribYear);
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

let gitalkInited = false;

function initGitalk() {
  if (gitalkInited) return;
  gitalkInited = true;

  const container = document.getElementById("gitalk-container");
  if (!container || typeof Gitalk === "undefined") return;

  const gitalk = new Gitalk({
    clientID: "Ov23liyavngWcJn8VouQ",
    clientSecret: "b59e443b2a31b40e8edac41c18ffb8f7c1e70831",
    repo: "ai-diary",
    owner: "tianzhanda",
    admin: ["tianzhanda"],
    id: "ai-diary-comments",
    distractionFreeMode: false,
    language: "zh-CN",
  });
  gitalk.render("gitalk-container");

  setTimeout(() => {
    document.querySelector(".gt-container")?.addEventListener("click", (e) => {
      const likeBtn = e.target.closest(".gt-comment-like");
      if (!likeBtn || likeBtn.dataset.gtDebounce) return;
      likeBtn.dataset.gtDebounce = "1";
      likeBtn.style.pointerEvents = "none";
      likeBtn.style.opacity = "0.5";
      setTimeout(() => {
        delete likeBtn.dataset.gtDebounce;
        likeBtn.style.pointerEvents = "";
        likeBtn.style.opacity = "";
      }, 800);
    });
  }, 1500);
}

function openSearch() {
  searchOverlay.classList.add("active");
  setTimeout(() => searchInput.focus(), 100);
}

function closeSearch() {
  searchOverlay.classList.remove("active");
  searchInput.value = "";
  searchResults.innerHTML = "";
}

searchToggle.addEventListener("click", openSearch);

searchClose.addEventListener("click", closeSearch);

searchOverlay.addEventListener("click", (e) => {
  if (e.target === searchOverlay) closeSearch();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && searchOverlay.classList.contains("active")) {
    closeSearch();
  }
  if (((e.metaKey || e.ctrlKey) && e.key === "k") && !searchOverlay.classList.contains("active")) {
    e.preventDefault();
    openSearch();
  }
  if (e.key === "/" && !searchOverlay.classList.contains("active") &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
    e.preventDefault();
    openSearch();
  }
});

searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  if (query.length < 1) {
    searchResults.innerHTML = "";
    return;
  }

  const results = [];
  const seen = new Set();

  for (const item of diaryListData) {
    const searchText = (item.title + " " + item.snippet).toLowerCase();
    if (searchText.includes(query)) {
      seen.add(item.date);
      results.push({ date: item.date, title: item.title, snippet: item.snippet });
    }
  }

  for (const [date, diary] of Object.entries(diaryCache)) {
    if (seen.has(date)) continue;
    const searchText = (diary.title + " " + stripHtml(diary.content)).toLowerCase();
    if (searchText.includes(query)) {
      results.push({ date, title: diary.title, snippet: stripHtml(diary.content).substring(0, 80) });
    }
  }

  if (results.length === 0) {
    searchResults.innerHTML = `<div class="search-empty">没有找到匹配的日记</div>`;
    return;
  }

  searchResults.innerHTML = results.slice(0, 20).map(r => `
    <div class="search-result-item" data-date="${r.date}">
      <div class="search-result-date">${r.date}</div>
      <div class="search-result-title">${r.title}</div>
      ${r.snippet ? `<div class="search-result-snippet">${r.snippet}...</div>` : ""}
    </div>
  `).join("");

  searchResults.querySelectorAll(".search-result-item").forEach(el => {
    el.addEventListener("click", () => {
      selectDate(el.dataset.date);
      closeSearch();
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

loadAllData();
