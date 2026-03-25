let hammerInstance = null
let isZoomed = false
let containerEl = null

export function setZoomed(zoomed) {
  isZoomed = zoomed
  if (hammerInstance) {
    hammerInstance.get("swipe").set({ enable: !zoomed })
  }
  // When zoomed, let the browser handle native scroll (pan)
  // When not zoomed, let Hammer handle swipe gestures
  if (containerEl) {
    containerEl.style.touchAction = zoomed ? "pan-x pan-y" : "none"
  }
}

export function setupSwipe(element, { onSwipeLeft, onSwipeRight }) {
  if (typeof Hammer === "undefined") return

  containerEl = element

  hammerInstance = new Hammer.Manager(element, {
    touchAction: "none",
  })

  const swipe = new Hammer.Swipe({ direction: Hammer.DIRECTION_HORIZONTAL })
  const pinch = new Hammer.Pinch()

  hammerInstance.add([pinch, swipe])

  hammerInstance.on("swipeleft", () => {
    if (!isZoomed) onSwipeLeft()
  })
  hammerInstance.on("swiperight", () => {
    if (!isZoomed) onSwipeRight()
  })

  return hammerInstance
}

export function setupPinchZoom(hammerMc, { onZoomChange }) {
  if (!hammerMc) return

  let startZoom = 1

  hammerMc.on("pinchstart", () => {
    startZoom = onZoomChange("get")
  })

  hammerMc.on("pinchmove", (e) => {
    const newZoom = Math.max(0.5, Math.min(4, startZoom * e.scale))
    onZoomChange("set", newZoom)
  })

  hammerMc.on("pinchend", (e) => {
    const newZoom = Math.max(0.5, Math.min(4, startZoom * e.scale))
    onZoomChange("set", newZoom)
  })
}

export function setupKeyboard({ onPrev, onNext }) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      onPrev()
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      onNext()
    }
  })
}

export function getDateFromHash() {
  const hash = window.location.hash.slice(1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) {
    return hash
  }
  return null
}

export function setDateHash(date) {
  window.location.hash = date
}

export function onHashChange(callback) {
  window.addEventListener("hashchange", () => {
    const date = getDateFromHash()
    if (date) {
      callback(date)
    }
  })
}
