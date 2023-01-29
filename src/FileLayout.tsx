import React, { useRef, useEffect, useState } from 'react'
import Chunk from './chunk'
import { max, optimizeChunks, reg2bins } from './util'

const colors = ['red', 'orange', '#FFD700', 'green', 'blue', 'purple']

export default function FileLayout({ data, val }: { data: any; val: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const ref0 = useRef<HTMLCanvasElement>(null)
  const ref1 = useRef<HTMLCanvasElement>(null)
  const ref2 = useRef<HTMLCanvasElement>(null)
  const ref3 = useRef<HTMLCanvasElement>(null)
  const ref4 = useRef<HTMLCanvasElement>(null)
  const ref5 = useRef<HTMLCanvasElement>(null)
  const [maxVal, setMaxVal] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPerBin, setTotalPerBin] = useState<number[]>()
  const [loc, setLoc] = useState('')
  const h = 20

  useEffect(() => {
    const refs = [ref0, ref1, ref2, ref3, ref4, ref5]
    refs.forEach((ref, idx) => {
      const canvas = ref.current
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
      const ba = bai.indices[chrToIndex[val]]
      const maxVal = max(
        Object.values(ba.binIndex)
          .flat()
          .map(c => c.maxv.blockPosition),
      )
      console.log({ maxVal })
      for (const [key, val] of Object.entries(ba.binIndex)) {
        let level = 0
        const b = +key
        if (b === 0) {
          level = 0
        } else if (b >= 1 && b <= 8) {
          level = 1
        } else if (b >= 9 && b <= 72) {
          level = 2
        } else if (b >= 73 && b <= 584) {
          level = 3
        } else if (b >= 585 && b <= 4680) {
          level = 4
        } else {
          level = 5
        }
        if (level === idx) {
          for (let i = 0; i < val.length; i++) {
            const c = val[i]
            const len = maxVal
            const x1 = c.minv.blockPosition / len
            const x2 = c.maxv.blockPosition / len

            ctx.fillRect(x1 * width, 0, Math.max((x2 - x1) * width, 1), h)
          }
        }
      }
    })
  }, [data, val])

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
      let chunks = [] as Chunk[]
      const sp = +s.replaceAll(',', '')
      const ep = +e.replaceAll(',', '')
      const bins = reg2bins(sp, ep)
      for (const [start, end] of bins) {
        for (let bin = start; bin <= end; bin++) {
          if (ba.binIndex[bin]) {
            const binChunks = ba.binIndex[bin]
            for (let c = 0; c < binChunks.length; ++c) {
              chunks.push(binChunks[c])
            }
          }
        }
      }

      // Use the linear index to find minimum file position of chunks that could
      // contain alignments in the region
      const nintv = ba.linearIndex.length
      let lowest = null
      const minLin = Math.min(sp >> 14, nintv - 1)
      const maxLin = Math.min(ep >> 14, nintv - 1)
      for (let i = minLin; i <= maxLin; ++i) {
        const vp = ba.linearIndex[i]
        if (vp) {
          if (!lowest || vp.compareTo(lowest) < 0) {
            lowest = vp
          }
        }
      }

      chunks = optimizeChunks(chunks, lowest)
      // console.log(
      //   { chunks },
      //   chunks
      //     .map(c => c.maxv.blockPosition)
      //     .sort((a, b) => a - b)
      //     .map(a => a.toLocaleString('en-US'))
      //     .join('    '),
      // )

      const maxVal = max(
        Object.values(ba.binIndex)
          .flat()
          .map(c => c.maxv.blockPosition),
      )
      let total = 0
      const totalPerBin = [0, 0, 0, 0, 0, 0]
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]
        const len = maxVal
        const x1 = c.minv.blockPosition / len
        const x2 = c.maxv.blockPosition / len
        const size = c.fetchedSize()
        total += size
        if (c.bin === 0) {
          totalPerBin[0] += size
          ctx.fillStyle = colors[0]
        } else if (c.bin >= 1 && c.bin <= 8) {
          totalPerBin[1] += size
          ctx.fillStyle = colors[1]
        } else if (c.bin >= 9 && c.bin <= 72) {
          totalPerBin[2] += size
          ctx.fillStyle = colors[2]
        } else if (c.bin >= 73 && c.bin <= 584) {
          totalPerBin[3] += size
          ctx.fillStyle = colors[3]
        } else if (c.bin >= 585 && c.bin <= 4680) {
          totalPerBin[4] += size
          ctx.fillStyle = colors[4]
        } else {
          totalPerBin[5] += size
          ctx.fillStyle = colors[5]
        }
        ctx.fillRect(x1 * width, 0, Math.max((x2 - x1) * width, 2), h)
      }
      setTotal(total)
      setMaxVal(maxVal)
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
        <canvas ref={ref} style={{ width: '90%', height: h }} />
        <canvas ref={ref0} style={{ width: '90%', height: h }} />
        <canvas ref={ref1} style={{ width: '90%', height: h }} />
        <canvas ref={ref2} style={{ width: '90%', height: h }} />
        <canvas ref={ref3} style={{ width: '90%', height: h }} />
        <canvas ref={ref4} style={{ width: '90%', height: h }} />
        <canvas ref={ref5} style={{ width: '90%', height: h }} />
      </div>
      {totalPerBin ? (
        <div>
          <div>
            Canvas shows the file range from {'0-' + fmt(maxVal)} and colored
            lines show which locations of the file are requested and which "bin
            level" triggered this request
          </div>
          <p>
            These are the file regions that would be requested by the locstring.
            Total fetched size estimate {fmt(total)}.
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
    </div>
  )
}
