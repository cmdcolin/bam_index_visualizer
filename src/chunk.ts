import type VirtualOffset from './virtualOffset'

// little class representing a chunk in the index
export default class Chunk {
  constructor(
    public minv: VirtualOffset,
    public maxv: VirtualOffset,
    public bin: number,
  ) {}

  compareTo(b: Chunk) {
    return (
      this.minv.compareTo(b.minv) ||
      this.maxv.compareTo(b.maxv) ||
      this.bin - b.bin
    )
  }

  fetchedSize() {
    return this.maxv.blockPosition - this.minv.blockPosition
  }
  toUniqueString() {
    return `${Math.random()}`
  }
}
