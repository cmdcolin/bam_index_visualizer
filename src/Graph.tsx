import { useRef, useState, useEffect, useMemo } from 'react'
import { max, sum, fmt, fmt2 } from './util'
import type { BAI } from '@gmod/bam'

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  screen: number,
  cb: (arg: number) => string,
  size: number,
) {
  if (x + width < 0 || x > screen) {
    return
  }
  ctx.fillStyle = cb(size)
  ctx.fillRect(x, y, width, height)
}

function drawRow({
  size,
  bins,
  curr,
  yunit,
  width,
  row,
  cb,
  ctx,
  scale,
  offset,
}: {
  size: number
  bins: Record<string, number>
  curr: number
  row: number
  yunit: number
  width: number
  cb: (arg: number) => string
  ctx: CanvasRenderingContext2D
  scale: number
  offset: number
}) {
  const xunit = (width / size) * scale
  const xmin = Math.max(1, xunit)
  ctx.strokeStyle = `rgb(0,0,0,0.3)`
  let lastDrawn = Number.NEGATIVE_INFINITY
  for (let i = 0; i < size; i++) {
    const px = Math.floor(xunit * i)
    if (px !== lastDrawn) {
      ctx.strokeRect(xunit * i - offset, yunit * row, xmin, yunit)
      lastDrawn = px
    }
  }
  for (let i = 0; i < size; i++, curr++) {
    const totalBinSize = bins[curr]
    if (totalBinSize) {
      fillRect(
        ctx,
        xunit * i - offset,
        yunit * row,
        xmin,
        yunit,
        width,
        cb,
        totalBinSize,
      )
    }
  }
}

export default function Graph({
  bai,
  maxVal,
  setCurrPos,
}: {
  bai: NonNullable<ReturnType<Awaited<ReturnType<BAI['parse']>>['indices']>>
  maxVal: string
  setCurrPos: (arg: [number, number]) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [mouseDown, setMouseDown] = useState<number>()
  const [mouseCurrent, setMouseCurrent] = useState<number>()
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState(0)
  const [width, setWidth] = useState(0)

  const c = 2 ** 29 / scale

  const sizes = useMemo(() => {
    const result: Record<string, number> = {}
    for (const key of Object.keys(bai.binIndex)) {
      const val = bai.binIndex[+key]
      if (val) {
        result[key] = sum(val.map(f => f.fetchedSize()))
      }
    }
    return result
  }, [bai])

  useEffect(() => {
    setCurrPos([
      Math.max(0, (offset / width) * c),
      Math.max(0, ((offset + width) / width) * c),
    ])
  }, [setCurrPos, offset, width, c])

  useEffect(() => {
    if (mouseDown) {
      function onMouseUp(event: MouseEvent) {
        if (!mouseDown) {
          return
        }
        const canvas = ref.current
        if (!canvas) {
          return
        }

        const { width, left } = canvas.getBoundingClientRect()
        const minX = Math.min(mouseDown, event.clientX) - left
        const selW = Math.abs(mouseDown - event.clientX)
        const newScale = scale * (width / selW)
        const newOffset = (offset + minX) * (newScale / scale)
        setOffset(newOffset)
        setScale(newScale)
        setMouseCurrent(undefined)
        setMouseDown(undefined)
      }
      function onMouseMove(event: MouseEvent) {
        setMouseCurrent(event.clientX)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
    }
  }, [mouseDown, scale, offset])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height

    const yunit = height / 6
    ctx.clearRect(0, 0, width, height)
    const scalar = maxVal === '' ? max(Object.values(sizes)) : +maxVal
    const cb = (f: number) =>
      `hsl(${Math.min((f / scalar) * 200, 200)},50%,50%)`

    let curr = 0
    drawRow({
      size: 1,
      row: 0,
      bins: sizes,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })
    curr += 1
    drawRow({
      size: 8,
      row: 1,
      bins: sizes,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })
    curr += 8
    drawRow({
      size: 64,
      row: 2,
      bins: sizes,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })
    curr += 64
    drawRow({
      size: 512,
      row: 3,
      bins: sizes,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })
    curr += 512
    drawRow({
      size: 4096,
      row: 4,
      bins: sizes,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })
    curr += 4096
    drawRow({
      size: 32_767,
      row: 5,
      bins: sizes,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })

    const gradient = ctx.createLinearGradient(0, 0, 0, 75)
    gradient.addColorStop(0, 'hsl(200,50%,50%)')
    gradient.addColorStop(1 / 5, 'hsl(160,50%,50%)')
    gradient.addColorStop(2 / 5, 'hsl(120,50%,50%)')
    gradient.addColorStop(3 / 5, 'hsl(80,50%,50%)')
    gradient.addColorStop(4 / 5, 'hsl(40,50%,50%)')
    gradient.addColorStop(1, 'hsl(0,50%,50%)')

    ctx.fillStyle = gradient
    ctx.fillRect(width - 10, 0, 10, 75)
    ctx.strokeRect(width - 10, 0, 10, 75)
    ctx.fillStyle = 'black'
    const str0 = `0`
    const str1 = fmt(scalar, 0)
    const res0 = ctx.measureText(str0)
    const res1 = ctx.measureText(str1)
    ctx.fillText(str1, width - 10 - res1.width, 10)
    ctx.fillText(str0, width - 10 - res0.width, 75)
  }, [maxVal, scale, offset, sizes])
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }

    const { width } = canvas.getBoundingClientRect()
    setWidth(width)
  }, [])

  return (
    <div>
      <button
        onClick={() => {
          setScale(1)
          setOffset(0)
        }}
      >
        Reset zoom
      </button>
      <button
        onClick={() => {
          const oldScale = scale
          const newScale = scale * 1.5

          const canvas = ref.current
          if (!canvas) {
            return
          }
          const w2 = canvas.getBoundingClientRect().width / 2
          const newOffset = ((offset + w2) * newScale) / oldScale - w2
          setOffset(newOffset)
          setScale(newScale)
        }}
      >
        Zoom in
      </button>
      <button
        onClick={() => {
          const oldScale = scale
          const newScale = scale / 1.5

          const canvas = ref.current
          if (!canvas) {
            return
          }
          const w2 = canvas.getBoundingClientRect().width / 2
          const newOffset = ((offset + w2) * newScale) / oldScale - w2
          setOffset(newOffset)
          setScale(newScale)
        }}
      >
        Zoom out
      </button>
      <div style={{ textAlign: 'center' }}>
        {fmt2(2 ** 29 / scale)} ({fmt2((offset / width) * c)} -{' '}
        {fmt2(((offset + width) / width) * c)})
      </div>
      <div style={{ position: 'relative' }}>
        {mouseCurrent && mouseDown ? (
          <div
            style={{
              height: '100%',
              background: '#99c9',
              zIndex: 10,
              position: 'absolute',
              left: Math.min(mouseDown, mouseCurrent),
              width: Math.abs(mouseDown - mouseCurrent),
            }}
          />
        ) : null}
        <div
          className="rubberband"
          style={{ height: 10, width: '90%' }}
          onMouseDown={event => {
            setMouseDown(event.clientX)
            setMouseCurrent(event.clientX)
          }}
        />
        <canvas
          ref={ref}
          style={{ width: '90%', height: 200 }}
          onWheel={event => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
              setOffset(offset + event.deltaX)
            }
          }}
        />
      </div>
    </div>
  )
}
