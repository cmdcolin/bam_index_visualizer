import React, { useEffect, useState } from 'react'
import { BamFile } from '@gmod/bam'

// locals
import Graph from './Graph'
import FileLayout from './FileLayout'

function DataViewer({ data }: { data: any }) {
  const { bai, chrToIndex, indexToChr } = data
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
      <Graph bai={bai.indices[chrToIndex[val]]} colorMode={colorMode} />

      <FileLayout data={data} val={val} />
    </div>
  )
}

const nanopore =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ultra-long-ont_hs37d5_phased.bam'

const pacbio =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam'

const illumina =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/HG002.hs37d5.2x250.bam'

const pacbio2 =
  'https://jbrowse.org/genomes/hg19/pacbio/m64011_181218_235052.8M.HG002.hs37d5.11kb.bam'

function App() {
  const [bamUrl, setBamUrl] = useState(illumina)
  const [baiUrl, setBaiUrl] = useState(illumina + '.bai')
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
        console.log(bai.indices[0].binIndex)
        setData({ bam, indexToChr, chrToIndex, bai, header })
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
        <div className="splitter">
          <div style={{ margin: 20 }}>
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
          <div style={{ margin: 20 }}>
            <div>Example files:</div>
            <button
              onClick={() => {
                setBamUrl(nanopore)
                setBaiUrl(nanopore + '.bai')
                setData(undefined)
              }}
            >
              Nanopore ultralong (60Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(pacbio)
                setBaiUrl(pacbio + '.bai')
                setData(undefined)
              }}
            >
              PacBio CLR reads (100Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(pacbio2)
                setBaiUrl(pacbio2 + '.bai')
                setData(undefined)
              }}
            >
              PacBio HiFi reads (2Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(illumina)
                setBaiUrl(illumina + '.bai')
                setData(undefined)
              }}
            >
              Illumina reads (9Mb BAI)
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : !data ? (
        <div>Loading...</div>
      ) : (
        <DataViewer data={data} />
      )}
      <p>Supply a locstring to see what request pattern is generated</p>
    </div>
  )
}

export default App
