import { useEffect, useState, useRef, useCallback } from 'react'
import { BlobFile } from 'generic-filehandle2'
import { BamFile, BAI } from '@gmod/bam'
import DataViewer from './DataViewer'
import type { BamData } from './util'

const exampleFiles = [
  {
    name: 'Illumina reads (hg19, HG002 2x250bp)',
    url: 'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/NIST_Illumina_2x250bps/novoalign_bams/HG002.hs37d5.2x250.bam',
  },
  {
    name: 'Nanopore ultralong (hg19, HG002)',
    url: 'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/guppy-V3.4.5/HG002_hs37d5_ONT-UL_GIAB_20200204.bam',
  },
  {
    name: 'PacBio CLR reads (hg19, SKBR3)',
    url: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.down.bam',
  },
  {
    name: 'PacBio HiFi reads (hg19, HG002 SequelII)',
    url: 'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/PacBio_SequelII_CCS_11kb/HG002.SequelII.pbmm2.hs37d5.whatshap.haplotag.RTG.10x.trio.bam',
  },
  {
    name: 'PacBio IsoSeq (hg19)',
    url: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/alzheimers_isoseq/hq_isoforms.fasta.bam',
  },
  {
    name: 'SARS-CoV2 (small BAI, zoom in on left)',
    url: 'https://s3.amazonaws.com/jbrowse.org/genomes/sars-cov2/LSPA-3EBF5EC.220708_A01404_0494_BH3J3TDRX2.2t183.bam',
  },
]

async function fetchWithProgress(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number | null) => void,
) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  const contentLength = response.headers.get('Content-Length')
  const total = contentLength ? Number.parseInt(contentLength, 10) : null
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    chunks.push(value)
    loaded += value.length
    onProgress(loaded, total)
  }

  const result = new Uint8Array(loaded)
  let position = 0
  for (const chunk of chunks) {
    result.set(chunk, position)
    position += chunk.length
  }
  return result
}

function App() {
  const [bamUrl, setBamUrl] = useState(exampleFiles[0]!.url)
  const [baiUrl, setBaiUrl] = useState(exampleFiles[0]!.url + '.bai')
  const bamLocal = useRef<HTMLInputElement>(null)
  const baiLocal = useRef<HTMLInputElement>(null)
  const helpDialogRef = useRef<HTMLDialogElement>(null)
  const [useLocal, setUseLocal] = useState(false)
  const [data, setData] = useState<BamData>()
  const [error, setError] = useState<unknown>()
  const [localBamFile, setLocalBamFile] = useState<File>()
  const [localBaiFile, setLocalBaiFile] = useState<File>()
  const [downloadProgress, setDownloadProgress] = useState<{
    loaded: number
    total: number | null
  } | null>(null)

  const localsLoaded = localBamFile && localBaiFile

  const openHelp = useCallback(() => {
    helpDialogRef.current?.showModal()
  }, [])

  const closeHelp = useCallback(() => {
    helpDialogRef.current?.close()
  }, [])

  const handleDialogClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === helpDialogRef.current) {
        closeHelp()
      }
    },
    [closeHelp],
  )

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        setData(undefined)
        setDownloadProgress(null)

        let bam
        if (useLocal) {
          if (localBamFile && localBaiFile) {
            bam = new BamFile({
              bamFilehandle: new BlobFile(localBamFile),
              baiFilehandle: new BlobFile(localBaiFile),
            })
          } else {
            return
          }
        } else {
          const baiData = await fetchWithProgress(
            baiUrl,
            signal,
            (loaded, total) => {
              setDownloadProgress({ loaded, total })
            },
          )
          bam = new BamFile({
            bamUrl,
            baiFilehandle: new BlobFile(new Blob([baiData])),
          })
        }
        const header = await bam.getHeader()
        const { index, indexToChr, chrToIndex } = bam

        if (index instanceof BAI && indexToChr && chrToIndex && header) {
          const bai = await index.parse()
          if (!signal.aborted) {
            setData({ bam, indexToChr, chrToIndex, bai, header })
            setDownloadProgress(null)
          }
        }
      } catch (error_) {
        if (!signal.aborted) {
          setError(error_)
          setDownloadProgress(null)
          console.error(error_)
        }
      }
    })()
    return () => {
      controller.abort()
    }
  }, [bamUrl, baiUrl, useLocal, localBamFile, localBaiFile])

  return (
    <div className="App">
      <div>
        <div className="app-header">
          <h1>BAM index visualizer</h1>
          <button onClick={openHelp}>Help</button>
        </div>
        <dialog ref={helpDialogRef} onClick={handleDialogClick}>
          <h3>What is a BAI file?</h3>
          <p>
            The BAI (BAM index) lets clients fetch only the data needed for a
            query (e.g. chr1:1-100) without downloading the whole BAM. It stores
            bins, each containing byte-range pointers into the BAM.
          </p>
          <h3>How does this work?</h3>
          <h4>Bin Index</h4>
          <p>
            6 levels of bins cover up to 536Mbp. The "reg2bin" function
            (SAMv1.pdf) maps a query region to the relevant bins. Reads that
            cross bin boundaries are placed in a larger bin, so all levels
            overlap the same genomic space. Deduplication reduces the number of
            actual fetch requests.
          </p>
          <h4>Linear Index Coverage</h4>
          <p>
            Virtual file offsets stored every 16kb. Differencing consecutive
            offsets estimates data density per window, the same technique used
            by{' '}
            <a
              href="https://github.com/brentp/indexcov"
              target="_blank"
              rel="noopener noreferrer"
            >
              indexcov
            </a>
            .
          </p>
          <h4>Request pattern</h4>
          <p>
            Byte-range requests for the currently viewed region. Updates as you
            zoom the bin index.
          </p>
          <h4>Block overview</h4>
          <p>
            Lists the bins being requested. Fetch from the BAM to see
            short-circuiting in action: fetching stops once a read beyond the
            query range is found (SAMv1.pdf Sec 5.1.1).
          </p>
          <h4>Notes</h4>
          <p>
            Index block sizes shown may exceed actual bytes downloaded because
            fetching aborts early. The de-duplicate option uses the linear index
            to exclude bins before the query range. Genome browsers sometimes
            avoid merging too many blocks to keep memory use bounded during
            decompression.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
            }}
          >
            <a
              href="https://github.com/cmdcolin/bam_index_visualizer"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source code
            </a>
            <button onClick={closeHelp}>Close</button>
          </div>
        </dialog>
        <div className="form">
          <fieldset>
            <legend>Open file:</legend>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="source"
                  value="url"
                  checked={!useLocal}
                  onChange={() => {
                    setUseLocal(false)
                  }}
                />
                URLs
              </label>
              <label>
                <input
                  type="radio"
                  name="source"
                  value="local"
                  checked={useLocal}
                  onChange={() => {
                    setUseLocal(true)
                  }}
                />
                Local files
              </label>
            </div>
            {useLocal ? (
              <div className="file-inputs">
                <label>
                  BAM{' '}
                  <input
                    type="file"
                    ref={bamLocal}
                    onChange={event => {
                      setLocalBamFile(event.target.files?.[0])
                    }}
                  />
                </label>
                <label>
                  BAI{' '}
                  <input
                    type="file"
                    ref={baiLocal}
                    onChange={event => {
                      setLocalBaiFile(event.target.files?.[0])
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="url-inputs">
                <div className="url-fields">
                  <div className="url-row">
                    <label htmlFor="bam">BAM</label>
                    <input
                      id="bam"
                      type="text"
                      value={bamUrl}
                      onChange={event => {
                        setBamUrl(event.target.value)
                      }}
                    />
                  </div>
                  <div className="url-row">
                    <label htmlFor="bai">BAI</label>
                    <input
                      id="bai"
                      type="text"
                      value={baiUrl}
                      onChange={event => {
                        setBaiUrl(event.target.value)
                      }}
                    />
                  </div>
                </div>
                <div className="example-buttons">
                  <span>Examples:</span>
                  {exampleFiles.map(file => (
                    <button
                      key={file.url}
                      onClick={() => {
                        setBamUrl(file.url)
                        setBaiUrl(file.url + '.bai')
                      }}
                    >
                      {file.name}
                    </button>
                  ))}
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
          {useLocal ? (
            localsLoaded ? (
              'Loading...'
            ) : (
              ''
            )
          ) : downloadProgress ? (
            <div>
              Downloading BAI:{' '}
              {(downloadProgress.loaded / 1024 / 1024).toFixed(2)} MB
              {downloadProgress.total
                ? ` / ${(downloadProgress.total / 1024 / 1024).toFixed(2)} MB (${Math.round((downloadProgress.loaded / downloadProgress.total) * 100)}%)`
                : ' (size unknown)'}
            </div>
          ) : (
            'Loading...'
          )}
        </div>
      )}
    </div>
  )
}

export default App
