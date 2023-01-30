import React from 'react'
import { colors, fmt } from './util'
export function TotalsPerBin({
  total,
  totalPerBin,
}: {
  total: number
  totalPerBin?: number[]
}) {
  return (
    <>
      {totalPerBin ? (
        <div>
          <p>
            Canvas shows the requested byte-ranges of the BAM file from the
            coordinate query.
          </p>
          <p>
            Total size of blocks from index {fmt(total)}. Real data downloaded
            from BAM may be less because of [1], test this with the "Requested
            block overview" window
          </p>
          <div>
            On each bin level, data fetches amount to{' '}
            <ul>
              {totalPerBin.map((t, i) => (
                <li key={i}>
                  <div
                    style={{
                      background: colors[i],
                      width: 10,
                      height: 10,
                      display: 'inline-block',
                    }}
                  />{' '}
                  {i} - {fmt(t)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
