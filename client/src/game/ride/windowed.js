import { Color, InstancedMesh, Matrix4 } from 'three'

/**
 * Instances along the road, drawn only within a window of metres around the rider.
 *
 * Items are sorted by metre, so the ones in view are always one contiguous run: each
 * frame a binary search finds it, and the run's matrices are copied into the instance
 * buffer only when it changes. One draw call, a bounded instance count (pooled: the
 * buffer is sized for the most that can ever be in view), nothing allocated per frame.
 * Frustum culling is off: the window is the culling.
 */
export class WindowedInstances {
  /**
   * @param {import('three').BufferGeometry} geometry
   * @param {import('three').Material} material
   * @param {{ m: number, matrix: Matrix4, color?: string|Color }[]} items sorted by m
   * @param {number} capacity most instances ever shown at once
   */
  constructor(geometry, material, items, capacity) {
    const n = items.length
    this.count = n
    this.capacity = Math.max(1, Math.min(n, capacity))
    this.ms = new Float32Array(n)
    this.mats = new Float32Array(n * 16)
    this.cols = new Float32Array(n * 3)
    const c = new Color()
    items.forEach((item, i) => {
      this.ms[i] = item.m
      item.matrix.toArray(this.mats, i * 16)
      c.set(item.color ?? '#ffffff')
      this.cols[i * 3] = c.r
      this.cols[i * 3 + 1] = c.g
      this.cols[i * 3 + 2] = c.b
    })
    this.mesh = new InstancedMesh(geometry, material, this.capacity)
    for (let i = 0; i < this.capacity; i += 1) this.mesh.setColorAt(i, c.set('#ffffff'))
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.matrixAutoUpdate = false
    this.lo = -1
    this.hi = -1
    this.dirty = true
    /** Optional per-item hidden test (taken coins, smashed crates). */
    this.hidden = null
  }

  /** Index of the first item at or after metre `m`. */
  lowerBound(m) {
    let lo = 0
    let hi = this.count
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.ms[mid] < m) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /** Shows the items between metres `from` and `to`. */
  update(from, to) {
    const lo = this.lowerBound(from)
    const hi = Math.min(this.lowerBound(to), lo + this.capacity)
    if (lo === this.lo && hi === this.hi && !this.dirty) return
    this.lo = lo
    this.hi = hi
    this.dirty = false
    const dst = this.mesh.instanceMatrix.array
    const cdst = this.mesh.instanceColor.array
    let k = 0
    for (let i = lo; i < hi; i += 1) {
      if (this.hidden && this.hidden(i)) continue
      for (let e = 0; e < 16; e += 1) dst[k * 16 + e] = this.mats[i * 16 + e]
      cdst[k * 3] = this.cols[i * 3]
      cdst[k * 3 + 1] = this.cols[i * 3 + 1]
      cdst[k * 3 + 2] = this.cols[i * 3 + 2]
      k += 1
    }
    this.mesh.count = k
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.instanceColor.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.dispose()
  }
}

/** Reusable scratch matrix for building item lists. */
export const scratchMatrix = () => new Matrix4()
