/**
 * Lightweight 2D Spatial Hash Grid for O(1) circle collider lookups on land.
 * Replaces linear O(n) scans across trees, boulders, cottages, and future farm/livestock pens
 * with zero per-frame garbage allocation.
 */
export class SpatialHash2D {
  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
    this.cells = new Map();
    this._queryStamp = 0;
    this._results = [];
  }

  _key(cx, cz) {
    // Bit-pack signed 16-bit integer grid coords into a fast JS SMI key
    return ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);
  }

  insert(item) {
    const r = item.radius || 0;
    const minX = Math.floor((item.x - r) * this.invCell);
    const maxX = Math.floor((item.x + r) * this.invCell);
    const minZ = Math.floor((item.z - r) * this.invCell);
    const maxZ = Math.floor((item.z + r) * this.invCell);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = this._key(cx, cz);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(item);
      }
    }
    return item;
  }

  /**
   * Returns a reusable array of unique colliders overlapping the AABB around (x, z, radius).
   */
  query(x, z, radius = 0) {
    const res = this._results;
    res.length = 0;
    const stamp = ++this._queryStamp;
    const minX = Math.floor((x - radius) * this.invCell);
    const maxX = Math.floor((x + radius) * this.invCell);
    const minZ = Math.floor((z - radius) * this.invCell);
    const maxZ = Math.floor((z + radius) * this.invCell);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this._key(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (item._shStamp !== stamp) {
            item._shStamp = stamp;
            res.push(item);
          }
        }
      }
    }
    return res;
  }
}
