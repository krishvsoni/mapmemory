import { describe, expect, it } from 'vitest';
import { PriorityQueue } from './priority-queue.js';

describe('PriorityQueue', () => {
  it('pops items in descending priority order', () => {
    const queue = new PriorityQueue<string>();
    queue.push('low', 1);
    queue.push('high', 10);
    queue.push('mid', 5);

    expect(queue.pop()).toBe('high');
    expect(queue.pop()).toBe('mid');
    expect(queue.pop()).toBe('low');
    expect(queue.pop()).toBeUndefined();
  });

  it('topK returns the k highest priority items without mutating the queue', () => {
    const queue = new PriorityQueue<number>();
    [3, 1, 4, 1, 5, 9, 2, 6].forEach((v) => queue.push(v, v));

    const top3 = queue.topK(3);
    expect(top3).toEqual([9, 6, 5]);
    expect(queue.size).toBe(8);
  });
});
