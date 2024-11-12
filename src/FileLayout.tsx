import { useRef, useEffect, useState, useMemo } from 'react'
import { Chunks } from './Chunks'
import { TotalsPerBin } from './TotalsPerBin'
import { type BamData, colors, fmt, getChunks, max, min } from './util'

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
  const [total, setTotal] = useState(0)
  const [optimize, setOptimize] = useState(true)
  const [totalPerBin, setTotalPerBin] = useState<number[]>()
  const { minVal, maxVal } = useMemo(() => {
    const { bai, chrToIndex } = data
    const ba = bai.indices[chrToIndex[chr]]
    const bins = Object.values(ba.binIndex).flat()
    const maxVal = max(bins.map(c => c.maxv.blockPosition))
    const minVal = min(bins.map(c => c.minv.blockPosition))
    return { minVal, maxVal }
  }, [data, chr])
  const [sp, ep] = currPos

  const chunks = useMemo(() => {
    const { bai, chrToIndex } = data
    const ba = bai.indices[chrToIndex[chr]]
    return getChunks(sp, ep, ba, optimize)
  }, [data, sp, ep, chr, optimize])

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
    const ba = bai.indices[chrToIndex[chr]]
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
    for (const [key, val] of Object.entries(ba.binIndex)) {
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
      ctx.fillStyle = colors[level]
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

    let total = 0
    const totalPerBin = [0, 0, 0, 0, 0, 0]
    for (const c of chunks) {
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
        <div>
          <label htmlFor="optimize">
            Optimize/de-duplicate overlapping chunks?
          </label>
          <input
            id="optimize"
            type="checkbox"
            checked={optimize}
            onChange={event => {
              setOptimize(event.target.checked)
            }}
          />
        </div>
      </div>
      <p>
        Block positions for query, colored by bin level, and split into the
        different "bin levels" with all bins marked but colored ones are
        included in query. Note: The colors/bin levels are basically arbitrary
        once optimizing is on, because a block can start in any one of the bins,
        and get merged with any other bin.
      </p>
      <div style={{ margin: 10 }}>
        <div style={{ textAlign: 'center' }}>
          chromosome: {chr} - occupies {fmt(minVal)} - {fmt(maxVal)} in file
          (bytes, not bp)
        </div>
        <canvas ref={ref} style={{ width: '90%', height: h }} />
        <canvas ref={ref2} style={{ width: '90%', height: h * 6 }} />
      </div>
      <TotalsPerBin total={total} totalPerBin={totalPerBin} />
      <Chunks chunks={chunks} context={data} currPos={currPos} />

      <p>
        [1] You may observe in the above diagram that the requests are scattered
        all over the file. In practice, we do not fetch all these blocks and
        instead, fetch them one at a time. Remember the file is still coordinate
        sorted, so we can fetch lower-byte ranges first, and then check if we
        encounter an alignment in a given block that is beyond our requested
        coordinate range, and if so, abort checking any further blocks. This is
        noted in SAMv1.pdf Sec 5.1.1 p.2. Also note that the "optimize routine"
        can use the linear index to find bins from the bin index that are less
        than the query range, hence, clicking this box you'll see boxes to the
        left disappear.
      </p>
      <p>
        [2] In genome browsers on the web, we sometimes avoid merging too many
        BAI blocks into a single large block, because unzipping this block would
        unzip to a very large memory buffer, and we do not have streaming
        unzipping of the block data. Breaking them up is kind of like a little
        form of 'streaming'
      </p>
    </div>
  )
}
