/**
 * Double-ended queue with dynamic capacity.
 *
 * Elements are stored linearly from head to tail for O(1) iteration and cache locality.
 * When capacity is reached, the deque rebalances if skewed or expands if truly full.
 *
 * @template T The type of elements stored in the deque
 * @group Data Structures
 */
export class Deque<T> {
  private size_: number;
  private cap_: number;
  private buffer: (T | undefined)[];
  private head: number;
  private tail: number;
  private growthFactor: number;
  private rebalanceThreshold: number;

  /**
   * Creates a deque with initial capacity.
   * @param capacity Initial number of elements
   * @param growthFactor Factor by which to grow when full (default: 2.0)
   * @param rebalanceThreshold Minimum unused space ratio to trigger rebalance instead of expand (default: 0.3)
   */
  constructor(
    capacity: number,
    growthFactor: number = 2.0,
    rebalanceThreshold: number = 0.3,
  ) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than 0");
    }
    if (growthFactor <= 1.0) {
      throw new Error("Growth factor must be greater than 1.0");
    }
    if (rebalanceThreshold < 0 || rebalanceThreshold > 1) {
      throw new Error("Rebalance threshold must be between 0 and 1");
    }

    this.size_ = 0;
    this.cap_ = capacity;
    this.buffer = new Array(this.cap_);
    // Start head and tail in the middle of the buffer
    const middle = Math.floor(this.cap_ / 2);
    this.head = middle;
    this.tail = middle;
    this.growthFactor = growthFactor;
    this.rebalanceThreshold = rebalanceThreshold;
  }

  /** Re-centers elements within current buffer */
  private rebalance(): void {
    const newHead = Math.floor((this.cap_ - this.size_) / 2);
    if (newHead === this.head) return;

    if (newHead < this.head) {
      // Shift left
      for (let i = 0; i < this.size_; i++) {
        this.buffer[newHead + i] = this.buffer[this.head + i];
        this.buffer[this.head + i] = undefined;
      }
    } else {
      // Shift right (copy backwards to avoid overwriting)
      for (let i = this.size_ - 1; i >= 0; i--) {
        this.buffer[newHead + i] = this.buffer[this.head + i];
        this.buffer[this.head + i] = undefined;
      }
    }

    this.head = newHead;
    this.tail = newHead + this.size_;
  }

  /** Expands buffer and re-centers elements */
  private expand(): void {
    const newCap = Math.max(
      Math.ceil(this.cap_ * this.growthFactor),
      this.cap_ + 1,
    );
    const newBuffer = new Array(newCap);
    // Center elements: equal space on both sides
    const newMiddle = Math.floor((newCap - this.size_) / 2);

    // Copy all elements to the new buffer, centered in the middle
    // Elements are stored linearly from head to tail
    for (let i = 0; i < this.size_; i++) {
      newBuffer[newMiddle + i] = this.buffer[this.head + i];
    }

    // Update state
    this.buffer = newBuffer;
    this.head = newMiddle;
    this.tail = newMiddle + this.size_;
    this.cap_ = newCap;
  }

  /** Returns true if should rebalance instead of expand */
  private shouldRebalance(hitFront: boolean): boolean {
    if (this.size_ === 0) {
      return false; // No point rebalancing empty deque
    }

    const threshold = this.size_ * this.rebalanceThreshold;

    if (hitFront) {
      // Hit front boundary (head === 0), check back space
      const backSpace = this.cap_ - this.tail;
      return backSpace >= threshold;
    } else {
      // Hit back boundary (tail === cap_), check front space
      const frontSpace = this.head;
      return frontSpace >= threshold;
    }
  }

  /** Re-centers head and tail (when empty) */
  private recenter(): void {
    const middle = Math.floor(this.cap_ / 2);
    this.head = middle;
    this.tail = middle;
  }

  /**
   * Adds element to front.
   * @param item Element to add
   */
  push_front(item: T): void {
    // Check if we need to make space at the front
    if (this.head === 0) {
      if (this.shouldRebalance(true)) {
        this.rebalance();
      } else {
        this.expand();
      }
    }

    this.head--;
    this.buffer[this.head] = item;
    this.size_++;
  }

  /**
   * Adds element to back.
   * @param item Element to add
   */
  push_back(item: T): void {
    // Check if we need to make space at the back
    if (this.tail === this.cap_) {
      if (this.shouldRebalance(false)) {
        this.rebalance();
      } else {
        this.expand();
      }
    }

    this.buffer[this.tail] = item;
    this.tail++;
    this.size_++;
  }

  /**
   * Removes and returns front element.
   * @returns Front element or undefined if empty
   */
  pop_front(): T | undefined {
    if (this.empty()) {
      return undefined;
    }
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head++;
    this.size_--;

    // Re-center if empty
    if (this.empty()) {
      this.recenter();
    }

    return item;
  }

  /**
   * Removes and returns back element.
   * @returns Back element or undefined if empty
   */
  pop_back(): T | undefined {
    if (this.empty()) {
      return undefined;
    }
    this.tail--;
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.size_--;

    // Re-center if empty
    if (this.empty()) {
      this.recenter();
    }

    return item;
  }

  /**
   * Gets front element without removing.
   * @returns Front element or undefined if empty
   */
  front(): T | undefined {
    if (this.empty()) {
      return undefined;
    }
    return this.buffer[this.head];
  }

  /**
   * Gets back element without removing.
   * @returns Back element or undefined if empty
   */
  back(): T | undefined {
    if (this.empty()) {
      return undefined;
    }
    const backIndex = this.tail - 1;
    return this.buffer[backIndex];
  }

  /**
   * Accesses element at index.
   * @param index Position from front (0 = front, size-1 = back)
   * @returns Element or undefined if out of bounds
   */
  at(index: number): T | undefined {
    if (index < 0 || index >= this.size_) {
      return undefined;
    }
    const physicalIndex = this.head + index;
    return this.buffer[physicalIndex];
  }

  /** Removes all elements */
  clear(): void {
    // Clear only occupied slots
    for (let i = this.head; i < this.tail; i++) {
      this.buffer[i] = undefined;
    }
    this.recenter();
    this.size_ = 0;
  }

  /** Returns current number of elements */
  size(): number {
    return this.size_;
  }

  /** Returns current number of elements */
  get length(): number {
    return this.size_;
  }

  /** Returns current capacity */
  capacity(): number {
    return this.cap_;
  }

  /** Checks if deque is full */
  full(): boolean {
    return this.size_ === this.cap_;
  }

  /** Checks if deque is empty */
  empty(): boolean {
    return this.size_ === 0;
  }

  /** Iterates over elements from front to back. Optimized for linear buffer access. */
  [Symbol.iterator](): Iterator<T> {
    const buffer = this.buffer;
    const end = this.head + this.size_;
    let current = this.head;

    return {
      next(): IteratorResult<T> {
        if (current >= end) {
          return { done: true, value: undefined };
        }
        return { done: false, value: buffer[current++]! };
      },
    };
  }

  /**
   * Converts deque to array.
   * @returns Array containing all elements in order
   */
  toArray(): T[] {
    const result: T[] = [];
    const end = this.head + this.size_;
    for (let i = this.head; i < end; i++) {
      result.push(this.buffer[i]!);
    }
    return result;
  }
}
