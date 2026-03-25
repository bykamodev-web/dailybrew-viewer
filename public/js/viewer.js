let pdfjsLib = null
let currentPage = null
let zoomLevel = 1

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4

export async function initPdfJs() {
  if (pdfjsLib) return

  const module = await import("/vendor/pdf.min.mjs")
  pdfjsLib = module
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs"
}

function calcBaseScale(page, canvas) {
  // Use #viewer-container (the scrollable parent), not #pdf-wrapper
  const container = document.getElementById("viewer-container")
  const vp = page.getViewport({ scale: 1 })
  const scaleByWidth = container.clientWidth / vp.width
  const scaleByHeight = container.clientHeight / vp.height
  return Math.min(scaleByWidth, scaleByHeight)
}

function renderPage(page, canvas, scale) {
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: scale * dpr })

  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${viewport.width / dpr}px`
  canvas.style.height = `${viewport.height / dpr}px`

  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  return page.render({ canvasContext: ctx, viewport }).promise
}

export async function renderPdf(arrayBuffer, canvas) {
  await initPdfJs()

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  currentPage = await pdf.getPage(1)

  zoomLevel = 1
  updateZoomDisplay()

  const baseScale = calcBaseScale(currentPage, canvas)
  await renderPage(currentPage, canvas, baseScale * zoomLevel)
}

export async function renderAtCurrentZoom(canvas) {
  if (!currentPage) return

  const baseScale = calcBaseScale(currentPage, canvas)
  await renderPage(currentPage, canvas, baseScale * zoomLevel)
}

export function zoomIn(canvas) {
  if (zoomLevel >= ZOOM_MAX) return
  zoomLevel = Math.min(zoomLevel + ZOOM_STEP, ZOOM_MAX)
  updateZoomDisplay()
  renderAtCurrentZoom(canvas)
}

export function zoomOut(canvas) {
  if (zoomLevel <= ZOOM_MIN) return
  zoomLevel = Math.max(zoomLevel - ZOOM_STEP, ZOOM_MIN)
  updateZoomDisplay()
  renderAtCurrentZoom(canvas)
}

export function zoomReset(canvas) {
  zoomLevel = 1
  updateZoomDisplay()
  renderAtCurrentZoom(canvas)
}

function updateZoomDisplay() {
  const el = document.getElementById("zoom-level")
  if (el) {
    el.textContent = `${Math.round(zoomLevel * 100)}%`
  }
}
