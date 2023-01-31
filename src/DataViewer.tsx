import React, { useState } from 'react'

// locals
import Graph from './Graph'
import FileLayout from './FileLayout'

export default function DataViewer({ data }: { data: any }) {
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
