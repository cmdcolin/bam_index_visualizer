import React, { useEffect, useState, useRef } from 'react'
import { BlobFile } from 'generic-filehandle'
import { BamFile } from '@gmod/bam'
import DataViewer from './DataViewer'

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
  const [data, setData] = useState<any>()
  const [error, setError] = useState<unknown>()
  const [counter, setCounter] = useState(0)

  const n0 = bamLocal.current?.files?.[0]
  const n1 = baiLocal.current?.files?.[0]
  const localsLoaded = n0 && n1

  useEffect(() => {
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
  }, [bamUrl, baiUrl, counter, useLocal])

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
            <fieldset>
              <legend>Open file:</legend>

              <div>
                <input
                  type="radio"
                  id="local"
                  name="local"
                  value="local"
                  checked={useLocal}
                  onChange={() => setUseLocal(true)}
                />
                <label htmlFor="local">Local files</label>
              </div>

              <div>
                <input
                  type="radio"
                  id="url"
                  value="url"
                  onChange={() => setUseLocal(false)}
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
                      onChange={() => setCounter(counter + 1)}
                    />
                  </div>
                  <div>
                    <label htmlFor="bai_local">BAI</label>
                    <input
                      id="bai_local"
                      type="file"
                      ref={baiLocal}
                      onChange={() => setCounter(counter + 1)}
                    />
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </fieldset>
          </div>
        </div>
      </div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : !data ? (
        <div>
          {useLocal ? (localsLoaded ? 'Loading...' : '') : 'Loading...'}
        </div>
      ) : (
        <DataViewer data={data} />
      )}
    </div>
  )
}

export default App
