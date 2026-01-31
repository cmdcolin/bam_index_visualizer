import { useMemo, useState } from 'react'
import type Chunk from './chunk'
import { fmt } from './util'
import type { BamFile } from '@gmod/bam'

export function Chunks({
  context,
  chunks,
  currPos,
}: {
  context: { bam: BamFile }
  chunks: Chunk[]
  currPos: [number, number]
}) {
  const [sp, ep] = currPos
  const cacheKey = `${chunks.length}-${sp}-${ep}`
  const [stoppingPoint, setStoppingPoint] = useState(0)
  const [totalFetched, setTotalFetched] = useState(0)
  const [loading, setLoading] = useState(false)
  const [currChunk, setCurrChunk] = useState(0)
  const [lastCacheKey, setLastCacheKey] = useState(cacheKey)

  if (cacheKey !== lastCacheKey) {
    setStoppingPoint(0)
    setTotalFetched(0)
    setLastCacheKey(cacheKey)
  }

  const memod = useMemo(() => {
    return chunks.map(c => ({
      chunk: c,
      fmt1: fmt(c.minv.blockPosition, 5),
      fmt2: fmt(c.maxv.blockPosition, 5),
      fmt3: fmt(c.fetchedSize(), 5),
    }))
  }, [chunks])

  return (
    <div>
      <h2>Requested block overview</h2>
      <button
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            setLoading(true)
            const { bam } = context
            let stoppingPoint = 0
            let i = 0
            let totalFetched = 0
            for (const chunk of chunks) {
              setCurrChunk(i++)
              const { data, cpositions, dpositions } = await bam._readChunk({
                chunk,
                opts: {},
              })
              const records = await bam.readBamFeatures(
                data,
                cpositions,
                dpositions,
                chunk,
              )
              totalFetched += chunk.fetchedSize()

              let done = false
              for (const feature of records) {
                if (feature.start >= ep) {
                  done = true
                  break
                }
              }

              if (done) {
                setStoppingPoint(stoppingPoint + 1)
                setTotalFetched(totalFetched)
                break
              } else {
                stoppingPoint++
              }
            }
            setLoading(false)
          })()
        }}
      >
        Fetch BAM records to find which blocks actually have overlapping
        features with query (note: can download large amounts of data)
      </button>
      {ep - sp > 1_000_000 ? (
        <p>WARNING: Large region selected. Might not wanna click the button</p>
      ) : null}
      <p>
        Blocks to request for the requested region, ordered by the minimum file
        position in the file:
      </p>
      {loading ? <div>Loading...processing chunk {currChunk}</div> : null}
      {totalFetched ? <div>Total fetched: {fmt(totalFetched)}</div> : null}
      <div style={{ height: 400, overflow: 'auto' }}>
        <ul>
          {memod.slice(0, 200).map((c, idx) => (
            <li
              key={`${JSON.stringify(c.chunk)}-${idx}`}
              style={{
                background:
                  totalFetched === 0
                    ? undefined
                    : idx < stoppingPoint
                      ? '#0a03'
                      : '#a003',
              }}
            >
              bin number: {c.chunk.bin} - file offsets {c.fmt1} - {c.fmt2} (fetched
              size {c.fmt3}){' '}
              {totalFetched === 0
                ? ''
                : idx < stoppingPoint
                  ? ' (Found features in this chunk)'
                  : ' (No features in this chunk)'}
            </li>
          ))}
          {memod.length > 200 ? (
            <div>...More than 200 chunks requested, just displaying 200</div>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
