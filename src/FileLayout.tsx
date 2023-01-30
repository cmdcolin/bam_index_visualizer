import React, { useRef, useEffect, useState, useMemo } from 'react'
import Chunk from './chunk'
import { Chunks } from './Chunks'
import { TotalsPerBin } from './TotalsPerBin'
import { colors, fmt, getChunks, max, min } from './util'

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

export default function FileLayout({ data, val }: { data: any; val: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const ref2 = useRef<HTMLCanvasElement>(null)
  const [total, setTotal] = useState(0)
  const [optimize, setOptimize] = useState(true)
  const [totalPerBin, setTotalPerBin] = useState<number[]>()
  const [loc, setLoc] = useState('100-200')
  const { minVal, maxVal } = useMemo(() => {
    const { bai, chrToIndex } = data
    const ba = bai.indices[chrToIndex[val]]
    const bins = Object.values(ba.binIndex).flat()
    const maxVal = max(bins.map(c => c.maxv.blockPosition))
    const minVal = min(bins.map(c => c.minv.blockPosition))
    return { minVal, maxVal }
  }, [data, val])

  const chunks = useMemo(() => {
    const [s, e] = loc.split('-') || []
    const { bai, chrToIndex } = data
    const ba = bai.indices[chrToIndex[val]]
    let chunks = [] as Chunk[]
    if (s !== undefined && e !== undefined && ba) {
      const sp = +s.replaceAll(',', '')
      const ep = +e.replaceAll(',', '')
      chunks = getChunks(sp, ep, ba, optimize)
    }
    return chunks
  }, [data, loc, val, optimize])

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
    const ba = bai.indices[chrToIndex[val]]
    const width = canvas.getBoundingClientRect().width
    const height = canvas.getBoundingClientRect().height
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    for (let i = 0; i < 6; i++) {
      ctx.strokeRect(0, i * h, width, h)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    let lastPx = -Infinity
    let lastCount = 0
    for (const [key, val] of Object.entries(ba.binIndex)) {
      const b = +key
      const level = getLevel(b)
      for (let i = 0; i < val.length; i++) {
        const c = val[i]
        const len = maxVal - minVal
        const x1 = (c.minv.blockPosition - minVal) / len
        const x2 = (c.maxv.blockPosition - minVal) / len
        let currPx = Math.floor(x1 * width)
        if (lastPx === currPx && lastCount < 4) {
          ctx.fillRect(x1 * width, h * level, Math.max((x2 - x1) * width, 2), h)
          lastCount++
        } else if (lastPx !== currPx) {
          lastPx = currPx
          lastCount = 0
        }
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const len = maxVal - minVal
      const x1 = (c.minv.blockPosition - minVal) / len
      const x2 = (c.maxv.blockPosition - minVal) / len
      const level = getLevel(c.bin)
      ctx.fillStyle = colors[level]
      ctx.fillRect(x1 * width, h * level, Math.max((x2 - x1) * width, 2), h)
    }
  }, [data, val, minVal, maxVal, chunks])

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

    let total = 0
    const totalPerBin = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const len = maxVal - minVal
      const x1 = (c.minv.blockPosition - minVal) / len
      const x2 = (c.maxv.blockPosition - minVal) / len
      const size = c.fetchedSize()
      total += size
      const level = getLevel(c.bin)
      totalPerBin[level] += size
      ctx.fillStyle = colors[level]
      ctx.fillRect(x1 * width, 0, Math.max((x2 - x1) * width, 2), h + 2)
    }
    setTotal(total)
    setTotalPerBin(totalPerBin)
  }, [minVal, maxVal, chunks])

  return (
    <div>
      <h2>Request pattern for a given query</h2>
      <div>
        <label htmlFor="locstring">
          Enter start and end e.g. 1-100 for the file request for the current
          chromosome
        </label>
        <input
          id="locstring"
          type="text"
          value={loc}
          onChange={event => setLoc(event.target.value)}
        />
        <label htmlFor="optimize">Optimize chunks?</label>
        <input
          id="optimize"
          type="checkbox"
          checked={optimize}
          onChange={event => setOptimize(event.target.checked)}
        />
      </div>

      <div style={{ margin: 10 }}>
        <div style={{ textAlign: 'center', margin: 20 }}>
          chromosome: {val} - occupies {fmt(minVal)} - {fmt(maxVal)} in file
          (bytes, not bp)
        </div>
        <p>Block positions for query, colored by bin level</p>
        <canvas ref={ref} style={{ width: '90%', height: h }} />
        <p>
          Block positions, colored by bin level if included in query (faded
          black otherwise)
        </p>
        <canvas ref={ref2} style={{ width: '90%', height: h * 6 }} />
      </div>
      <TotalsPerBin total={total} totalPerBin={totalPerBin} />
      <Chunks chunks={chunks} context={data} loc={loc} />

      <p>
        [1] You may observe in the above diagram that the requests are scattered
        all over the file. In practice, we do not fetch all these blocks and
        instead, fetch them one at a time. Remember the file is still coordinate
        sorted, so we can fetch lower-byte ranges first, and then check if we
        encounter an alignment in a given block that is beyond our requested
        coordinate range, and if so, abort checking any further blocks. This is
        noted in SAMv1.pdf Sec 5.1.1 p.2
      </p>
    </div>
  )
}
