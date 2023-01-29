import Chunk from './chunk'
import VirtualOffset from './virtualOffset'

export function sum(arr: number[]) {
  let sum = 0
  let len = arr.length
  for (let i = 0; i < len; i++) {
    sum += arr[i]
  }
  return sum
}

export function max(arr: number[]) {
  let max = -Infinity
  let len = arr.length
  for (let i = 0; i < len; i++) {
    max = Math.max(max, arr[i])
  }
  return max
}

export function min(arr: number[]) {
  let min = Infinity
  let len = arr.length
  for (let i = 0; i < len; i++) {
    min = Math.min(min, arr[i])
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

export function canMergeBlocks(chunk1: Chunk, chunk2: Chunk) {
  return (
    chunk2.minv.blockPosition - chunk1.maxv.blockPosition < 65000 &&
    chunk2.maxv.blockPosition - chunk1.minv.blockPosition < 5000000
  )
}

export function optimizeChunks(chunks: Chunk[], lowest: VirtualOffset) {
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

  chunks.forEach(chunk => {
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
  })

  return mergedChunks
}
