import { useEffect, useMemo, useRef, useState } from 'react'

import { blockOf, inspectChunk, overlapsQuery, recordLayout } from './bgzf'
import { setupCanvas } from './canvas'
import { useWidth } from './useWidth'
import { fmt } from './util'

import type { BgzfBlock, ChunkInspection } from './bgzf'
import type { BamData, Chunk } from './util'

const IN_QUERY = 'hsl(185, 70%, 32%)'
const IN_QUERY_ALT = 'hsl(185, 55%, 48%)'
const OUTSIDE = '#bbb'
const OUTSIDE_ALT = '#d6d6d6'
const MARKER = '#d1495b'

const fieldColors: Record<string, string> = {
  block_size: '#444',
  'fixed fields': '#3d7a3d',
  'read name': '#edae49',
  CIGAR: '#c97b2a',
  sequence: '#00798c',
  qualities: '#d1495b',
  tags: '#8f5bd6',
}

function blockHasQueryRecords(
  inspection: ChunkInspection,
  inQuery: Uint8Array,
) {
  const { blocks, records } = inspection
  const used = new Uint8Array(blocks.length)
  let b = 0
  for (let i = 0; i < records.count; i++) {
    const start = records.start[i] ?? 0
    while (
      b + 1 < blocks.length &&
      (blocks[b + 1]?.decompressedOffset ?? 0) <= start
    ) {
      b++
    }
    if (inQuery[i]) {
      used[b] = 1
    }
  }
  return used
}

function Overview({
  inspection,
  used,
  windowStart,
  windowSize,
  onPick,
}: {
  inspection: ChunkInspection
  used: Uint8Array
  windowStart: number
  windowSize: number
  onPick: (block: number) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { blocks, fetchStart, fetchedBytes } = inspection
  const height = 26
  const px = (filePos: number) =>
    ((filePos - fetchStart) / fetchedBytes) * width

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas && width > 0 ? setupCanvas(canvas, width, height) : null
    if (ctx) {
      ctx.fillStyle = '#f3d6da'
      ctx.fillRect(0, 2, width, height - 4)
      for (const b of blocks) {
        const isUsed = used[b.index] === 1
        ctx.fillStyle = isUsed
          ? b.index % 2 === 0
            ? IN_QUERY
            : IN_QUERY_ALT
          : b.index % 2 === 0
            ? OUTSIDE
            : OUTSIDE_ALT
        ctx.fillRect(
          px(b.filePosition),
          2,
          Math.max((b.compressedSize / fetchedBytes) * width, 0.5),
          height - 4,
        )
      }
      const first = blocks[windowStart]
      const last = blocks[Math.min(windowStart + windowSize, blocks.length) - 1]
      if (first && last) {
        ctx.strokeStyle = '#111'
        ctx.lineWidth = 2
        const x1 = px(first.filePosition)
        const x2 = px(last.filePosition + last.compressedSize)
        ctx.strokeRect(x1, 1, Math.max(x2 - x1, 3), height - 2)
      }
    }
  })

  return (
    <div ref={ref}>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'pointer' }}
        onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect()
          const filePos =
            fetchStart + ((event.clientX - rect.left) / width) * fetchedBytes
          const hit = blocks.findLast(b => b.filePosition <= filePos)
          if (hit) {
            onPick(hit.index)
          }
        }}
      />
    </div>
  )
}

const ROW1_Y = 18
const ROW_H = 28
const ROW2_Y = 112
const ROW3_Y = ROW2_Y + ROW_H + 8
const DETAIL_H = ROW3_Y + ROW_H + 24

function Detail({
  inspection,
  chunk,
  inQuery,
  windowBlocks,
  selected,
  onSelect,
}: {
  inspection: ChunkInspection
  chunk: Chunk
  inQuery: Uint8Array
  windowBlocks: BgzfBlock[]
  selected: number | undefined
  onSelect: (record: number) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<string>()
  const { records, blocks, begin, end } = inspection
  const first = windowBlocks[0]
  const last = windowBlocks.at(-1)
  const cStart = first?.filePosition ?? 0
  const cEnd = last ? last.filePosition + last.compressedSize : 1
  const dStart = first?.decompressedOffset ?? 0
  const dEnd = last ? last.decompressedOffset + last.uncompressedSize : 1
  const cx = (p: number) => ((p - cStart) / (cEnd - cStart)) * width
  const dx = (p: number) => ((p - dStart) / (dEnd - dStart)) * width

  const visible = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < records.count; i++) {
      const s = records.start[i] ?? 0
      const e = records.start[i + 1] ?? end
      if (e > dStart && s < dEnd) {
        out.push(i)
      }
    }
    return out
  }, [records, dStart, dEnd, end])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx =
      canvas && width > 0 && first ? setupCanvas(canvas, width, DETAIL_H) : null
    if (ctx) {
      ctx.font = '11px system-ui'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#555'
      ctx.fillText('compressed (bytes in the file)', 0, ROW1_Y - 5)
      ctx.fillText(
        'decompressed (BAM records, one after another)',
        0,
        ROW2_Y - 5,
      )
      for (const b of windowBlocks) {
        const x1 = cx(b.filePosition)
        const x2 = cx(b.filePosition + b.compressedSize)
        const y1 = dx(b.decompressedOffset)
        const y2 = dx(b.decompressedOffset + b.uncompressedSize)
        ctx.fillStyle = b.index % 2 === 0 ? '#e7eef3' : '#d5e2ea'
        ctx.beginPath()
        ctx.moveTo(x1, ROW1_Y + ROW_H)
        ctx.lineTo(x2, ROW1_Y + ROW_H)
        ctx.lineTo(y2, ROW2_Y)
        ctx.lineTo(y1, ROW2_Y)
        ctx.closePath()
        ctx.fill()
        for (const [x, w, y, label] of [
          [x1, x2 - x1, ROW1_Y, fmt(b.compressedSize, 1)],
          [y1, y2 - y1, ROW2_Y, fmt(b.uncompressedSize, 1)],
        ] as const) {
          ctx.fillStyle = b.index % 2 === 0 ? '#5b7f95' : '#7d9db0'
          ctx.fillRect(x, y, w, ROW_H)
          ctx.strokeStyle = '#fff'
          ctx.strokeRect(x, y, w, ROW_H)
          const text = `block ${b.index + 1}: ${label}`
          if (ctx.measureText(text).width + 8 < w) {
            ctx.fillStyle = '#fff'
            ctx.textAlign = 'center'
            ctx.fillText(text, x + w / 2, y + ROW_H / 2 + 4)
            ctx.textAlign = 'left'
          }
        }
      }
      for (const [k, i] of visible.entries()) {
        const s = Math.max(records.start[i] ?? 0, dStart)
        const e = Math.min(records.start[i + 1] ?? end, dEnd)
        ctx.fillStyle =
          i === selected
            ? '#111'
            : inQuery[i]
              ? k % 2 === 0
                ? IN_QUERY
                : IN_QUERY_ALT
              : k % 2 === 0
                ? OUTSIDE
                : OUTSIDE_ALT
        ctx.fillRect(dx(s), ROW3_Y, Math.max(dx(e) - dx(s), 0.5), ROW_H)
      }
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      for (const b of windowBlocks) {
        const x = dx(b.decompressedOffset)
        ctx.beginPath()
        ctx.moveTo(x, ROW3_Y - 4)
        ctx.lineTo(x, ROW3_Y + ROW_H + 4)
        ctx.stroke()
      }
      ctx.lineWidth = 1
      const markers = [
        {
          at: begin,
          label: `minv ${chunk.minv.blockPosition}:${chunk.minv.dataPosition}`,
        },
        {
          at: end,
          label: `maxv ${chunk.maxv.blockPosition}:${chunk.maxv.dataPosition}`,
        },
      ]
      for (const m of markers) {
        if (m.at >= dStart && m.at <= dEnd) {
          const x = Math.min(Math.max(dx(m.at), 1), width - 1)
          ctx.strokeStyle = MARKER
          ctx.fillStyle = MARKER
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x, ROW2_Y)
          ctx.lineTo(x, ROW3_Y + ROW_H + 4)
          ctx.stroke()
          ctx.lineWidth = 1
          ctx.textAlign = x > width / 2 ? 'right' : 'left'
          ctx.fillText(m.label, x + (x > width / 2 ? -4 : 4), DETAIL_H - 6)
          ctx.textAlign = 'left'
        }
      }
    }
  })

  function recordAt(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const pos = dStart + ((event.clientX - rect.left) / width) * (dEnd - dStart)
    return y >= ROW3_Y && y <= ROW3_Y + ROW_H
      ? visible.findLast(i => (records.start[i] ?? 0) <= pos)
      : undefined
  }

  return (
    <div ref={ref}>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'pointer' }}
        onMouseMove={event => {
          const i = recordAt(event)
          setHover(
            i === undefined
              ? undefined
              : `record at decompressed offset ${fmt(records.start[i] ?? 0, 0).replace('bytes', '')}, reference ${records.pos[i] ?? 0}-${records.refEnd[i] ?? 0}${inQuery[i] ? ' (overlaps the query)' : ''}`,
          )
        }}
        onMouseLeave={() => {
          setHover(undefined)
        }}
        onClick={event => {
          const i = recordAt(event)
          if (i !== undefined) {
            onSelect(i)
          }
        }}
      />
      <div className="hover-info">
        {hover ??
          `${visible.length.toLocaleString()} records in these blocks; ${blocks.length.toLocaleString()} blocks in the chunk`}
      </div>
    </div>
  )
}

function ReferenceSpread({
  inspection,
  inQuery,
  refId,
  currPos,
}: {
  inspection: ChunkInspection
  inQuery: Uint8Array
  refId: number
  currPos: [number, number]
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { records } = inspection
  const height = 70

  const extent = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY
    let hi = 0
    for (let i = 0; i < records.count; i++) {
      if (records.refId[i] === refId) {
        lo = Math.min(lo, records.pos[i] ?? 0)
        hi = Math.max(hi, records.refEnd[i] ?? 0)
      }
    }
    return lo === Number.POSITIVE_INFINITY
      ? { lo: currPos[0], hi: currPos[1] }
      : { lo, hi }
  }, [records, refId, currPos])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas && width > 0 ? setupCanvas(canvas, width, height) : null
    if (ctx) {
      const span = Math.max(extent.hi - extent.lo, 1)
      const inBins = new Float64Array(width)
      const outBins = new Float64Array(width)
      for (let i = 0; i < records.count; i++) {
        if (records.refId[i] === refId) {
          const p = Math.min(
            Math.floor((((records.pos[i] ?? 0) - extent.lo) / span) * width),
            width - 1,
          )
          const bins = inQuery[i] ? inBins : outBins
          bins[p] = (bins[p] ?? 0) + 1
        }
      }
      let peak = 1
      for (let p = 0; p < width; p++) {
        peak = Math.max(peak, (inBins[p] ?? 0) + (outBins[p] ?? 0))
      }
      const q1 = Math.max(((currPos[0] - extent.lo) / span) * width, 0)
      const q2 = Math.min(((currPos[1] - extent.lo) / span) * width, width)
      ctx.fillStyle = 'rgba(209, 73, 91, 0.12)'
      ctx.fillRect(q1, 0, Math.max(q2 - q1, 2), height - 14)
      for (let p = 0; p < width; p++) {
        const hOut = ((outBins[p] ?? 0) / peak) * (height - 18)
        const hIn = ((inBins[p] ?? 0) / peak) * (height - 18)
        ctx.fillStyle = OUTSIDE
        ctx.fillRect(p, height - 14 - hOut - hIn, 1, hOut)
        ctx.fillStyle = IN_QUERY
        ctx.fillRect(p, height - 14 - hIn, 1, hIn)
      }
      ctx.fillStyle = '#555'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(extent.lo.toLocaleString(), 0, height - 2)
      ctx.textAlign = 'right'
      ctx.fillText(extent.hi.toLocaleString(), width, height - 2)
    }
  })

  return (
    <div ref={ref}>
      <canvas ref={canvasRef} />
    </div>
  )
}

function RecordDetail({
  inspection,
  index,
}: {
  inspection: ChunkInspection
  index: number
}) {
  const { data, blocks } = inspection
  const layout = recordLayout(data, inspection.records.start[index] ?? 0)
  const block = blockOf(blocks, layout.start)
  const offsetInBlock = block ? layout.start - block.decompressedOffset : 0
  const endBlock = blockOf(blocks, layout.end - 1)
  const total = layout.end - layout.start

  return (
    <div className="record-detail">
      <h4>
        {layout.readName}: one record, {fmt(total, 0)} in a row
      </h4>
      <div className="stacked-bar">
        {layout.fields.map(f => (
          <div
            key={f.name}
            title={`${f.name}: ${f.length} bytes`}
            style={{
              width: `${(f.length / total) * 100}%`,
              background: fieldColors[f.name],
            }}
          />
        ))}
      </div>
      <div className="legend">
        {layout.fields.map(f => (
          <span key={f.name}>
            <span
              className="swatch"
              style={{ background: fieldColors[f.name] }}
            />
            {f.name} {f.length} B
          </span>
        ))}
      </div>
      <p>
        Every field of this read sits together, so one record is one contiguous
        run of bytes, where CRAM would spread it over a block per field.
      </p>
      {block ? (
        <p>
          It starts {offsetInBlock.toLocaleString()} bytes into BGZF block{' '}
          {block.index + 1}, which begins at file byte{' '}
          {block.filePosition.toLocaleString()}. Its virtual offset is{' '}
          <code>
            {block.filePosition.toLocaleString()} × 65536 +{' '}
            {offsetInBlock.toLocaleString()}
          </code>
          : the block's file position in the upper 48 bits, the offset inside
          the decompressed block in the lower 16.
          {endBlock && endBlock !== block
            ? ` It runs past the end of the block and finishes in block ${endBlock.index + 1}, so reading it needs both decompressed.`
            : ''}
        </p>
      ) : null}
      <p className="muted">
        Reference {layout.pos.toLocaleString()}-{layout.refEnd.toLocaleString()}
        , flag {layout.flag}, MAPQ {layout.mapq}, {layout.lSeq} bases
      </p>
    </div>
  )
}

export default function ChunkInspector({
  data,
  chunk,
  refId,
  currPos,
  onClose,
}: {
  data: BamData
  chunk: Chunk
  refId: number
  currPos: [number, number]
  onClose: () => void
}) {
  const [inspection, setInspection] = useState<ChunkInspection>()
  const [error, setError] = useState<unknown>()
  const [windowStart, setWindowStart] = useState<number>()
  const [windowSize, setWindowSize] = useState(4)
  const [selected, setSelected] = useState<number>()

  useEffect(() => {
    let active = true
    inspectChunk(data.bam.bam, chunk).then(
      result => {
        if (active) {
          setInspection(result)
        }
      },
      (error_: unknown) => {
        console.error(error_)
        if (active) {
          setError(error_)
        }
      },
    )
    return () => {
      active = false
    }
  }, [data, chunk])

  const inQuery = useMemo(() => {
    const out = new Uint8Array(inspection?.records.count ?? 0)
    for (let i = 0; i < out.length; i++) {
      out[i] =
        inspection &&
        overlapsQuery(inspection.records, i, refId, currPos[0], currPos[1])
          ? 1
          : 0
    }
    return out
  }, [inspection, refId, currPos])

  const used = useMemo(
    () =>
      inspection
        ? blockHasQueryRecords(inspection, inQuery)
        : new Uint8Array(0),
    [inspection, inQuery],
  )

  const stats = useMemo(() => {
    let n = 0
    for (const v of inQuery) {
      n += v
    }
    let usedBytes = 0
    for (const b of inspection?.blocks ?? []) {
      usedBytes += used[b.index] ? b.compressedSize : 0
    }
    return { inQueryCount: n, usedBytes }
  }, [inQuery, used, inspection])

  const firstUsed = used.indexOf(1)
  const start = windowStart ?? Math.max(firstUsed, 0)
  const windowBlocks = inspection?.blocks.slice(start, start + windowSize) ?? []

  return (
    <div className="inspector">
      <div className="inspector-header">
        <h3>
          Chunk from bin {chunk.bin}: virtual offsets {chunk.minv.blockPosition}
          :{chunk.minv.dataPosition} to {chunk.maxv.blockPosition}:
          {chunk.maxv.dataPosition}
        </h3>
        <button onClick={onClose}>Close</button>
      </div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : inspection ? (
        <>
          <div className="summary">
            <span>{fmt(inspection.fetchedBytes)} fetched</span>
            <span>{inspection.blocks.length.toLocaleString()} BGZF blocks</span>
            <span>{fmt(inspection.data.length)} decompressed</span>
            <span>
              {inspection.records.count.toLocaleString()} records in the chunk
            </span>
            <span>{stats.inQueryCount.toLocaleString()} overlap the query</span>
            <span>
              blocks holding them: {fmt(stats.usedBytes)} of{' '}
              {fmt(inspection.fetchedBytes)}
            </span>
          </div>

          <h4>Every BGZF block fetched for this chunk</h4>
          <p className="muted">
            Teal blocks hold at least one record overlapping the query, grey
            blocks hold none, and pink is fetched past the last whole block (the
            read is sized to maxv's block plus 64 KiB). Click to choose which
            blocks to look at below.
          </p>
          <Overview
            inspection={inspection}
            used={used}
            windowStart={start}
            windowSize={windowSize}
            onPick={block => {
              setWindowStart(block)
            }}
          />

          <div className="file-layout-header">
            <h4>
              Blocks {start + 1}-
              {Math.min(start + windowSize, inspection.blocks.length)}, each
              inflated on its own
            </h4>
            <label>
              show{' '}
              <select
                value={windowSize}
                onChange={event => {
                  setWindowSize(Number(event.target.value))
                }}
              >
                {[1, 2, 4, 8, 16].map(n => (
                  <option key={n} value={n}>
                    {n} block{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Detail
            inspection={inspection}
            chunk={chunk}
            inQuery={inQuery}
            windowBlocks={windowBlocks}
            selected={selected}
            onSelect={setSelected}
          />

          <h4>Where the chunk's records lie on the reference</h4>
          <p className="muted">
            Record start positions, teal where the record overlaps the query
            (shaded). A chunk covers whatever its bin collected, so most of it
            can lie outside a small query.
          </p>
          <ReferenceSpread
            inspection={inspection}
            inQuery={inQuery}
            refId={refId}
            currPos={currPos}
          />

          {selected === undefined ? (
            <p className="muted">
              Click a record in the decompressed row to see its layout.
            </p>
          ) : (
            <RecordDetail inspection={inspection} index={selected} />
          )}
        </>
      ) : (
        <div>Fetching and inflating {fmt(chunk.fetchedSize())}…</div>
      )}
    </div>
  )
}
