export function setupSwipe(element, { onSwipeLeft, onSwipeRight }) {
  if (typeof Hammer === "undefined") return

  const mc = new Hammer(element)
  mc.get("swipe").set({ direction: Hammer.DIRECTION_HORIZONTAL })

  mc.on("swipeleft", () => onSwipeLeft())
  mc.on("swiperight", () => onSwipeRight())
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
