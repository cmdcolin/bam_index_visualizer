import React, { useRef, useEffect, useState } from 'react'
import Chunk from './chunk'
import { max, min } from './util'

const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

export default function FileLayout({ chunks }: { chunks: Chunk[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [minVal, setMinVal] = useState(0)
  const [maxVal, setMaxVal] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPerBin, setTotalPerBin] = useState<number[]>()
  const h = 100
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
    const minVal = min(chunks.map(c => c.minv.blockPosition))
    const maxVal = max(chunks.map(c => c.maxv.blockPosition))
    let total = 0
    const totalPerBin = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const len = maxVal - minVal
      const x1 = (c.minv.blockPosition - minVal) / len
      const x2 = (c.maxv.blockPosition - minVal) / len
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
      ctx.fillRect(x1 * width, 0, Math.max((x2 - x1) * width, 1), h)
    }
    setTotal(total)
    setMinVal(minVal)
    setMaxVal(maxVal)
    setTotalPerBin(totalPerBin)
  }, [chunks])

  return (
    <div>
      <div>
        {minVal.toLocaleString('en-US') + '-' + maxVal.toLocaleString('en-US')}{' '}
        bytes
      </div>
      <canvas ref={ref} style={{ width: '90%', height: h, margin: 10 }} />
      <p>
        These are the file regions that would be requested by the locstring.
        Total fetched size estimate {(total / 1_000_000).toFixed(2)} megabytes.
      </p>
      {totalPerBin ? (
        <div>
          On each layer, data fetches amount to{' '}
          <ul>
            {totalPerBin.map((t, i) => (
              <li>
                <div
                  style={{
                    background: colors[i],
                    width: 10,
                    height: 10,
                  }}
                />{' '}
                {i} - {(t / 1_000_000).toFixed(2)} megabytes
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
