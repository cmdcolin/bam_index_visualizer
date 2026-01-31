import { useState } from 'react'

// locals
import Graph from './Graph'
import FileLayout from './FileLayout'
import type { BamData } from './util'

export default function DataViewer({ data }: { data: BamData }) {
  const { bai, chrToIndex, indexToChr } = data
  const [chr, setChr] = useState(indexToChr[0]!.refName)
  const [maxVal, setMaxVal] = useState('')
  const [currPos, setCurrPos] = useState<[number, number]>()
  const [lastBai, setLastBai] = useState(bai)

  if (bai !== lastBai) {
    setChr(indexToChr[0]!.refName)
    setLastBai(bai)
  }

  const chrIdx = chrToIndex[chr]
  const baiForChr = chrIdx === undefined ? undefined : bai.indices(chrIdx)

  return (
    <div>
      <div className="controls">
        <div>
          <label htmlFor="chr">Chromosome:</label>
          <select
            id="chr"
            value={chr}
            onChange={event => {
              setChr(event.target.value)
            }}
          >
            {indexToChr.map((name: { refName: string }) => (
              <option key={name.refName} value={name.refName}>
                {name.refName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="maxval">Color scale max (bytes):</label>
          <input
            id="maxval"
            type="text"
            value={maxVal}
            onChange={event => {
              setMaxVal(event.target.value)
            }}
          />
        </div>
      </div>

      <div className="visualization-panel">
        <div className="panel-header">
          <h3>Bin Index Structure → Request Pattern</h3>
          <p className="panel-subtitle">
            Zoom into the bin index (top) to see the corresponding byte-range
            requests (bottom)
          </p>
        </div>
        {baiForChr ? (
          <Graph bai={baiForChr} maxVal={maxVal} setCurrPos={setCurrPos} />
        ) : null}
        {currPos ? <FileLayout data={data} chr={chr} currPos={currPos} /> : null}
      </div>

      <details className="explanation">
        <summary>How does this work?</summary>
        <p>
          The <strong>Bin Index</strong> shows the distribution of data in the
          bins from the binning index for a particular chromosome. The binning
          index has 6 levels of bins, and each level can address 536Mbp of
          genomic coordinates (this is the maximum size of a single chromosome
          that BAI can index). We use the "reg2bin" function (see SAMv1.pdf) to
          map a given coordinate region query (reg) to a set of bins to look in.
          The bins then tell us where to look in the BAM file.
        </p>
        <p>
          The different bin levels are needed when e.g. a read crosses a
          boundary between two bins, in this case, it's placed into a larger
          bin. Longer reads can trigger this, but short reads can too when they
          just happen to cross a boundary. The bins from the different levels
          overlap (you can visually see this, all 6 levels cover the same
          genomic space) but we can deduplicate the bins to make a smaller
          number of read requests from the file.
        </p>
        <p>
          The <strong>Linear Index Coverage</strong> shows the coverage estimate
          from the BAI linear index. The linear index stores virtual file
          offsets at 16kb genomic intervals. By calculating the difference
          between consecutive offsets, we can estimate data density (coverage)
          in each 16kb window. This technique is used by tools like{' '}
          <a
            href="https://github.com/brentp/indexcov"
            target="_blank"
            rel="noopener noreferrer"
          >
            indexcov
          </a>{' '}
          to quickly estimate coverage across the genome without reading the
          actual BAM data.
        </p>
        <p>
          The file layout diagram shows the exact byte range requests made to
          the file for the currently viewed region.
        </p>
      </details>
    </div>
  )
}
