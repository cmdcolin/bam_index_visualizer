import React, { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import Long from 'long'

// locals
import VirtualOffset, { fromBytes } from './virtualOffset'
import Chunk from './chunk'

const BAI_MAGIC = 21578050 // BAI\1

async function myfetch(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} from ${url}`)
  }
  return response.arrayBuffer()
}

function findFirstData(data: any, virtualOffset: VirtualOffset) {
  const currentFdl = data.firstDataLine
  if (currentFdl) {
    data.firstDataLine =
      currentFdl.compareTo(virtualOffset) > 0 ? virtualOffset : currentFdl
  } else {
    data.firstDataLine = virtualOffset
  }
}

function parseBai(buffer: ArrayBuffer) {
  const data: { [key: string]: any } = {
    bai: true,
    maxBlockSize: 1 << 16,
  }

  const arr = new Uint8Array(buffer)
  const bytes = new DataView(buffer)

  // check BAI magic numbers
  if (bytes.getUint32(0, true) !== BAI_MAGIC) {
    throw new Error('Not a BAI file')
  }

  data.refCount = bytes.getInt32(4, true)
  const depth = 5
  const binLimit = ((1 << ((depth + 1) * 3)) - 1) / 7

  // read the indexes for each reference sequence
  data.indices = new Array(data.refCount)
  let currOffset = 8
  for (let i = 0; i < data.refCount; i += 1) {
    // the binning index
    const binCount = bytes.getInt32(currOffset, true)
    let lineCount

    currOffset += 4
    const binIndex: { [key: number]: Chunk[] } = {}
    for (let j = 0; j < binCount; j += 1) {
      const bin = bytes.getUint32(currOffset, true)
      currOffset += 4
      if (bin === binLimit + 1) {
        currOffset += 4

        //this is the pseudo bin, get number of lines from it
        lineCount = bytes.getBigInt64(currOffset + 16, true)
        currOffset += 32
      } else if (bin > binLimit + 1) {
        throw new Error('bai index contains too many bins, please use CSI')
      } else {
        const chunkCount = bytes.getInt32(currOffset, true)
        currOffset += 4
        const chunks = new Array(chunkCount)
        for (let k = 0; k < chunkCount; k += 1) {
          const u = fromBytes(arr, currOffset)
          const v = fromBytes(arr, currOffset + 8)
          currOffset += 16
          findFirstData(data, u)
          chunks[k] = new Chunk(u, v, bin)
        }
        binIndex[bin] = chunks
      }
    }

    const linearCount = bytes.getInt32(currOffset, true)
    currOffset += 4
    // as we're going through the linear index, figure out
    // the smallest virtual offset in the indexes, which
    // tells us where the BAM header ends
    const linearIndex = new Array(linearCount)
    for (let k = 0; k < linearCount; k += 1) {
      linearIndex[k] = fromBytes(arr, currOffset)
      currOffset += 8
      findFirstData(data, linearIndex[k])
    }

    data.indices[i] = {
      binIndex,
      linearIndex,
      lineCount,
    }
  }
  return data
}

function sum(arr: number[]) {
  let sum = 0
  let len = arr.length
  for (let i = 0; i < len; i++) {
    sum += arr[i]
  }
  return sum
}

function max(arr: number[]) {
  let max = 0
  let len = arr.length
  for (let i = 0; i < len; i++) {
    max = Math.max(max, arr[i])
  }
  return max
}

function drawRow({
  size,
  bins,
  curr,
  yunit,
  maxBin,
  width,
  row,
  ctx,
}: {
  size: number
  bins: any
  curr: number
  row: number
  yunit: number
  maxBin: number
  width: number
  ctx: CanvasRenderingContext2D
}) {
  const xunit = Math.max(width / size, 1)
  const xmin = Math.max(1, xunit)
  for (let i = 0; i < size; i++) {
    ctx.strokeRect(xunit * i, yunit * row, xmin, yunit)
  }
  for (let i = 0; i < size; i++, curr++) {
    const chunks = bins[curr]
    if (chunks) {
      const binSize = sum(chunks.map((e: any) => e.fetchedSize()))
      ctx.fillStyle = `hsl(${binSize / maxBin},50%,50%)`
      ctx.fillRect(xunit * i, yunit * row, xmin, yunit)
    }
  }
}

function DataViewer({ data }: { data: ArrayBuffer }) {
  const bai = useMemo(() => parseBai(data), [data])
  const ref = useRef<HTMLCanvasElement>(null)
  const [val, setVal] = useState(0)
  const width = 1200
  const height = 300
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const yunit = height / 6
    ctx.clearRect(0, 0, width, height)
    ctx.resetTransform()
    ctx.translate(1, 1)
    ctx.strokeStyle = 'black'

    const bins = bai.indices[val].binIndex
    const maxBin = max(
      // @ts-ignore
      Object.values(bins).map(chunks => sum(chunks.map(e => e.fetchedSize()))),
    )

    let curr = 0
    const chunks = bins[curr]
    if (chunks) {
      console.log({ chunks, curr })
    }

    drawRow({ size: 1, row: 1, bins, yunit, ctx, width, curr, maxBin })
    curr += 1
    drawRow({ size: 8, row: 2, bins, yunit, ctx, width, curr, maxBin })
    curr += 8
    drawRow({ size: 64, row: 3, bins, yunit, ctx, width, curr, maxBin })
    curr += 64
    drawRow({ size: 4096, row: 4, bins, yunit, ctx, width, curr, maxBin })
    curr += 4096
    drawRow({ size: 36768, row: 5, bins, yunit, ctx, width, curr, maxBin })
    curr += 36768
  }, [bai, width, val, height])
  console.log({ bai })
  return (
    <div>
      <label htmlFor="chr">Chromosome *:</label>
      <select
        id="chr"
        value={val}
        onChange={event => setVal(+event.target.value)}
      >
        {bai.indices.map((_x: any, idx: number) => (
          <option key={idx} value={idx}>{`chr${idx + 1}`}</option>
        ))}
      </select>
      <br />
      <canvas ref={ref} width={width + 2} height={height + 2} />
    </div>
  )
}

function App() {
  const [val, setVal] = useState('volvox-sorted.bam.bai')
  const { data, error, isLoading } = useSWR(val, myfetch)

  return (
    <div className="App">
      <label htmlFor="url">URL: </label>
      <input
        id="url"
        type="text"
        value={val}
        onChange={event => setVal(event.target.value)}
      />
      {error ? <div style={{ color: 'red' }}>{`${error}`}</div> : null}
      {isLoading ? <div>Loading...</div> : null}
      {data ? <DataViewer data={data} /> : null}
      <p>
        *false names, just assumes chr1-chrN since index doesn't strictly have
        chromosome names that's in the BAM header
      </p>
    </div>
  )
}

export default App
