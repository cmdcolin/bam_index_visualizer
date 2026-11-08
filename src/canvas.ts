export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const dpr = globalThis.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx?.clearRect(0, 0, width, height)
  return ctx
}
