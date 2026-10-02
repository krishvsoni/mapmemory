export interface PriorityQueueItem<T> {
  value: T;
  priority: number;
}

export class PriorityQueue<T> {
  private heap: PriorityQueueItem<T>[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(value: T, priority: number): void {
    this.heap.push({ value, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top?.value;
  }

  peek(): T | undefined {
    return this.heap[0]?.value;
  }

  topK(k: number): T[] {
    const clone = new PriorityQueue<T>();
    clone.heap = [...this.heap];
    const result: T[] = [];
    while (result.length < k && !clone.isEmpty()) {
      const value = clone.pop();
      if (value !== undefined) result.push(value);
    }
    return result;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const parentItem = this.heap[parent];
      const currentItem = this.heap[current];
      if (!parentItem || !currentItem || parentItem.priority >= currentItem.priority) break;
      this.swap(parent, current);
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    const length = this.heap.length;
    for (;;) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let largest = current;

      const leftItem = this.heap[left];
      const largestItem = this.heap[largest];
      if (left < length && leftItem && largestItem && leftItem.priority > largestItem.priority) {
        largest = left;
      }
      const rightItem = this.heap[right];
      const newLargestItem = this.heap[largest];
      if (right < length && rightItem && newLargestItem && rightItem.priority > newLargestItem.priority) {
        largest = right;
      }
      if (largest === current) break;
      this.swap(current, largest);
      current = largest;
    }
  }

  private swap(a: number, b: number): void {
    const itemA = this.heap[a];
    const itemB = this.heap[b];
    if (!itemA || !itemB) return;
    this.heap[a] = itemB;
    this.heap[b] = itemA;
  }
}
