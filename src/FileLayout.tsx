import React, { useRef, useEffect, useState } from 'react'
import Chunk from './chunk'
import { max, min, optimizeChunks, reg2bins } from './util'

const colors = ['red', 'orange', '#FFD700', 'green', 'blue', 'purple']

console.log(reg2bins(100, 200))

function getChunks(s: number, e: number, ba: any) {
  const chunks = [] as Chunk[]
  const bins = reg2bins(s, e)
  let k = 0
  for (const [start, end] of bins) {
    for (let bin = start; bin <= end; bin++) {
      if (ba.binIndex[bin]) {
        const binChunks = ba.binIndex[bin]
        console.log({ binChunks, bin })
        for (let c = 0; c < binChunks.length; ++c) {
          k++
          chunks.push(binChunks[c])
        }
      }
    }
  }
  console.log({ k, bins })

  // Use the linear index to find minimum file position of chunks that could
  // contain alignments in the region
  const nintv = ba.linearIndex.length
  let lowest = null
  const minLin = Math.min(s >> 14, nintv - 1)
  const maxLin = Math.min(e >> 14, nintv - 1)
  for (let i = minLin; i <= maxLin; ++i) {
    const vp = ba.linearIndex[i]
    if (vp) {
      if (!lowest || vp.compareTo(lowest) < 0) {
        lowest = vp
      }
    }
  }

  return optimizeChunks(chunks, lowest)
}

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

export default function FileLayout({ data, val }: { data: any; val: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const ref2 = useRef<HTMLCanvasElement>(null)
  const [minVal, setMinVal] = useState(0)
  const [maxVal, setMaxVal] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPerBin, setTotalPerBin] = useState<number[]>()
  const [loc, setLoc] = useState('100-200')
  const h = 20

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
    const width = canvas.getBoundingClientRect().width
    const height = canvas.getBoundingClientRect().height
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    const ba = bai.indices[chrToIndex[val]]
    for (let i = 0; i < 6; i++) {
      ctx.strokeRect(0, i * h, width, h)
    }
    for (const [key, val] of Object.entries(ba.binIndex)) {
      const b = +key
      const level = getLevel(b)
      for (let i = 0; i < val.length; i++) {
        const c = val[i]
        const len = maxVal - minVal
        const x1 = (c.minv.blockPosition - minVal) / len
        const x2 = (c.maxv.blockPosition - minVal) / len

        ctx.fillRect(x1 * width, h * level, Math.max((x2 - x1) * width, 1), h)
      }
    }
  }, [data, val, maxVal, minVal])

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
    ctx.strokeStyle = 'black'
    ctx.strokeRect(0, 0, width, height)

    const { bai, chrToIndex } = data

    const [s, e] = loc.split('-') || []
    if (s !== undefined && e !== undefined) {
      const ba = bai.indices[chrToIndex[val]]
      if (!ba) {
        return
      }
      const sp = +s.replaceAll(',', '')
      const ep = +e.replaceAll(',', '')
      const chunks = getChunks(sp, ep, ba)
      const bins = Object.values(ba.binIndex).flat()
      const maxVal = max(bins.map(c => c.maxv.blockPosition))
      const minVal = min(bins.map(c => c.minv.blockPosition))
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
        ctx.fillRect(x1 * width, 0, Math.max((x2 - x1) * width, 1), h)
      }
      setTotal(total)
      setMaxVal(maxVal)
      setMinVal(minVal)
      setTotalPerBin(totalPerBin)
    }
  }, [data, loc, val])

  const fmt = (n: number) => {
    if (n > 1_000_000_000) {
      return (
        (n / 1_000_000_000).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        }) + 'Gb'
      )
    } else if (n > 1_000_000) {
      return (
        (n / 1_000_000).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        }) + 'Mb'
      )
    } else if (n > 1_000) {
      return (
        (n / 1_000).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        }) + 'kb'
      )
    } else return n + 'bytes'
  }
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
      </div>

      <div style={{ margin: 10 }}>
        <div style={{ textAlign: 'center', margin: 10 }}>
          chromosome: {val} - occupies {fmt(minVal)} - {fmt(maxVal)} in file
          (bytes, not bp)
        </div>
        <p>Block positions matched to coordinate query</p>
        <canvas ref={ref} style={{ width: '90%', height: h }} />
        <p>Block positions per bin type (all, not filtered on coord query)</p>
        <canvas ref={ref2} style={{ width: '90%', height: h * 6 }} />
      </div>
      {totalPerBin ? (
        <div>
          <p>
            Canvas shows the requested byte-ranges of the BAM file from the
            coordinate query.
          </p>
          <p>
            The total size of the blocks is {fmt(total)} but may be less because
            of [1]
          </p>
          <div>
            On each bin level, data fetches amount to{' '}
            <ul>
              {totalPerBin.map((t, i) => (
                <li key={i}>
                  <div
                    style={{
                      background: colors[i],
                      width: 10,
                      height: 10,
                      display: 'inline-block',
                    }}
                  />{' '}
                  {i} - {fmt(t)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
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
