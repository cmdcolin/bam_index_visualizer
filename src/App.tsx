import React, { useEffect, useState } from 'react'
import { BamFile } from '@gmod/bam'

// locals
import Graph from './Graph'
import { sum } from './util'

function DataViewer({ data }: { data: any }) {
  const { bai, binSizes, chrToIndex, indexToChr } = data
  const [val, setVal] = useState(indexToChr[0].refName)
  const [colorMode, setColorMode] = useState('zscore')

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
    </div>
  )
}

const base =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ultra-long-ont_hs37d5_phased.bam'

function App() {
  const [bamUrl, setBamUrl] = useState(base)
  const [baiUrl, setBaiUrl] = useState(
    'data/ultra-long-ont_hs37d5_phased.bam.bai',
  )
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
        <h2>Index visualizer</h2>
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
      </div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : !data ? (
        <div>Loading...</div>
      ) : (
        <DataViewer data={data} />
      )}
    </div>
  )
}

export default App
