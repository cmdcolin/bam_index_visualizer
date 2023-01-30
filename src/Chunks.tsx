import React, { useEffect, useState } from 'react'
import Chunk from './chunk'
import { fmt } from './util'

export function Chunks({
  context,
  chunks,
  currPos,
}: {
  context: any
  chunks: Chunk[]
  currPos: [number, number]
}) {
  const [stoppingPoint, setStoppingPoint] = useState(0)
  const [totalFetched, setTotalFetched] = useState(0)
  const [loading, setLoading] = useState(false)
  const [currChunk, setCurrChunk] = useState(0)
  const [sp, ep] = currPos
  useEffect(() => {
    setStoppingPoint(0)
    setTotalFetched(0)
  }, [chunks, sp, ep])
  return (
    <div>
      <h2>Requested block overview</h2>
      <button
        onClick={async () => {
          setLoading(true)
          const { bam } = context
          let stoppingPoint = 0
          let i = 0
          let totalFetched = 0
          for (const chunk of chunks) {
            setCurrChunk(i++)
            const { data, cpositions, dpositions } = await bam._readChunk({
              chunk,
            })
            const records = await bam.readBamFeatures(
              data,
              cpositions,
              dpositions,
              chunk,
            )
            totalFetched += chunk.fetchedSize()

            let done = false
            for (let i = 0; i < records.length; i += 1) {
              const feature = records[i]
              if (feature.get('start') >= ep) {
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
        }}
      >
        Fetch BAM records to find which blocks actually have overlapping
        features with query (note: can download large amounts of data)
      </button>
      <p>
        Blocks to request for the requested region, ordered by the minimum file
        position in the file:
      </p>
      {loading ? <div>Loading...processing chunk {currChunk}</div> : null}
      {totalFetched ? <div>Total fetched: {fmt(totalFetched)}</div> : null}
      <div style={{ height: 400, overflow: 'auto' }}>
        <ul>
          {chunks.map((c, idx) => (
            <li
              key={JSON.stringify(c) + '-' + idx}
              style={{
                background:
                  totalFetched !== 0
                    ? idx < stoppingPoint
                      ? '#0a03'
                      : '#a003'
                    : undefined,
              }}
            >
              bin number: {c.bin} - file offsets {fmt(c.minv.blockPosition)} -{' '}
              {fmt(c.maxv.blockPosition)} (fetched size {fmt(c.fetchedSize())}){' '}
              {idx < stoppingPoint
                ? ' (Found features in this chunk)'
                : ' (No features in this chunk)'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
