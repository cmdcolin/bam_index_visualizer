import React, { useRef, useEffect } from 'react'
import { max, min, sum } from './util'
// @ts-ignore
import zscore from 'math-z-score'

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
  const xunit = width / size
  const xmin = Math.max(1, xunit)
  ctx.strokeStyle = `rgb(0,0,0,0.5)`
  let lastDrawn = -Infinity
  for (let i = 0; i < size; i++) {
    const px = Math.floor(xunit * i)
    if (px !== lastDrawn) {
      ctx.strokeRect(xunit * i, yunit * row, xmin, yunit)
      lastDrawn = px
    }
  }
  for (let i = 0; i < size; i++, curr++) {
    const chunks = bins[curr]
    if (chunks) {
      ctx.fillStyle = cb(sum(chunks.map((e: any) => e.fetchedSize())))
      ctx.fillRect(xunit * i, yunit * row, xmin, yunit)
    }
  }
}

export default function Graph({
  bai,
  binSizes,
  colorMode,
}: {
  bai: any
  binSizes: number[][]
  colorMode: string
  width?: number
  height?: number
}) {
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
    const width = canvas.getBoundingClientRect().width
    const height = canvas.getBoundingClientRect().height
    canvas.width = width
    canvas.height = height

    const yunit = height / 6
    ctx.clearRect(0, 0, width, height)
    ctx.resetTransform()
    ctx.translate(1, 1)
    ctx.strokeStyle = 'black'

    const bins = bai.binIndex
    const obj = new zscore()
    const flatted = binSizes.flat()
    obj.setMeanAndDeviationFromDataset(flatted, true)
    const minZ = min(flatted.map(f => obj.getZScore(f)))

    // some bins are super-gigantic, so clip for coloring purposes
    const maxZ = Math.min(max(flatted.map(f => obj.getZScore(f))), 6)
    const scalar = max(flatted)

    const cb =
      colorMode === 'zscore'
        ? (f: number) =>
            `hsl(${((minZ + obj.getZScore(f)) / (maxZ - minZ)) * 100},50%,50%)`
        : (f: number) => `hsl(${Math.min((f / scalar) * 100, 200)},50%,50%)`

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
  }, [bai, colorMode, binSizes])

  return (
    <div>
      <div style={{ textAlign: 'center' }}>512Mbp</div>
      <canvas ref={ref} style={{ width: '100%', height: 300 }} />
      <p>
        The above diagram shows the distribution of data in the bins from the
        binning index from BAM index file for a particular chromosome
      </p>
    </div>
  )
}
