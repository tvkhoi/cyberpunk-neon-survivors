/**
 * Spatial Hash Grid for high-performance 2D broad-phase collision detection.
 * Reduces O(N^2) pairwise collision checks to O(1) average per query.
 */
export class SpatialHashGrid {
  constructor(cellSize = 120) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this._queryStamp = 0;
  }

  clear() {
    this.grid.clear();
  }

  _getKey(cellX, cellY) {
    return `${cellX}:${cellY}`;
  }

  _getCellCoords(x, y) {
    return {
      cx: Math.floor(x / this.cellSize),
      cy: Math.floor(y / this.cellSize),
    };
  }

  insert(entity) {
    if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return;
    const r = Math.max(0, Math.min(this.cellSize * 4, Number.isFinite(entity.radius) ? entity.radius : 0));

    const minX = entity.x - r;
    const maxX = entity.x + r;
    const minY = entity.y - r;
    const maxY = entity.y + r;

    const startX = Math.floor(minX / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = this._getKey(cx, cy);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push(entity);
      }
    }
  }

  query(entity) {
    if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return [];
    const r = Math.max(0, Math.min(this.cellSize * 4, Number.isFinite(entity.radius) ? entity.radius : 0));

    const minX = entity.x - r;
    const maxX = entity.x + r;
    const minY = entity.y - r;
    const maxY = entity.y + r;

    const startX = Math.floor(minX / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);

    const candidates = [];
    this._queryStamp = (this._queryStamp + 1) | 0;
    const currentStamp = this._queryStamp;

    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        const key = this._getKey(cx, cy);
        const cell = this.grid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const other = cell[i];
            if (other !== entity && other._spatialStamp !== currentStamp) {
              other._spatialStamp = currentStamp;
              candidates.push(other);
            }
          }
        }
      }
    }

    return candidates;
  }
}

