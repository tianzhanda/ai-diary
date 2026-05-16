const API_BASE = "https://ai-diary.3177981404.workers.dev";

const TODAY = getTodayStr();
let currentDate = TODAY;
let diaryCache = {};
let diaryDates = [];
let diaryListData = [];
let loadAbort = null;
let apiAvailable = true;
let insightYear;

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
const insightYearInput = document.getElementById("insightYear");
const insightGrid = document.getElementById("insightGrid");
const insightMonths = document.getElementById("insightMonths");
const insightStats = document.getElementById("insightStats");
const insightTooltip = document.getElementById("insightTooltip");
const insightScroll = document.getElementById("insightScroll");

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
  insightYear = now.getFullYear();
  insightYearInput.value = insightYear;

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

  const msPerDay = 86400000;
  const totalDays = Math.round((endDate - startDate) / msPerDay) + 1;
  const totalCells = startDayOfWeek + totalDays;
  const totalWeeks = Math.ceil(totalCells / 7);

  const cellDate = new Date(startDate);
  cellDate.setDate(cellDate.getDate() - startDayOfWeek);

  const now = new Date();
  const ms30 = 30 * msPerDay;
  const ms7 = 7 * msPerDay;

  const diarySet = getDiarySet();
  let diaryCount = 0;
  let gridHtml = '';

  for (let col = 0; col < totalWeeks; col++) {
    for (let row = 0; row < 7; row++) {
      const y = cellDate.getFullYear();
      const m = String(cellDate.getMonth() + 1).padStart(2, '0');
      const d = String(cellDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const isInYear = y === year;
      const hasDiary = diarySet.has(dateStr);
      const isToday = dateStr === TODAY;

      let cls = 'insight-cell';
      if (isToday) cls += ' today-cell';
      if (!isInYear) { cls += ' other-year'; }
      else if (hasDiary) {
        diaryCount++;
        const age = now.getTime() - cellDate.getTime();
        if (age < ms7) cls += ' has-diary l3';
        else if (age < ms30) cls += ' has-diary l2';
        else cls += ' has-diary l1';
      }

      gridHtml += `<div class="${cls}" data-date="${dateStr}"></div>`;
      cellDate.setDate(cellDate.getDate() + 1);
    }
  }

  insightGrid.innerHTML = gridHtml;

  insightGrid.querySelectorAll(".insight-cell").forEach(el => {
    el.addEventListener("click", () => {
      const date = el.dataset.date;
      if (date) selectDate(date);
    });

    el.addEventListener("mouseenter", () => {
      const date = el.dataset.date;
      if (!date) return;
      insightTooltip.textContent = formatDateDisplay(date);
      const rect = el.getBoundingClientRect();
      insightTooltip.style.left = `${rect.left + rect.width / 2}px`;
      insightTooltip.style.top = `${rect.top}px`;
      insightTooltip.style.display = "block";
    });

    el.addEventListener("mouseleave", () => {
      insightTooltip.style.display = "none";
    });
  });

  renderMonthLabels(year, startDayOfWeek, totalWeeks);
  insightStats.innerHTML = `已记录 <strong>${diaryDates.length}</strong> 天`;
}

function renderMonthLabels(year, startDayOfWeek, totalWeeks) {
  const startDate = new Date(year, 0, 1);
  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  const positions = [];
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const dayOfYear = Math.round((firstDay - startDate) / 86400000);
    const col = Math.floor((startDayOfWeek + dayOfYear) / 7);
    if (positions.length === 0 || col > positions[positions.length - 1].col) {
      positions.push({ col, label: monthNames[m] });
    }
  }

  const cellW = 17;
  let html = '';
  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i];
    const nextCol = positions[i + 1] ? positions[i + 1].col : totalWeeks;
    const width = (nextCol - cur.col) * cellW - 3;
    html += `<span style="width:${width}px">${cur.label}</span>`;
  }
  insightMonths.innerHTML = html;
}

window.addEventListener("scroll", () => {
  insightTooltip.style.display = "none";
}, { passive: true });

function switchInsightYear(year, direction) {
  let val = year;
  if (isNaN(val) || val < 2020) val = 2020;
  if (val > 2030) val = 2030;
  insightYear = val;
  insightYearInput.value = insightYear;
  renderContributionGraph(insightYear);
  renderMilestones(insightYear, direction);
}

prevYear.addEventListener("click", () => {
  switchInsightYear(insightYear - 1);
});

nextYear.addEventListener("click", () => {
  switchInsightYear(insightYear + 1);
});

insightYearInput.addEventListener("change", () => {
  switchInsightYear(parseInt(insightYearInput.value));
});

insightScroll.addEventListener("wheel", (e) => {
  insightScroll.scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });

async function selectDate(dateStr) {
  currentDate = dateStr;
  renderContributionGraph(insightYear);
  renderMilestones(insightYear);
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

  if (diaryListData.length === 0 && Object.keys(diaryCache).length === 0) {
    searchResults.innerHTML = `<div class="search-empty">正在加载搜索索引...</div>`;
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
  themeToggle.innerHTML = theme === "dark"
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
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

/* ============ MILESTONE TIMELINE ============ */

var milestoneTrackEl, milestoneInnerEl, milestoneItems, milestoneAnimating = false, milestonePending = null, milestoneIndex = -1;

function getAdjacentYear(year, dir) {
  var allYears = [...new Set(MILESTONES.map(function(m) { return m.year; }))].sort();
  var idx = allYears.indexOf(year);
  if (dir === 'prev' && idx > 0) return allYears[idx - 1];
  if (dir === 'next' && idx < allYears.length - 1) return allYears[idx + 1];
  return null;
}

function renderMilestones(year, direction) {
  var emptyEl = document.getElementById('insightEmptyState');
  var track = document.getElementById('insightMilestoneTrack');
  var inner = document.getElementById('insightMilestoneInner');

  if (typeof MILESTONES === 'undefined' || !MILESTONES || MILESTONES.length === 0) {
    track.style.display = 'none';
    return;
  }
  track.style.display = '';

  milestoneTrackEl = track;
  milestoneInnerEl = inner;

  var filtered = year ? MILESTONES.filter(function(m) { return m.year === year; }) : MILESTONES;

  if (filtered.length === 0) {
    inner.innerHTML = '';
    emptyEl.classList.add('visible');
    milestoneItems = [];
    milestoneIndex = -1;
    return;
  }
  emptyEl.classList.remove('visible');

  var html = '';
  var lastYear = null;
  filtered.forEach(function(m, i) {
    if (lastYear !== null && m.year !== lastYear) {
      html += '<div class="insight-milestone-year-mark"><div class="insight-milestone-year-bar"></div><span class="insight-milestone-year-label">' + lastYear + '</span></div>';
    }
    lastYear = m.year;
    html += '<div class="insight-milestone-item" data-index="' + i + '"><span class="insight-milestone-item-label">' + m.title + '</span><div class="insight-milestone-dot-wrap"><div class="insight-milestone-dot"></div><span class="insight-milestone-item-date">' + m.month + '月' + m.day + '日</span></div></div>';
  });
  if (lastYear !== null) {
    html += '<div class="insight-milestone-year-mark"><div class="insight-milestone-year-bar"></div><span class="insight-milestone-year-label">' + lastYear + '</span></div>';
  }
  inner.innerHTML = html;

  milestoneItems = inner.querySelectorAll('.insight-milestone-item');

  if (direction === 'prev') milestoneIndex = milestoneItems.length - 1;
  else if (direction === 'next') milestoneIndex = 0;
  else milestoneIndex = milestoneItems.length - 1;

  snapTo(milestoneIndex, false);
}

function getMilestoneOffsets() {
  var offsets = [];
  var trackRect = milestoneTrackEl.getBoundingClientRect();
  var trackCenter = trackRect.left + trackRect.width / 2;
  milestoneItems.forEach(function(item) {
    var rect = item.getBoundingClientRect();
    offsets.push(rect.left + rect.width / 2 - trackCenter);
  });
  return offsets;
}

function snapTo(index, animate) {
  if (!milestoneItems || index < 0 || index >= milestoneItems.length) return;
  if (animate === undefined) animate = true;
  if (animate && milestoneAnimating) {
    milestonePending = index;
    return;
  }
  milestoneIndex = index;
  milestonePending = null;
  var offsets = getMilestoneOffsets();
  var target = -(offsets[milestoneIndex]);

  milestoneItems.forEach(function(item, i) {
    if (i === milestoneIndex) item.classList.add('active');
    else item.classList.remove('active');
  });

  if (!animate) {
    milestoneInnerEl.style.transform = 'translateX(' + target + 'px)';
    return;
  }

  milestoneAnimating = true;
  var current = milestoneInnerEl.style.transform;
  var start = 0;
  if (current && current.indexOf('translateX') >= 0) {
    start = parseFloat(current.replace('translateX(', '').replace('px)', '')) || 0;
  }
  var diff = target - start;
  if (Math.abs(diff) < 0.5) {
    milestoneAnimating = false;
    if (milestonePending !== null) snapTo(milestonePending, true);
    return;
  }

  var duration = 420;
  var startTime = performance.now();

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function step(now) {
    var elapsed = now - startTime;
    var t = Math.min(elapsed / duration, 1);
    var eased = easeOutQuart(t);
    milestoneInnerEl.style.transform = 'translateX(' + (start + diff * eased) + 'px)';
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      milestoneInnerEl.style.transform = 'translateX(' + target + 'px)';
      milestoneAnimating = false;
      if (milestonePending !== null) snapTo(milestonePending, true);
    }
  }
  requestAnimationFrame(step);
}

function milestoneEdgeReached(dir) {
  if (!milestoneItems || milestoneItems.length === 0) return;
  if (dir === 'next' && milestoneIndex >= milestoneItems.length - 1) {
    var nextY = getAdjacentYear(insightYear, 'next');
    if (nextY !== null) { switchInsightYear(nextY, 'next'); return true; }
  }
  if (dir === 'prev' && milestoneIndex <= 0) {
    var prevY = getAdjacentYear(insightYear, 'prev');
    if (prevY !== null) { switchInsightYear(prevY, 'prev'); return true; }
  }
  return false;
}

function handleMilestoneWheel(e) {
  if (milestoneAnimating) { e.preventDefault(); return; }
  if (!milestoneItems || milestoneItems.length === 0) return;
  e.preventDefault();
  if (e.deltaY > 0) {
    if (milestoneIndex < milestoneItems.length - 1) snapTo(milestoneIndex + 1);
    else milestoneEdgeReached('next');
  } else {
    if (milestoneIndex > 0) snapTo(milestoneIndex - 1);
    else milestoneEdgeReached('prev');
  }
}

function handleMilestoneKeydown(e) {
  if (!milestoneItems || milestoneItems.length === 0) return;
  if (e.key === 'ArrowRight') {
    if (milestoneIndex < milestoneItems.length - 1) snapTo(milestoneIndex + 1);
    else milestoneEdgeReached('next');
  }
  if (e.key === 'ArrowLeft') {
    if (milestoneIndex > 0) snapTo(milestoneIndex - 1);
    else milestoneEdgeReached('prev');
  }
}

// Milestone wheel event
document.getElementById('insightMilestoneTrack').addEventListener('wheel', handleMilestoneWheel, { passive: false });

// Milestone touch events
var msTouchX = 0, msTouchY = 0, msSwiping = false;
document.getElementById('insightMilestoneTrack').addEventListener('touchstart', function(e) {
  msTouchX = e.touches[0].clientX;
  msTouchY = e.touches[0].clientY;
  msSwiping = false;
}, { passive: true });
document.getElementById('insightMilestoneTrack').addEventListener('touchmove', function(e) {
  var dx = e.touches[0].clientX - msTouchX;
  var dy = e.touches[0].clientY - msTouchY;
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) msSwiping = true;
}, { passive: true });
document.getElementById('insightMilestoneTrack').addEventListener('touchend', function(e) {
  if (!msSwiping) return;
  var dx = e.changedTouches[0].clientX - msTouchX;
  if (Math.abs(dx) > 30) {
    if (dx < 0) {
      if (milestoneIndex < milestoneItems.length - 1) snapTo(milestoneIndex + 1);
      else milestoneEdgeReached('next');
    } else {
      if (milestoneIndex > 0) snapTo(milestoneIndex - 1);
      else milestoneEdgeReached('prev');
    }
  }
}, { passive: true });

// Milestone keyboard events
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // Only if not in search overlay
    if (searchOverlay.classList.contains('active')) return;
    handleMilestoneKeydown(e);
  }
});

// Milestone resize handler
var msResizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(msResizeTimer);
  msResizeTimer = setTimeout(function() {
    if (milestoneIndex >= 0) snapTo(milestoneIndex, false);
  }, 100);
});

insightYear = new Date().getFullYear();
renderMilestones(insightYear);
loadAllData();
