import React, { useEffect, useState } from 'react'
import { BamFile } from '@gmod/bam'

// locals
import Graph from './Graph'
import FileLayout from './FileLayout'

function DataViewer({ data }: { data: any }) {
  const { bai, chrToIndex, indexToChr } = data
  const [chr, setChr] = useState(indexToChr[0].refName)
  const [maxVal, setMaxVal] = useState('')
  const [currPos, setCurrPos] = useState<[number, number]>()
  return (
    <div>
      <label htmlFor="chr">Chromosome:</label>
      <select
        id="chr"
        value={chr}
        onChange={event => setChr(event.target.value)}
      >
        {indexToChr.map((name: { refName: string }) => (
          <option key={name.refName} value={name.refName}>
            {name.refName}
          </option>
        ))}
      </select>

      <label htmlFor="maxval">Set color scale maximum on graph (bytes):</label>
      <input
        id="maxval"
        type="text"
        value={maxVal}
        onChange={event => setMaxVal(event.target.value)}
      />

      <br />
      <Graph
        bai={bai.indices[chrToIndex[chr]]}
        maxVal={maxVal}
        setCurrPos={setCurrPos}
      />

      {currPos ? <FileLayout data={data} chr={chr} currPos={currPos} /> : null}
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

const sarscov2 =
  'https://s3.amazonaws.com/jbrowse.org/genomes/sars-cov2/LSPA-3EBF5EC.220708_A01404_0494_BH3J3TDRX2.2t183.bam'

function App() {
  const [bamUrl, setBamUrl] = useState(illumina)
  const [baiUrl, setBaiUrl] = useState(illumina + '.bai')
  const [data, setData] = useState<any>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    ;(async () => {
      try {
        setError(undefined)
        setData(undefined)
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
                className="urlinput"
                value={bamUrl}
                onChange={event => setBamUrl(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="url">BAI URL: </label>
              <input
                id="bai"
                type="text"
                className="urlinput"
                value={baiUrl}
                onChange={event => setBaiUrl(event.target.value)}
              />
            </div>
          </div>
          <div className="buttons">
            <div>Example files:</div>
            <button
              onClick={() => {
                setBamUrl(nanopore)
                setBaiUrl(nanopore + '.bai')
              }}
            >
              Nanopore ultralong (hg19, 60Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(pacbio)
                setBaiUrl(pacbio + '.bai')
              }}
            >
              PacBio CLR reads (hg19, 100Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(pacbio2)
                setBaiUrl(pacbio2 + '.bai')
              }}
            >
              PacBio HiFi reads (hg19, 2Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(illumina)
                setBaiUrl(illumina + '.bai')
              }}
            >
              Illumina reads (hg19, 9Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(isoseq)
                setBaiUrl(isoseq + '.bai')
              }}
            >
              PacBio IsoSeq (hg19, 1.5Mb BAI)
            </button>
            <button
              onClick={() => {
                setBamUrl(sarscov2)
                setBaiUrl(sarscov2 + '.bai')
              }}
            >
              SARS-CoV2 (4kb BAI)
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
