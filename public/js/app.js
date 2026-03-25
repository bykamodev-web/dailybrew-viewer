import { fetchPapersList, fetchPaperBytes, fetchPaperMeta } from "./api.js"
import { initPdfJs, renderPdf, zoomIn, zoomOut, renderAtCurrentZoom, setZoomLevel, getZoomLevel, setZoomCallback } from "./viewer.js"
import {
  setupSwipe,
  setupPinchZoom,
  setupKeyboard,
  setZoomed,
  getDateFromHash,
  setDateHash,
  onHashChange,
} from "./navigation.js"
import { renderSidebar, fetchLiveMarket } from "./sidebar.js"

const STRINGS = {
  loading: "読み込み中...",
  notFound: "この日の新聞はありません",
  networkError: "接続エラー",
  rateLimited: "しばらくお待ちください",
  retry: "再試行",
}

const canvas = document.getElementById("pdf-canvas")
const loadingEl = document.getElementById("loading")
const errorEl = document.getElementById("error")
const errorMsg = document.getElementById("error-message")
const btnPrev = document.getElementById("btn-prev")
const btnNext = document.getElementById("btn-next")
const btnDate = document.getElementById("btn-date")
const datePicker = document.getElementById("date-picker")
const btnRetry = document.getElementById("btn-retry")
const sidebarEl = document.getElementById("sidebar")

let papers = []
let currentIndex = 0
let isLoading = false
const prefetchCache = new Map()

function showLoading() {
  loadingEl.classList.remove("hidden")
  errorEl.classList.add("hidden")
  canvas.style.opacity = "0.3"
}

function hideLoading() {
  loadingEl.classList.add("hidden")
  canvas.style.opacity = "1"
}

function showError(message) {
  loadingEl.classList.add("hidden")
  errorEl.classList.remove("hidden")
  errorMsg.textContent = message
  canvas.style.opacity = "0"
}

function hideError() {
  errorEl.classList.add("hidden")
}

function updateUI() {
  const date = papers[currentIndex]
  if (!date) return

  const d = new Date(date + "T00:00:00")
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()]
  btnDate.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekday}）`

  btnPrev.disabled = currentIndex >= papers.length - 1
  btnNext.disabled = currentIndex <= 0
}

async function loadPaper(date) {
  if (isLoading) return
  isLoading = true
  showLoading()
  hideError()

  try {
    let bytes = prefetchCache.get(date)
    if (!bytes) {
      bytes = await fetchPaperBytes(date)
    }

    if (!bytes) {
      showError(STRINGS.notFound)
      isLoading = false
      return
    }

    prefetchCache.set(date, bytes)
    await renderPdf(bytes, canvas)
    hideLoading()
    setDateHash(date)
    loadSidebar(date)
    prefetch()
  } catch (err) {
    const message = err.message === "RATE_LIMITED"
      ? STRINGS.rateLimited
      : STRINGS.networkError
    showError(message)
  } finally {
    isLoading = false
  }
}

function prefetch() {
  const prevDate = papers[currentIndex + 1]
  const nextDate = papers[currentIndex - 1]

  for (const date of [prevDate, nextDate]) {
    if (date && !prefetchCache.has(date)) {
      fetchPaperBytes(date)
        .then((bytes) => {
          if (bytes) prefetchCache.set(date, bytes)
        })
        .catch(() => {})
    }
  }
}

async function loadSidebar(date) {
  const [meta, liveMarket] = await Promise.all([
    fetchPaperMeta(date),
    fetchLiveMarket(),
  ])
  renderSidebar(sidebarEl, meta, liveMarket)
}

function goToIndex(index) {
  if (index < 0 || index >= papers.length) return
  currentIndex = index
  updateUI()
  loadPaper(papers[currentIndex])
}

function goNewer() {
  goToIndex(currentIndex - 1)
}

function goOlder() {
  goToIndex(currentIndex + 1)
}

function goToDate(date) {
  const idx = papers.indexOf(date)
  if (idx >= 0) {
    goToIndex(idx)
  } else {
    showError(STRINGS.notFound)
  }
}

async function init() {
  try {
    await initPdfJs()
    papers = await fetchPapersList()

    if (papers.length === 0) {
      showError(STRINGS.notFound)
      return
    }

    const hashDate = getDateFromHash()
    if (hashDate && papers.includes(hashDate)) {
      currentIndex = papers.indexOf(hashDate)
    } else {
      currentIndex = 0
    }

    updateUI()
    await loadPaper(papers[currentIndex])

    // Zoom state callback — disable swipe when zoomed in
    setZoomCallback((isZoomedIn) => setZoomed(isZoomedIn))

    const hammerMc = setupSwipe(document.getElementById("viewer-container"), {
      onSwipeLeft: goNewer,
      onSwipeRight: goOlder,
    })

    // Pinch zoom on mobile
    setupPinchZoom(hammerMc, {
      onZoomChange: (action, value) => {
        if (action === "get") return getZoomLevel()
        setZoomLevel(canvas, value)
      },
    })

    setupKeyboard({
      onPrev: goOlder,
      onNext: goNewer,
    })

    onHashChange(goToDate)

    btnPrev.addEventListener("click", goOlder)
    btnNext.addEventListener("click", goNewer)
    btnRetry.addEventListener("click", () => loadPaper(papers[currentIndex]))

    btnDate.addEventListener("click", () => {
      datePicker.showPicker()
    })

    datePicker.addEventListener("change", (e) => {
      goToDate(e.target.value)
    })
  } catch (err) {
    showError(STRINGS.networkError)
  }
}

// Theme toggle (dark/light)
const btnTheme = document.getElementById("btn-theme")
const savedTheme = localStorage.getItem("db-theme")
if (savedTheme === "light") {
  document.body.classList.add("light")
  btnTheme.textContent = "\u263E"
}

btnTheme.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light")
  btnTheme.textContent = isLight ? "\u263E" : "\u2600"
  localStorage.setItem("db-theme", isLight ? "light" : "dark")
})

// Mobile tab switching
const tabBtns = document.querySelectorAll(".tab-btn")
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")
    if (btn.dataset.tab === "info") {
      document.body.classList.add("show-info")
    } else {
      document.body.classList.remove("show-info")
    }
  })
})

// Zoom controls
document.getElementById("btn-zoom-in").addEventListener("click", () => zoomIn(canvas))
document.getElementById("btn-zoom-out").addEventListener("click", () => zoomOut(canvas))

// Security: disable right-click, print, save shortcuts
document.addEventListener("contextmenu", (e) => e.preventDefault())
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")
  ) {
    e.preventDefault()
  }
})

// Responsive re-render on resize
let resizeTimer = null
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const date = papers[currentIndex]
    if (date && prefetchCache.has(date)) {
      renderPdf(prefetchCache.get(date), canvas)
    }
  }, 200)
})

init()
