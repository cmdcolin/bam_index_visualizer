import React, { useEffect, useState } from 'react'
import { BamFile } from '@gmod/bam'

// locals
import Graph from './Graph'
import { optimizeChunks, reg2bins, sum } from './util'
import Chunk from './chunk'
import FileLayout from './FileLayout'

function DataViewer({ data, loc }: { data: any; loc: string }) {
  const { bai, binSizes, chrToIndex, indexToChr } = data
  const [val, setVal] = useState(indexToChr[0].refName)
  const [colorMode, setColorMode] = useState('zscore')
  const ba = bai.indices[chrToIndex[val]]

  const p = loc.split(':')
  const [s, e] = p[1]?.split('-') || []
  let chunks = [] as Chunk[]
  if (s !== undefined && e !== undefined) {
    const sp = +s
    const ep = +e
    const bins = reg2bins(sp, ep)
    for (const [start, end] of bins) {
      for (let bin = start; bin <= end; bin++) {
        if (ba.binIndex[bin]) {
          const binChunks = ba.binIndex[bin]
          for (let c = 0; c < binChunks.length; ++c) {
            chunks.push(new Chunk(binChunks[c].minv, binChunks[c].maxv, bin))
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
  }
  return (
    <div>
      <label htmlFor="chr">Chromosome:</label>
      <select
        id="chr"
        value={val}
        onChange={event => setVal(event.target.value)}
      >
        {indexToChr.map((name: { refName: string }) => (
          <option key={name.refName} value={name.refName}>
            {name.refName}
          </option>
        ))}
      </select>
      <label htmlFor="color_mode">Color mode:</label>
      <select
        id="color_mode"
        value={colorMode}
        onChange={event => setColorMode(event.target.value)}
      >
        <option value={'zscore'}>Z-score</option>
        <option value={'max'}>Max</option>
      </select>

      <br />
      <Graph
        bai={bai.indices[chrToIndex[val]]}
        binSizes={binSizes}
        colorMode={colorMode}
      />

      {chunks.length ? <FileLayout chunks={chunks} /> : null}
    </div>
  )
}

const base =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ultra-long-ont_hs37d5_phased.bam'

function App() {
  const [loc, setLoc] = useState('')
  const [bamUrl, setBamUrl] = useState(base)
  const [baiUrl, setBaiUrl] = useState(base + '.bai')
  const [data, setData] = useState<any>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    ;(async () => {
      try {
        const bam = new BamFile({ bamUrl, baiUrl })
        const header = await bam.getHeader()
        // @ts-ignore
        const indexToChr = bam.indexToChr
        // @ts-ignore
        const chrToIndex = bam.chrToIndex

        // @ts-ignore
        const bai = await bam.index.parse()
        // @ts-ignore
        const binSizes = bai.indices.map(index =>
          Object.values(index.binIndex).map(chunks =>
            // @ts-ignore
            sum(chunks.map(e => e.fetchedSize())),
          ),
        )
        setData({ bam, indexToChr, chrToIndex, bai, header, binSizes })
      } catch (e) {
        setError(e)
        console.error(e)
      }
    })()
  }, [bamUrl, baiUrl])
  return (
    <div className="App">
      <div>
        <h2>BAM index visualizer</h2>
        <div>
          <label htmlFor="url">BAM URL: </label>
          <input
            id="bam"
            type="text"
            value={bamUrl}
            onChange={event => setBamUrl(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="url">BAI URL: </label>
          <input
            id="bai"
            type="text"
            value={baiUrl}
            onChange={event => setBaiUrl(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="url">Locstring: </label>
          <input
            id="locstring"
            type="text"
            value={loc}
            onChange={event => setLoc(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : !data ? (
        <div>Loading...</div>
      ) : (
        <DataViewer data={data} loc={loc} />
      )}
      <p>Supply a locstring to see what request pattern is generated</p>
    </div>
  )
}

export default App
