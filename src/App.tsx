import { useEffect, useState, useRef, useCallback } from 'react'
import { BlobFile } from 'generic-filehandle2'
import { BamFile } from '@gmod/bam'
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
  onProgress: (loaded: number, total: number | null) => void,
) {
  const response = await fetch(url)
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
          const baiData = await fetchWithProgress(baiUrl, (loaded, total) => {
            setDownloadProgress({ loaded, total })
          })
          bam = new BamFile({
            bamUrl,
            baiFilehandle: new BlobFile(new Blob([baiData])),
          })
        }
        setDownloadProgress(null)
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
        setDownloadProgress(null)
        console.error(error_)
      }
    })()
  }, [bamUrl, baiUrl, useLocal, localBamFile, localBaiFile])

  return (
    <div className="App">
      <div>
        <h2>BAM index visualizer</h2>
        <button onClick={openHelp}>Help</button>
        <p>
          This is a project that helps visualize the structure of the bin index
          of BAM index (BAI) files.
        </p>
        <dialog ref={helpDialogRef} onClick={handleDialogClick}>
          <h3>What is a BAI file?</h3>
          <p>
            The BAI (BAM index) allows users to download only the data that is
            needed for a particular query e.g. chr1:1-100 from a BAM file. The
            BAI is significantly smaller than a BAM and is read into memory. It
            contains bins, which themselves contain one of more "start and end"
            pointers to where in the BAM file to look for the reads for your
            query. This program will show you what this bin structure looks like
            in a given BAI file.
          </p>
          <h3>How does this work?</h3>
          <p>
            The top diagram shows the distribution of data in the bins from the
            binning index for a particular chromosome. The binning index has 6
            levels of bins, and each level can address 536Mbp of genomic
            coordinates (this is the maximum size of a single chromosome that
            BAI can index). We use the "reg2bin" function (see SAMv1.pdf) to map
            a given coordinate region query (reg) to a set of bins to look in.
            The bins then tell us where to look in the BAM file.
          </p>
          <p>
            The different bin levels are needed when e.g. a read crosses a
            boundary between two bins, in this case, it's placed into a larger
            bin. Longer reads can trigger this, but short reads can too when
            they just happen to cross a boundary. The bins from the different
            levels overlap (you can visually see this, all 6 levels cover the
            same genomic space) but we can deduplicate the bins to make a
            smaller number of read requests from the file.
          </p>
          <p>
            The bottom diagram shows the exact byte range requests made to the
            file for the currently viewed region in the top diagram.
          </p>
          <h4>The bin index visualization</h4>
          <p>
            The first chart shows the 536Mbp overview. This is because the bins
            for the BAI cannot address chromosomes larger than 536Mbp (2^29-1),
            and so this graph shows this "total overview". Bins are colored by
            how much data are in them scaled against the largest bin. You can
            click and drag the grey bar above the view to "zoom in" or side
            scroll the canvas.
          </p>
          <h4>The request pattern</h4>
          <p>
            The second chart shows an overview of the byte ranges that would be
            requested from the BAM, and it is responsive to zooming in and out
            on the first chart.
          </p>
          <h4>Block overview</h4>
          <p>
            The third section lists which bins are being requested. Click the
            button to fetch data from the BAM file, which demonstrates
            short-circuiting: the program stops once it finds a read beyond the
            requested coordinate range.
          </p>
          <button onClick={closeHelp}>Close</button>
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
      <a href="https://github.com/cmdcolin/bam_index_visualizer">Github</a>
    </div>
  )
}

export default App
