import type { BAI, BamFile } from '@gmod/bam'

export type BaiParsed = Awaited<ReturnType<BAI['parse']>>
export type RefIndex = NonNullable<ReturnType<BaiParsed['indices']>>
export type Chunk = RefIndex['binIndex'][number][number]
export type VirtualOffset = RefIndex['linearIndex'][number]

export function sum(arr: number[]) {
  let sum = 0
  for (const element of arr) {
    sum += element
  }
  return sum
}

export function max(arr: number[]) {
  let max = Number.NEGATIVE_INFINITY
  for (const element of arr) {
    if (element > max) {
      max = element
    }
  }
  return max
}

export function min(arr: number[]) {
  let min = Number.POSITIVE_INFINITY
  for (const element of arr) {
    if (element < min) {
      min = element
    }
  }
  return min
}

export function reg2bins(beg: number, end: number): [number, number][] {
  end -= 1
  return [
    [0, 0],
    [1 + (beg >> 26), 1 + (end >> 26)],
    [9 + (beg >> 23), 9 + (end >> 23)],
    [73 + (beg >> 20), 73 + (end >> 20)],
    [585 + (beg >> 17), 585 + (end >> 17)],
    [4681 + (beg >> 14), 4681 + (end >> 14)],
  ]
}

export function canMergeBlocks(chunk1: Chunk, chunk2: Chunk) {
  return (
    chunk2.minv.blockPosition - chunk1.maxv.blockPosition < 65_000 &&
    chunk2.maxv.blockPosition - chunk1.minv.blockPosition < 5_000_000
  )
}

export function optimizeChunks(
  chunks: Chunk[],
  lowest: VirtualOffset | null,
  dedupe: boolean,
): Chunk[] {
  const mergedChunks: Chunk[] = []
  let lastChunk: Chunk | null = null

  if (chunks.length === 0) {
    return chunks
  }

  chunks.sort((c0, c1) => {
    const dif = c0.minv.blockPosition - c1.minv.blockPosition
    return dif === 0 ? c0.minv.dataPosition - c1.minv.dataPosition : dif
  })
  if (dedupe) {
    for (const chunk of chunks) {
      if (!lowest || chunk.maxv.compareTo(lowest) > 0) {
        if (lastChunk === null) {
          mergedChunks.push(chunk)
          lastChunk = chunk
        } else {
          if (canMergeBlocks(lastChunk, chunk)) {
            if (chunk.maxv.compareTo(lastChunk.maxv) > 0) {
              lastChunk.maxv = chunk.maxv
            }
          } else {
            mergedChunks.push(chunk)
            lastChunk = chunk
          }
        }
      }
    }
    return mergedChunks
  }
  return chunks
}

export function fmt(n: number, fixed = 2) {
  if (n > 1_000_000_000) {
    return f(n / 1_000_000_000, fixed) + 'Gb'
  } else if (n > 1_000_000) {
    return f(n / 1_000_000, fixed) + 'Mb'
  } else if (n > 1000) {
    return f(n / 1000, fixed) + 'kb'
  } else {
    return f(n, fixed) + 'bytes'
  }
}

function f(n: number, fixed = 0) {
  const str = fixed > 0 ? n.toFixed(fixed) : Math.round(n).toString()
  const [intPart, decPart] = str.split('.')
  const withCommas = intPart!.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart ? `${withCommas}.${decPart}` : withCommas
}

export function fmt2(n: number, fixed = 1, showUnit = true) {
  n = Math.min(Math.max(0, n), 2 ** 29 - 1)
  let unit: string
  let val: string
  if (n > 1000 * 1000 * 1000) {
    val = f(n / (1000 * 1000 * 1000), fixed)
    unit = 'Gbp'
  } else if (n > 1000 * 1000) {
    val = f(n / (1000 * 1000), fixed)
    unit = 'Mbp'
  } else if (n > 1000) {
    val = f(n / 1000, fixed)
    unit = 'kbp'
  } else {
    val = f(n, fixed)
    unit = 'bp'
  }
  val = val.replace(/\.0+$/, '')
  return showUnit ? val + unit : val
}

export function getChunks(
  s: number,
  e: number,
  ba: RefIndex,
  optimize: boolean,
): Chunk[] {
  const chunks = [] as Chunk[]
  const bins = reg2bins(s, e)
  for (const [start, end] of bins) {
    for (let bin = start; bin <= end; bin++) {
      const binChunks = ba.binIndex[bin]
      if (binChunks) {
        for (const binChunk of binChunks) {
          chunks.push(binChunk)
        }
      }
    }
  }

  // Use the linear index to find minimum file position of chunks that could
  // contain alignments in the region
  const nintv = ba.linearIndex.length
  let lowest = null
  const minLin = Math.min(s >> 14, nintv - 1)
  const maxLin = Math.min(e >> 14, nintv - 1)
  for (let i = minLin; i <= maxLin; ++i) {
    const vp = ba.linearIndex[i]
    if (vp && (!lowest || vp.compareTo(lowest) < 0)) {
      lowest = vp
    }
  }

  return optimizeChunks(chunks, lowest, optimize)
}

export const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

export interface BamData {
  bam: BamFile
  bai: BaiParsed
  indexToChr: {
    refName: string
    length: number
  }[]
  chrToIndex: Record<string, number>
  header: unknown
}
