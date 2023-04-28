import React, { useEffect, useState } from 'react'

// locals
import Graph from './Graph'
import FileLayout from './FileLayout'
import { BamData } from './util'

export default function DataViewer({ data }: { data: BamData }) {
  const { bai, chrToIndex, indexToChr } = data
  const [chr, setChr] = useState(indexToChr[0].refName)
  const [maxVal, setMaxVal] = useState('')
  const [currPos, setCurrPos] = useState<[number, number]>()
  useEffect(() => {
    setChr(indexToChr[0].refName)
  }, [chrToIndex, indexToChr, bai])

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
      <p>
        The above diagram shows the distribution of data in the bins from the
        binning index for a particular chromosome. The binning index has 6
        levels of bins, and each level can address 536Mbp of genomic coordinates
        (this is the maximum size of a single chromosome that BAI can index). We
        use the "reg2bin" function (see SAMv1.pdf) to map a given coordinate
        region query (reg) to a set of bins to look in. The bins then tell us
        where to look in the BAM file. The different bin levels are needed when
        e.g. a read crosses a boundary between two bins, in this case, it's
        placed into a larger bin. Longer reads can trigger this, but short reads
        can too when they just happen to cross a boundary.The bins from the
        different levels overlap (you can visually see this, all 6 levels cover
        the same genomic space) but we can deduplicate the bins to make a
        smaller number of read requests from the file. The below diagram shows
        the exact byte range requests made to the file for the currently viewed
        region in the above diagram.
      </p>

      {currPos ? <FileLayout data={data} chr={chr} currPos={currPos} /> : null}
    </div>
  )
}
