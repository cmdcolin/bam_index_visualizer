import { unzip } from '@gmod/bgzf-filehandle'

import type { Chunk } from './util'
import type { GenericFilehandle } from 'generic-filehandle2'

export interface BgzfBlock {
  index: number
  filePosition: number
  compressedSize: number
  uncompressedSize: number
  decompressedOffset: number
}

function blockSizeAt(buf: Uint8Array, view: DataView, offset: number) {
  const xlen = view.getUint16(offset + 10, true)
  let sub = offset + 12
  let bsize: number | undefined
  while (sub + 4 <= offset + 12 + xlen && bsize === undefined) {
    const slen = view.getUint16(sub + 2, true)
    if (buf[sub] === 66 && buf[sub + 1] === 67 && slen === 2) {
      bsize = view.getUint16(sub + 4, true) + 1
    }
    sub += 4 + slen
  }
  return bsize
}

export function parseBgzfBlocks(buf: Uint8Array, filePosition: number) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const blocks: BgzfBlock[] = []
  let offset = 0
  let decompressedOffset = 0
  let done = false
  while (!done && offset + 18 <= buf.length) {
    const isBgzf = buf[offset] === 31 && buf[offset + 1] === 139
    const size = isBgzf ? blockSizeAt(buf, view, offset) : undefined
    if (size !== undefined && offset + size <= buf.length) {
      const uncompressedSize = view.getUint32(offset + size - 4, true)
      blocks.push({
        index: blocks.length,
        filePosition: filePosition + offset,
        compressedSize: size,
        uncompressedSize,
        decompressedOffset,
      })
      offset += size
      decompressedOffset += uncompressedSize
    } else {
      done = true
    }
  }
  return { blocks, completeBytes: offset }
}

const CIGAR_CONSUMES_REF = new Set([0, 2, 3, 7, 8])

function refLengthAt(view: DataView, cigarStart: number, nCigar: number) {
  let refLength = 0
  for (let i = 0; i < nCigar; i++) {
    const op = view.getUint32(cigarStart + i * 4, true)
    if (CIGAR_CONSUMES_REF.has(op & 15)) {
      refLength += op >>> 4
    }
  }
  return refLength
}

function grow<T extends Float64Array | Int32Array | Uint16Array>(
  arr: T,
  make: (n: number) => T,
) {
  const next = make(arr.length * 2)
  next.set(arr)
  return next
}

function parseRecords(data: Uint8Array, begin: number, end: number) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const initial = Math.max(Math.ceil((end - begin) / 200), 16)
  let start = new Float64Array(initial)
  let refId = new Int32Array(initial)
  let pos = new Int32Array(initial)
  let refEnd = new Int32Array(initial)
  let flag = new Uint16Array(initial)
  let count = 0
  let offset = begin
  while (offset + 4 <= data.length && offset < end) {
    const blockSize = view.getInt32(offset, true)
    if (offset + 4 + blockSize <= data.length) {
      if (count === start.length) {
        start = grow(start, n => new Float64Array(n))
        refId = grow(refId, n => new Int32Array(n))
        pos = grow(pos, n => new Int32Array(n))
        refEnd = grow(refEnd, n => new Int32Array(n))
        flag = grow(flag, n => new Uint16Array(n))
      }
      const p = view.getInt32(offset + 8, true)
      const cigarStart = offset + 36 + (data[offset + 12] ?? 0)
      start[count] = offset
      refId[count] = view.getInt32(offset + 4, true)
      pos[count] = p
      refEnd[count] =
        p +
        Math.max(
          refLengthAt(view, cigarStart, view.getUint16(offset + 16, true)),
          1,
        )
      flag[count] = view.getUint16(offset + 18, true)
      count++
    }
    offset += 4 + blockSize
  }
  return { count, start, refId, pos, refEnd, flag }
}

export type RecordColumns = ReturnType<typeof parseRecords>

export interface RecordField {
  name: string
  start: number
  length: number
}

export function recordLayout(data: Uint8Array, start: number) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const blockSize = view.getInt32(start, true)
  const end = start + 4 + blockSize
  const lReadName = data[start + 12] ?? 0
  const nCigar = view.getUint16(start + 16, true)
  const lSeq = view.getInt32(start + 20, true)
  const nameStart = start + 36
  const cigarStart = nameStart + lReadName
  const seqStart = cigarStart + nCigar * 4
  const qualStart = seqStart + ((lSeq + 1) >> 1)
  const tagStart = qualStart + lSeq
  const pos = view.getInt32(start + 8, true)
  const fields: RecordField[] = [
    { name: 'block_size', start, length: 4 },
    { name: 'fixed fields', start: start + 4, length: 32 },
    { name: 'read name', start: nameStart, length: lReadName },
    { name: 'CIGAR', start: cigarStart, length: nCigar * 4 },
    { name: 'sequence', start: seqStart, length: qualStart - seqStart },
    { name: 'qualities', start: qualStart, length: lSeq },
    { name: 'tags', start: tagStart, length: end - tagStart },
  ]
  return {
    start,
    end,
    refId: view.getInt32(start + 4, true),
    pos,
    refEnd: pos + Math.max(refLengthAt(view, cigarStart, nCigar), 1),
    mapq: data[start + 13] ?? 0,
    flag: view.getUint16(start + 18, true),
    lSeq,
    readName: new TextDecoder().decode(
      data.subarray(nameStart, cigarStart - 1),
    ),
    fields,
  }
}

export type BamRecordLayout = ReturnType<typeof recordLayout>

export async function inspectChunk(file: GenericFilehandle, chunk: Chunk) {
  const fetchStart = chunk.minv.blockPosition
  const buf = await file.read(chunk.fetchedSize(), fetchStart)
  const { blocks, completeBytes } = parseBgzfBlocks(buf, fetchStart)
  const data: Uint8Array = await unzip(buf.subarray(0, completeBytes))
  const maxvBlock = blocks.find(
    b => b.filePosition === chunk.maxv.blockPosition,
  )
  const begin = chunk.minv.dataPosition
  const end = maxvBlock
    ? maxvBlock.decompressedOffset + chunk.maxv.dataPosition
    : data.length
  return {
    fetchStart,
    fetchedBytes: buf.length,
    completeBytes,
    blocks,
    data,
    begin,
    end,
    records: parseRecords(data, begin, end),
  }
}

export type ChunkInspection = Awaited<ReturnType<typeof inspectChunk>>

export function blockOf(blocks: BgzfBlock[], decompressed: number) {
  return blocks.findLast(b => b.decompressedOffset <= decompressed)
}

export function overlapsQuery(
  records: RecordColumns,
  i: number,
  refId: number,
  start: number,
  end: number,
) {
  return (
    records.refId[i] === refId &&
    (records.pos[i] ?? 0) < end &&
    (records.refEnd[i] ?? 0) > start
  )
}
