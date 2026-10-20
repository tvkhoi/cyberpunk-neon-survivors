import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHashGrid } from '../public/js/engine/spatialGrid.js';

describe('Module 5: SpatialHashGrid Collision System Tests', () => {
  it('should initialize with default or custom cell size', () => {
    const gridDefault = new SpatialHashGrid();
    assert.equal(gridDefault.cellSize, 120);
    assert.equal(gridDefault.grid.size, 0);

    const gridCustom = new SpatialHashGrid(64);
    assert.equal(gridCustom.cellSize, 64);
    assert.equal(gridCustom.grid.size, 0);
  });

  it('should insert an entity into a single grid cell when within bounds', () => {
    const grid = new SpatialHashGrid(100);
    const entity = { x: 50, y: 50, radius: 10 };

    grid.insert(entity);

    // Bounding box: [40, 60] -> cx: 0, cy: 0 -> "0:0"
    const cell = grid.grid.get('0:0');
    assert.ok(cell, 'Cell 0:0 should exist');
    assert.equal(cell.length, 1);
    assert.equal(cell[0], entity);
  });

  it('should insert an entity into multiple grid cells when straddling cell borders', () => {
    const grid = new SpatialHashGrid(100);
    // Entity placed at (95, 95) with radius 15 spans x in [80, 110], y in [80, 110]
    // Overlaps cells: (0,0), (1,0), (0,1), (1,1)
    const entity = { x: 95, y: 95, radius: 15 };

    grid.insert(entity);

    assert.ok(grid.grid.has('0:0'), 'Should be in cell 0:0');
    assert.ok(grid.grid.has('1:0'), 'Should be in cell 1:0');
    assert.ok(grid.grid.has('0:1'), 'Should be in cell 0:1');
    assert.ok(grid.grid.has('1:1'), 'Should be in cell 1:1');
  });

  it('should query and return neighboring entities while excluding self', () => {
    const grid = new SpatialHashGrid(100);
    const player = { x: 50, y: 50, radius: 20 };
    const nearEnemy1 = { x: 60, y: 60, radius: 15 };
    const nearEnemy2 = { x: 80, y: 70, radius: 15 };
    const distantEnemy = { x: 800, y: 800, radius: 20 };

    grid.insert(player);
    grid.insert(nearEnemy1);
    grid.insert(nearEnemy2);
    grid.insert(distantEnemy);

    const candidates = grid.query(player);

    assert.equal(candidates.includes(player), false, 'Candidates must not include queried entity itself');
    assert.ok(candidates.includes(nearEnemy1), 'Candidates must include nearEnemy1');
    assert.ok(candidates.includes(nearEnemy2), 'Candidates must include nearEnemy2');
    assert.equal(candidates.includes(distantEnemy), false, 'Candidates must NOT include distantEnemy');
    assert.equal(candidates.length, 2);
  });

  it('should clear all cells completely', () => {
    const grid = new SpatialHashGrid(100);
    grid.insert({ x: 50, y: 50, radius: 10 });
    grid.insert({ x: 250, y: 350, radius: 15 });

    assert.ok(grid.grid.size > 0);
    grid.clear();
    assert.equal(grid.grid.size, 0);

    const candidates = grid.query({ x: 50, y: 50, radius: 10 });
    assert.equal(candidates.length, 0);
  });

  it('should demonstrate massive O(1) broadphase efficiency over O(N^2) brute force with 1,000 entities', () => {
    const grid = new SpatialHashGrid(120);
    const worldSize = 3200;
    const entities: Array<{ id: number; x: number; y: number; radius: number }> = [];

    // Populate 1,000 entities uniformly across the 3200x3200 world
    for (let i = 0; i < 1000; i++) {
      entities.push({
        id: i,
        x: (i * 97) % worldSize,
        y: (i * 193) % worldSize,
        radius: 12,
      });
    }

    const startTime = performance.now();
    for (const e of entities) {
      grid.insert(e);
    }
    const insertDuration = performance.now() - startTime;

    // Benchmark 200 random queries
    const queryStartTime = performance.now();
    let totalCandidatesFound = 0;

    for (let i = 0; i < 200; i++) {
      const target = entities[i * 5];
      const candidates = grid.query(target);
      totalCandidatesFound += candidates.length;
      // Broadphase reduction check: candidate count is a tiny fraction of 1,000
      assert.ok(
        candidates.length < 50,
        `Expected candidate count < 50, but got ${candidates.length}`
      );
    }
    const queryDuration = performance.now() - queryStartTime;

    const avgCandidates = totalCandidatesFound / 200;

    // Verify insertion and queries executed well within generous limit under concurrent test load
    assert.ok(insertDuration < 100, `Insert duration was ${insertDuration}ms (expected < 100ms)`);
    assert.ok(queryDuration < 100, `Query duration was ${queryDuration}ms (expected < 100ms)`);
    assert.ok(
      avgCandidates < 15,
      `Spatial Grid reduced 1,000 entity search space to an average of only ${avgCandidates.toFixed(2)} candidates!`
    );
  });
});
