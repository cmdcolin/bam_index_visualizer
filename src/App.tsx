import { useEffect, useState, useRef } from 'react'
import { BlobFile } from 'generic-filehandle2'
import { BamFile } from '@gmod/bam'
import DataViewer from './DataViewer'
import type { BamData } from './util'

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
  const bamLocal = useRef<HTMLInputElement>(null)
  const baiLocal = useRef<HTMLInputElement>(null)
  const [useLocal, setUseLocal] = useState(false)
  const [data, setData] = useState<BamData>()
  const [error, setError] = useState<unknown>()
  const [counter, setCounter] = useState(0)
  const [hideHelp, setHideHelp] = useState(true)

  const n0 = bamLocal.current?.files?.[0]
  const n1 = baiLocal.current?.files?.[0]
  const localsLoaded = n0 && n1

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        setData(undefined)

        let bam
        if (useLocal) {
          const n0 = bamLocal.current?.files?.[0]
          const n1 = baiLocal.current?.files?.[0]
          if (n0 && n1) {
            bam = new BamFile({
              bamFilehandle: new BlobFile(n0),
              baiFilehandle: new BlobFile(n1),
            })
          } else {
            return
          }
        } else {
          bam = new BamFile({ bamUrl, baiUrl })
        }
        const header = await bam.getHeader()
        const indexToChr = bam.indexToChr
        const chrToIndex = bam.chrToIndex

        if (bam.index && indexToChr && chrToIndex && header) {
          const bai = await bam.index.parse()
          if ('bai' in bai && bai.bai) {
            setData({ bam, indexToChr, chrToIndex, bai, header })
          }
        }
      } catch (error_) {
        setError(error_)
        console.error(error_)
      }
    })()
  }, [bamUrl, baiUrl, counter, useLocal])

  return (
    <div className="App">
      <div>
        <h2>BAM index visualizer</h2>
        <button
          onClick={() => {
            setHideHelp(!hideHelp)
          }}
        >
          {hideHelp ? 'Show help' : 'Hide help'}
        </button>
        <p>
          This is a project that helps visualize the structure of the bin index
          of BAM index (BAI) files.
        </p>
        {hideHelp ? null : (
          <>
            <h4>What is a BAI file</h4>
            <p>
              The BAI (BAM index) allows users to download only the data that is
              needed for a particular query e.g. chr1:1-100 from a BAM file. The
              BAI is significantly smaller than a BAM and is read into memory.
              It contains bins, which themselves contain one of more "start and
              end" pointers to where in the BAM file to look for the reads for
              your query. This program will show you what this bin structure
              looks like in a given BAI file.
            </p>
            <p>
              The first chart below shows the 536Mbp overview. This is because
              the bins for the BAI cannot address chromosomes larger than 536Mbp
              (2^29-1), and so this graph shows this "total overview". Bins are
              colored by how much data are in them scaled against the largest
              bin. You can also click and drag the grey bar above the view to
              "zoom in" or side scroll the canvas.
            </p>
            <p>
              The second chart shows an overview of the byte ranges that would
              be requested from the BAM, and it is responsive to zooming in and
              out on the first chart.
            </p>
            <p>
              The third chart/table is the actual textual representation of
              which bins are being requested, and if you click the button, it
              will actually go and fetch the data from the BAM file, which will
              also demonstrate the short-circuiting action because not all the
              bins have to be requested: the program can stop once it finds a
              read in the BAM file that is beyond the genomic coordinate range
              being requested (also responsive to zooming in on the first chart)
            </p>
          </>
        )}
        <div className="form">
          <fieldset>
            <legend>Open file:</legend>

            <div>
              <input
                type="radio"
                id="local"
                name="local"
                value="local"
                checked={useLocal}
                onChange={() => {
                  setUseLocal(true)
                }}
              />
              <label htmlFor="local">Local files</label>
            </div>

            <div>
              <input
                type="radio"
                id="url"
                value="url"
                onChange={() => {
                  setUseLocal(false)
                }}
                checked={!useLocal}
              />
              <label htmlFor="url"> URLs</label>
            </div>
            {useLocal ? (
              <div>
                <div>
                  <label htmlFor="bam_local">BAM</label>
                  <input
                    id="bam_local"
                    type="file"
                    ref={bamLocal}
                    onChange={() => {
                      setCounter(counter + 1)
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="bai_local">BAI</label>
                  <input
                    id="bai_local"
                    type="file"
                    ref={baiLocal}
                    onChange={() => {
                      setCounter(counter + 1)
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="splitter">
                <div>
                  <div>
                    <label htmlFor="url">BAM URL: </label>
                    <input
                      id="bam"
                      type="text"
                      className="urlinput"
                      value={bamUrl}
                      onChange={event => {
                        setBamUrl(event.target.value)
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="url">BAI URL: </label>
                    <input
                      id="bai"
                      type="text"
                      className="urlinput"
                      value={baiUrl}
                      onChange={event => {
                        setBaiUrl(event.target.value)
                      }}
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
                    SARS-CoV2 (4kb BAI, all data is in basically a single BAI
                    bin, zoom in on left)
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        </div>
      </div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : data ? (
        <DataViewer data={data} />
      ) : (
        <div>
          {useLocal ? (localsLoaded ? 'Loading...' : '') : 'Loading...'}
        </div>
      )}
      <a href="https://github.com/cmdcolin/bam_index_visualizer">Github</a>
    </div>
  )
}

export default App
