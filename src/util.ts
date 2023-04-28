import { useState, useEffect } from 'react'
import Chunk from './chunk'
import VirtualOffset from './virtualOffset'
import { BAI, BamFile } from '@gmod/bam'

export function sum(arr: number[]) {
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
  }
  return sum
}

export function max(arr: number[]) {
  let max = -Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i]
    }
  }
  return max
}

export function min(arr: number[]) {
  let min = Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) {
      min = arr[i]
    }
  }
  return min
}

export function avg(arr: number[]) {
  return sum(arr) / arr.length
}

export function median(arr: number[]) {
  if (arr.length == 0) {
    return 0
  }
  arr.sort((a, b) => a - b)
  const midpoint = Math.floor(arr.length / 2)
  return arr.length % 2 === 1
    ? arr[midpoint]
    : (arr[midpoint - 1] + arr[midpoint]) / 2
}

export function reg2bins(beg: number, end: number) {
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

export function canMergeBlocks(
  chunk1: Chunk,
  chunk2: Chunk,
  dontMergeLarge: boolean,
) {
  return (
    chunk2.minv.blockPosition - chunk1.maxv.blockPosition < 65000 &&
    chunk2.maxv.blockPosition - chunk1.minv.blockPosition < 5000000
  )
}

export function optimizeChunks(
  chunks: Chunk[],
  lowest: VirtualOffset,
  dedupe: boolean,
  dontMergeLarge: boolean,
) {
  const mergedChunks: Chunk[] = []
  let lastChunk: Chunk | null = null

  if (chunks.length === 0) {
    return chunks
  }

  chunks.sort((c0, c1) => {
    const dif = c0.minv.blockPosition - c1.minv.blockPosition
    if (dif !== 0) {
      return dif
    } else {
      return c0.minv.dataPosition - c1.minv.dataPosition
    }
  })
  if (dedupe) {
    chunks.forEach(chunk => {
      if (!lowest || chunk.maxv.compareTo(lowest) > 0) {
        if (lastChunk === null) {
          mergedChunks.push(chunk)
          lastChunk = chunk
        } else {
          if (canMergeBlocks(lastChunk, chunk, dontMergeLarge)) {
            if (chunk.maxv.compareTo(lastChunk.maxv) > 0) {
              lastChunk.maxv = chunk.maxv
            }
          } else {
            mergedChunks.push(chunk)
            lastChunk = chunk
          }
        }
      }
    })
    return mergedChunks
  }
  return chunks
}

export function fmt(n: number, fixed = 2) {
  if (n > 1_000_000_000) {
    return f(n / 1_000_000_000, fixed) + 'Gb'
  } else if (n > 1_000_000) {
    return f(n / 1_000_000, fixed) + 'Mb'
  } else if (n > 1_000) {
    return f(n / 1_000, fixed) + 'kb'
  } else {
    return f(n, fixed) + 'bytes'
  }
}

function f(n: number, fixed = 0) {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: fixed,
  })
}

export function fmt2(n: number, fixed = 1) {
  n = Math.min(Math.max(0, n), 2 ** 29 - 1)
  if (n > 1000 * 1000 * 1000) {
    return f(n / (1000 * 1000 * 1000), fixed) + 'Gbp'
  } else if (n > 1000 * 1000) {
    return f(n / (1000 * 1000), fixed) + 'Mbp'
  } else if (n > 1000) {
    return f(n / 1000, fixed) + 'kbp'
  } else return f(n, fixed) + 'bp'
}

export function getChunks(
  s: number,
  e: number,
  ba: any,
  optimize: boolean,
  dontMergeLarge: boolean,
) {
  const chunks = [] as Chunk[]
  const bins = reg2bins(s, e)
  for (const [start, end] of bins) {
    for (let bin = start; bin <= end; bin++) {
      if (ba.binIndex[bin]) {
        const binChunks = ba.binIndex[bin]
        for (let c = 0; c < binChunks.length; ++c) {
          chunks.push(binChunks[c])
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
    if (vp) {
      if (!lowest || vp.compareTo(lowest) < 0) {
        lowest = vp
      }
    }
  }

  return optimizeChunks(chunks, lowest, optimize, dontMergeLarge)
}

export const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

export function useDebounce(value: any, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export interface BamData {
  bam: BamFile
  bai: Awaited<ReturnType<BAI['parse']>>
  indexToChr: {
    refName: string
    length: number
  }[]
  chrToIndex: Record<string, number>
  header: unknown
}
