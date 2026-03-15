import { colors, fmt } from './util'
export function TotalsPerBin({ totalPerBin }: { totalPerBin?: number[] }) {
  return (
    <>
      {totalPerBin ? (
        <div>
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
