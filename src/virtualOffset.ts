export default class VirtualOffset {
  public blockPosition: number
  public dataPosition: number
  constructor(blockPosition: number, dataPosition: number) {
    this.blockPosition = blockPosition // < offset of the compressed data block
    this.dataPosition = dataPosition // < offset into the uncompressed data
  }

  toString() {
    return `${this.blockPosition}:${this.dataPosition}`
  }

  compareTo(b: VirtualOffset) {
    return (
      this.blockPosition - b.blockPosition || this.dataPosition - b.dataPosition
    )
  }

  static min(...args: VirtualOffset[]) {
    let min: VirtualOffset | undefined
    for (const arg of args) {
      if (!min || min.compareTo(arg) > 0) {
        min = arg
      }
    }
    return min
  }
}
export function fromBytes(bytes: Uint8Array, offset = 0, bigendian = false) {
  if (bigendian) {
    throw new Error('big-endian virtual file offsets not implemented')
  }

  return new VirtualOffset(
    (bytes[offset + 7] ?? 0) * 0x1_00_00_00_00_00 +
      (bytes[offset + 6] ?? 0) * 0x1_00_00_00_00 +
      (bytes[offset + 5] ?? 0) * 0x1_00_00_00 +
      (bytes[offset + 4] ?? 0) * 0x1_00_00 +
      (bytes[offset + 3] ?? 0) * 0x1_00 +
      (bytes[offset + 2] ?? 0),
    ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset] ?? 0),
  )
}
