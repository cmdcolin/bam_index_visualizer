import React, { useRef, useEffect } from 'react'
import { max, sum } from './util'

const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

function drawRow({
  size,
  bins,
  curr,
  yunit,
  width,
  row,
  cb,
  ctx,
}: {
  size: number
  bins: any
  curr: number
  row: number
  yunit: number
  width: number
  cb: (arg: number) => string
  ctx: CanvasRenderingContext2D
}) {
  const xunit = (width - 20) / size
  const xmin = Math.max(1, xunit)
  ctx.strokeStyle = `rgb(0,0,0,0.3)`
  let lastDrawn = -Infinity
  ctx.fillStyle = colors[row]
  ctx.fillRect(0, yunit * row, 10, yunit)
  for (let i = 0; i < size; i++) {
    const px = Math.floor(xunit * i)
    if (px !== lastDrawn) {
      ctx.strokeRect(20 + xunit * i, yunit * row, xmin, yunit)
      lastDrawn = px
    }
  }
  for (let i = 0; i < size; i++, curr++) {
    const chunks = bins[curr]
    if (chunks) {
      ctx.fillStyle = cb(sum(chunks.map((e: any) => e.fetchedSize())))
      ctx.fillRect(20 + xunit * i, yunit * row, xmin, yunit)
    }
  }
}

export default function Graph({ bai }: { bai: any }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    let width = canvas.getBoundingClientRect().width
    let height = canvas.getBoundingClientRect().height
    canvas.width = width
    canvas.height = height

    const yunit = height / 6
    ctx.resetTransform()
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = 'black'
    width -= 2

    const bins = bai.binIndex
    const flatted = Object.values(bins)
      .flat()
      .map(f => f.fetchedSize()) as number[]
    const scalar = max(flatted)
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
    })
  }, [bai])

  return (
    <div>
      <div style={{ textAlign: 'center' }}>512Mbp (mega-basepairs)</div>
      <canvas ref={ref} style={{ width: '90%', height: 200, margin: 10 }} />
      <p>
        The above diagram shows the distribution of data in the bins from the
        binning index from BAM index file for a particular chromosome
      </p>
    </div>
  )
}
