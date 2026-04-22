/**
 * Fixed-size circular buffer with Boost-like interface.
 * Automatically overwrites oldest elements when full.
 * @template T The type of elements stored in the buffer
 * @group Data Structures
 */
export class CircularBuffer<T> {
  private size_: number;
  private readonly cap_: number;

  private buffer: T[];
  private head: number;

  /**
   * Creates a circular buffer with fixed capacity.
   * @param capacity Maximum number of elements (must be > 0)
   * @throws {Error} If capacity is not positive
   */
  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than 0");
    }
    this.size_ = 0;
    this.cap_ = capacity;
    this.buffer = new Array(this.cap_);
    this.head = 0;
  }

  /**
   * Adds element to back. Overwrites oldest if full.
   * @param item Element to add
   */
  push_back(item: T): void {
    const tail = this.head + this.size_;

    if (tail < this.cap_) {
      // No wrap-around needed
      this.buffer[tail] = item;
    } else {
      // Wrap-around case
      this.buffer[tail - this.cap_] = item;
    }

    if (this.size_ < this.cap_) {
      this.size_++;
    } else {
      // Move head, with wrap-around check
      this.head = this.head + 1 >= this.cap_ ? 0 : this.head + 1;
    }
  }

  /** Alias for push_back() */
  push(item: T): void {
    this.push_back(item);
  }

  /**
   * Removes and returns front element.
   * @returns Front element or undefined if empty
   */
  pop_front(): T | undefined {
    if (this.size_ === 0) {
      return undefined;
    }

    const item = this.buffer[this.head];
    this.head = this.head + 1 >= this.cap_ ? 0 : this.head + 1;
    this.size_--;

    return item;
  }

  /** Alias for pop_front() */
  pop(): T | undefined {
    return this.pop_front();
  }

  /** Removes all elements and releases references */
  clear(): void {
    this.buffer.fill(undefined as T);
    this.size_ = 0;
    this.head = 0;
  }

  /** Alias for front() */
  peek(): T | undefined {
    return this.front();
  }

  /**
   * Accesses element at index.
   * @param index Position from front (0 = front, size-1 = back)
   * @returns Element or undefined if out of bounds
   */
  at(index: number): T | undefined {
    // Fast path: positive index in range
    if (index >= 0 && index < this.size_) {
      const physicalIndex = this.head + index;
      return this.buffer[
        physicalIndex >= this.cap_ ? physicalIndex - this.cap_ : physicalIndex
      ];
    }

    if (this.size_ === 0) {
      return undefined;
    }

    //? should we just return undefined instead?

    // Slow path: handle out-of-range indices with modulo wrap-around
    let wrappedIndex: number;

    if (index < 0) {
      // Handle negative indices using proper modulo
      wrappedIndex = ((index % this.size_) + this.size_) % this.size_;
    } else {
      // Handle indices >= size
      wrappedIndex = index % this.size_;
    }

    const physicalIndex = this.head + wrappedIndex;
    return this.buffer[
      physicalIndex >= this.cap_ ? physicalIndex - this.cap_ : physicalIndex
    ];
  }

  /** Alias for at() */
  get(index: number): T | undefined {
    return this.at(index);
  }

  /**
   * Gets front element without removing.
   * @returns Front element or undefined if empty
   */
  front(): T | undefined {
    return this.size_ === 0 ? undefined : this.buffer[this.head];
  }

  /**
   * Gets back element without removing.
   * @returns Back element or undefined if empty
   */
  back(): T | undefined {
    if (this.size_ === 0) return undefined;
    const tail = this.head + this.size_ - 1;
    return this.buffer[tail >= this.cap_ ? tail - this.cap_ : tail];
  }

  /** Returns current number of elements */
  size(): number {
    return this.size_;
  }

  /** Returns current number of elements */
  get length(): number {
    return this.size_;
  }

  /** Returns maximum capacity */
  capacity(): number {
    return this.cap_;
  }

  /** Checks if buffer is full */
  full(): boolean {
    return this.size_ === this.cap_;
  }

  /** Checks if buffer is empty */
  empty(): boolean {
    return this.size_ === 0;
  }

  /** Iterator support for for...of loops */
  [Symbol.iterator](): Iterator<T> {
    const buffer = this.buffer;
    const capacity = this.cap_;
    const head = this.head;
    const size = this.size_;
    const tailBoundary = head + size;

    let current = head;

    return {
      next(): IteratorResult<T> {
        if (current >= tailBoundary) {
          return { done: true, value: undefined };
        }

        const value =
          buffer[current < capacity ? current : current - capacity]!;
        current++;

        return { done: false, value };
      },
    };
  }

  /**
   * Converts buffer to array.
   * @returns Array containing all elements in order
   */
  toArray(): T[] {
    const result: T[] = new Array(this.size_);
    let current = this.head;
    const end = this.head + this.size_;
    let resultIndex = 0;

    // First segment: head to end of buffer
    while (current < end && current < this.cap_) {
      result[resultIndex++] = this.buffer[current++]!;
    }

    // Second segment: wrap-around to beginning
    if (current >= this.cap_) {
      const remaining = end - this.cap_;
      for (let i = 0; i < remaining; i++) {
        result[resultIndex++] = this.buffer[i]!;
      }
    }

    return result;
  }
}
