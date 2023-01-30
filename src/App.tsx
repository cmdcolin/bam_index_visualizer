import React, { useEffect, useState } from 'react'
import { BamFile } from '@gmod/bam'

// locals
import Graph from './Graph'
import FileLayout from './FileLayout'

function DataViewer({ data }: { data: any }) {
  const { bai, chrToIndex, indexToChr } = data
  const [val, setVal] = useState(indexToChr[0].refName)
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

      <br />
      <Graph bai={bai.indices[chrToIndex[val]]} />

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

const isoseq =
  'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/alzheimers_isoseq/hq_isoforms.fasta.bam'

function App() {
  const [bamUrl, setBamUrl] = useState(illumina)
  const [baiUrl, setBaiUrl] = useState(illumina + '.bai')
  const [data, setData] = useState<any>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    ;(async () => {
      try {
        setError(undefined)
        const bam = new BamFile({ bamUrl, baiUrl })
        const header = await bam.getHeader()
        // @ts-ignore
        const indexToChr = bam.indexToChr
        // @ts-ignore
        const chrToIndex = bam.chrToIndex

        // @ts-ignore
        const bai = await bam.index.parse()
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
        <p>
          This is a project that helps visualize the structure of the bin index
          of BAM index (BAI) files
        </p>
        <div className="splitter">
          <div className="form">
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
          <div className="buttons">
            <div>Example files:</div>
            <button
              onClick={() => {
                setData(undefined)
                setBamUrl(nanopore)
                setBaiUrl(nanopore + '.bai')
              }}
            >
              Nanopore ultralong (60Mb BAI)
            </button>
            <button
              onClick={() => {
                setData(undefined)
                setBamUrl(pacbio)
                setBaiUrl(pacbio + '.bai')
              }}
            >
              PacBio CLR reads (100Mb BAI)
            </button>
            <button
              onClick={() => {
                setData(undefined)
                setBamUrl(pacbio2)
                setBaiUrl(pacbio2 + '.bai')
              }}
            >
              PacBio HiFi reads (2Mb BAI)
            </button>
            <button
              onClick={() => {
                setData(undefined)
                setBamUrl(illumina)
                setBaiUrl(illumina + '.bai')
              }}
            >
              Illumina reads (9Mb BAI)
            </button>
            <button
              onClick={() => {
                setData(undefined)
                setBamUrl(isoseq)
                setBaiUrl(isoseq + '.bai')
              }}
            >
              PacBio IsoSeq (1.5Mb BAI)
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
    </div>
  )
}

export default App
