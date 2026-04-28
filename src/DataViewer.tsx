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
          <label htmlFor="maxval">Max value (bytes):</label>
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
        {baiForChr ? (
          <Graph bai={baiForChr} maxVal={maxVal} setCurrPos={setCurrPos} />
        ) : null}
        {currPos ? (
          <FileLayout data={data} chr={chr} currPos={currPos} />
        ) : null}
      </div>
    </div>
  )
}
