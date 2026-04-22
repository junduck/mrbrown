/**
 * Priority queue using binary min-heap.
 * Provide custom comparator for other orderings (e.g., max-heap: (a, b) => b - a).
 * @template T The type of elements stored in the queue
 * @group Data Structures
 */
export class PriorityQueue<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  /**
   * Creates a priority queue.
   * @param compare Comparator function (default: min-heap for numbers)
   */
  constructor(compare?: (a: T, b: T) => number) {
    this.compare = compare ?? ((a: any, b: any) => a - b);
  }

  private parent(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private left(i: number): number {
    return 2 * i + 1;
  }

  private right(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    const tmp = this.heap[i]!;
    this.heap[i] = this.heap[j]!;
    this.heap[j] = tmp;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const p = this.parent(i);
      if (this.compare(this.heap[i]!, this.heap[p]!) >= 0) break;
      this.swap(i, p);
      i = p;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      const l = this.left(i);
      const r = this.right(i);
      let smallest = i;

      if (l < n && this.compare(this.heap[l]!, this.heap[smallest]!) < 0) {
        smallest = l;
      }
      if (r < n && this.compare(this.heap[r]!, this.heap[smallest]!) < 0) {
        smallest = r;
      }
      if (smallest === i) break;

      this.swap(i, smallest);
      i = smallest;
    }
  }

  /**
   * Adds element to the queue.
   * @param item Element to add
   */
  push(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  /**
   * Removes and returns the top element.
   * @returns Top element or undefined if empty
   */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const top = this.heap[0]!;
    this.heap[0] = this.heap.pop()!;
    this.siftDown(0);
    return top;
  }

  /**
   * Gets the top element without removing.
   * @returns Top element or undefined if empty
   */
  peek(): T | undefined {
    return this.heap.length === 0 ? undefined : this.heap[0];
  }

  /** Alias for peek() */
  top(): T | undefined {
    return this.peek();
  }

  /** Returns current number of elements */
  size(): number {
    return this.heap.length;
  }

  /** Checks if queue is empty */
  empty(): boolean {
    return this.heap.length === 0;
  }

  /** Removes all elements */
  clear(): void {
    this.heap = [];
  }

  /**
   * Drains all elements in sorted order.
   * Mutates the queue (empties it).
   */
  drain(): T[] {
    const result: T[] = [];
    while (this.heap.length > 0) {
      result.push(this.pop()!);
    }
    return result;
  }
}
