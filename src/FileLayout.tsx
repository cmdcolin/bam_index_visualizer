import { useRef, useEffect, useMemo, useState } from 'react'
import { Chunks } from './Chunks'
import { TotalsPerBin } from './TotalsPerBin'
import { type BamData, colors, fmt, fmt2, getChunks, max, min } from './util'

function getLevel(b: number) {
  if (b === 0) {
    return 0
  } else if (b >= 1 && b <= 8) {
    return 1
  } else if (b >= 9 && b <= 72) {
    return 2
  } else if (b >= 73 && b <= 584) {
    return 3
  } else if (b >= 585 && b <= 4680) {
    return 4
  } else {
    return 5
  }
}

const h = 20

const levelLabels = ['512Mb', '64Mb', '8Mb', '1Mb', '128kb', '16kb']

export default function FileLayout({
  data,
  chr,
  currPos,
}: {
  data: BamData
  chr: string
  currPos: [number, number]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const ref2 = useRef<HTMLCanvasElement>(null)
  const [optimize, setOptimize] = useState(true)
  const { minVal, maxVal } = useMemo(() => {
    const { bai, chrToIndex } = data
    const ba = bai.indices(chrToIndex[chr]!)
    if (!ba) {
      return { minVal: 0, maxVal: 0 }
    }
    const bins = Object.values(ba.binIndex).flat()
    const maxVal = max(bins.map(c => c.maxv.blockPosition))
    const minVal = min(bins.map(c => c.minv.blockPosition))
    return { minVal, maxVal }
  }, [data, chr])
  const [sp, ep] = currPos

  const chunks = useMemo(() => {
    const { bai, chrToIndex } = data
    const ba = bai.indices(chrToIndex[chr]!)
    if (!ba) {
      return []
    }
    return getChunks(sp, ep, ba, optimize)
  }, [data, sp, ep, chr, optimize])

  const { total, totalPerBin } = useMemo(() => {
    let total = 0
    const totalPerBin = [0, 0, 0, 0, 0, 0]
    for (const c of chunks) {
      const size = c.fetchedSize()
      total += size
      const level = getLevel(c.bin)
      totalPerBin[level] = (totalPerBin[level] ?? 0) + size
    }
    return { total, totalPerBin }
  }, [chunks])

  useEffect(() => {
    const canvas = ref2.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const { bai, chrToIndex } = data
    const ba = bai.indices(chrToIndex[chr]!)
    if (!ba) {
      return
    }
    const width = canvas.getBoundingClientRect().width
    const height = canvas.getBoundingClientRect().height
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    for (let i = 0; i < 6; i++) {
      ctx.strokeRect(0, i * h, width, h)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    let lastPx = Number.NEGATIVE_INFINITY
    let lastCount = 0
    for (const key of Object.keys(ba.binIndex)) {
      const val = ba.binIndex[+key]
      if (!val) {
        continue
      }
      const b = +key
      const level = getLevel(b)
      for (const c of val) {
        const len = maxVal - minVal
        const x1 = (c.minv.blockPosition - minVal) / len
        const x2 = (c.maxv.blockPosition - minVal) / len
        const currPx = Math.floor(x1 * width)
        if (lastPx === currPx && lastCount < 4) {
          ctx.fillRect(x1 * width, h * level, Math.max((x2 - x1) * width, 2), h)
          lastCount++
        } else if (lastPx !== currPx) {
          lastPx = currPx
          lastCount = 0
        }
      }
    }

    for (const c of chunks) {
      const len = maxVal - minVal
      const x1 = (c.minv.blockPosition - minVal) / len
      const x2 = (c.maxv.blockPosition - minVal) / len
      const level = getLevel(c.bin)
      ctx.fillStyle = colors[level]!
      ctx.fillRect(x1 * width, h * level, Math.max((x2 - x1) * width, 2), h)
    }
  }, [data, chr, minVal, maxVal, chunks])

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
    ctx.clearRect(0, 0, width, height)

    for (const c of chunks) {
      const len = maxVal - minVal
      const x1 = (c.minv.blockPosition - minVal) / len
      const x2 = (c.maxv.blockPosition - minVal) / len
      const level = getLevel(c.bin)
      ctx.fillStyle = colors[level]!
      ctx.fillRect(x1 * width, 0, Math.max((x2 - x1) * width, 2), h + 2)
    }
  }, [minVal, maxVal, chunks])

  return (
    <div className="file-layout">
      <div className="file-layout-header">
        <div className="file-layout-region">
          <span className="region-label">Viewing region:</span>
          <span className="region-value">
            {chr}:{fmt2(sp, 1, false)}-{fmt2(ep)}
          </span>
        </div>
        <label htmlFor="optimize" className="optimize-checkbox">
          <input
            id="optimize"
            type="checkbox"
            checked={optimize}
            onChange={event => {
              setOptimize(event.target.checked)
            }}
          />
          De-duplicate chunks
        </label>
      </div>
      <div className="file-layout-subtitle">
        Byte-range requests to fetch (file occupies {fmt(minVal)} -{' '}
        {fmt(maxVal)})
      </div>
      <div className="file-layout-canvas">
        <div className="canvas-row">
          <div className="canvas-label">Merged</div>
          <canvas ref={ref} style={{ flex: 1, height: h }} />
        </div>
        <div className="canvas-row">
          <div className="canvas-labels">
            {levelLabels.map(label => (
              <div key={label} className="canvas-label" style={{ height: h }}>
                {label}
              </div>
            ))}
          </div>
          <canvas ref={ref2} style={{ flex: 1, height: h * 6 }} />
        </div>
      </div>
      <TotalsPerBin total={total} totalPerBin={totalPerBin} />
      <Chunks chunks={chunks} context={data} currPos={currPos} />

      <div>
        <p>
          [1] You may observe that the requests are scattered all over the file.
          In practice, we do not fetch all these blocks at once. The file is
          coordinate sorted, so we fetch lower-byte ranges first and abort once
          we encounter an alignment beyond the requested range (see SAMv1.pdf
          Sec 5.1.1). The de-duplicate option uses the linear index to exclude
          bins before the query range.
        </p>
        <p>
          [2] In genome browsers, we sometimes avoid merging too many BAI blocks
          into a single large block, because unzipping would require a very
          large memory buffer without streaming decompression.
        </p>
      </div>
    </div>
  )
}
