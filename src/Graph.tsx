import React, { useRef, useState, useEffect } from 'react'
import { max, sum, colors, fmt } from './util'

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
  bins: any
  curr: number
  row: number
  yunit: number
  width: number
  cb: (arg: number) => string
  ctx: CanvasRenderingContext2D
  scale: number
  offset: number
}) {
  const xunit = (width / size) * scale * 2
  const xmin = Math.max(1, xunit)
  ctx.strokeStyle = `rgb(0,0,0,0.3)`
  let lastDrawn = -Infinity
  // ctx.fillStyle = colors[row]
  // ctx.fillRect(0, yunit * row, 10, yunit)
  for (let i = 0; i < size; i++) {
    const px = Math.floor(xunit * i)
    if (px !== lastDrawn) {
      ctx.strokeRect(xunit * i - offset, yunit * row, xmin, yunit)
      lastDrawn = px
    }
  }
  for (let i = 0; i < size; i++, curr++) {
    const chunks = bins[curr]
    if (chunks) {
      ctx.fillStyle = cb(sum(chunks.map((e: any) => e.fetchedSize())))
      ctx.fillRect(xunit * i - offset, yunit * row, xmin, yunit)
    }
  }
}

export default function Graph({ bai, maxVal }: { bai: any; maxVal: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [mouseDown, setMouseDown] = useState<number>()
  const [mouseCurrent, setMouseCurrent] = useState<number>()
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState(0)

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
    } else return () => {}
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
    let { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height

    const yunit = height / 6
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = 'black'
    width -= 2

    const bins = bai.binIndex
    const flatted = Object.values(bins)
      .flat()
      .map(f => f.fetchedSize()) as number[]
    const scalar = maxVal ? +maxVal : max(flatted)
    const cb = (f: number) =>
      `hsl(${Math.min((f / scalar) * 100, 200)},50%,50%)`

    let curr = 0
    drawRow({
      size: 1,
      row: 0,
      bins,
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
      bins,
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
      bins,
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
      bins,
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
      bins,
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
      size: 32767,
      row: 5,
      bins,
      yunit,
      ctx,
      width,
      curr,
      cb,
      scale,
      offset,
    })

    var gradient = ctx.createLinearGradient(0, 0, 0, 75)
    gradient.addColorStop(0, 'hsl(100,50%,50%)')
    gradient.addColorStop(1 / 5, 'hsl(80,50%,50%)')
    gradient.addColorStop(2 / 5, 'hsl(60,50%,50%)')
    gradient.addColorStop(3 / 5, 'hsl(40,50%,50%)')
    gradient.addColorStop(4 / 5, 'hsl(20,50%,50%)')
    gradient.addColorStop(1, 'hsl(0,50%,50%)')

    ctx.fillStyle = gradient
    ctx.fillRect(width - 10, 0, 10, 75)
    ctx.strokeRect(width - 10, 0, 10, 75)
    ctx.fillStyle = 'black'
    const str0 = `0 bytes`
    const str1 = `${fmt(scalar, 0)} bytes`
    const res0 = ctx.measureText(str0)
    const res1 = ctx.measureText(str1)
    ctx.fillText(str1, width - 10 - res1.width, 10)
    ctx.fillText(str0, width - 10 - res0.width, 75)
  }, [bai, maxVal, scale, offset])

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
      <div style={{ textAlign: 'center' }}>512Mbp (mega-basepairs)</div>
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
            if (Math.abs(event.deltaX) > event.deltaY) {
              setOffset(offset + event.deltaX)
            }
          }}
        />
      </div>
      <p>
        The above diagram shows the distribution of data in the bins from the
        binning index from BAM index file for a particular chromosome. There are
        multiple bin levels which can help hold larger elements in the BAM file.
      </p>
    </div>
  )
}
