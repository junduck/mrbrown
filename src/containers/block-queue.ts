/**
 * Unbounded queue implemented as a linked list of array blocks.
 *
 * Provides efficient FIFO operations with automatic memory management.
 * Similar interface to CircularBuffer but unbounded.
 *
 * @template T The type of elements stored in the queue
 * @group Data Structures
 */
export class BlockQueue<T> {
  private static readonly DEFAULT_BLOCK_SIZE = 1024;
  private static readonly DEFAULT_MAX_FREE_BLOCKS = 16;

  private head: BlockNode<T>;
  private tail: BlockNode<T>;
  private size_: number = 0;
  private readonly blockSize: number;
  // Reuse emptied blocks to avoid excessive allocations
  private freeList: BlockNode<T> | null = null;
  private freeListCount: number = 0;
  private readonly maxFreeBlocks: number;

  /**
   * Creates a block queue.
   * @param blockSize Size of each array block (default: 1024)
   * @param maxFreeBlocks Maximum number of free blocks to keep for reuse (default: 16)
   */
  constructor(
    blockSize: number = BlockQueue.DEFAULT_BLOCK_SIZE,
    maxFreeBlocks: number = BlockQueue.DEFAULT_MAX_FREE_BLOCKS,
  ) {
    if (blockSize <= 0) {
      throw new Error("Block size must be greater than 0");
    }
    this.blockSize = blockSize;
    this.maxFreeBlocks = maxFreeBlocks;
    // Initialize first block
    const initialBlock: BlockNode<T> = {
      data: new Array<T | null>(this.blockSize).fill(null),
      next: null,
      readPtr: 0,
      writePtr: 0,
    };
    this.head = this.tail = initialBlock;
  }

  /**
   * Adds element to the back of the queue.
   * @param item Element to add
   */
  push_back(item: T): void {
    if (this.tail.writePtr >= this.blockSize) {
      // Current tail block is full, try to reuse a block from the free list
      let newBlock: BlockNode<T> | null = null;
      if (this.freeList !== null) {
        newBlock = this.freeList;
        this.freeList = this.freeList.next;
        this.freeListCount--;
        newBlock.next = null;
        newBlock.readPtr = 0;
        newBlock.writePtr = 0;
      } else {
        newBlock = {
          data: new Array<T | null>(this.blockSize).fill(null),
          next: null,
          readPtr: 0,
          writePtr: 0,
        };
      }

      this.tail.next = newBlock;
      this.tail = newBlock;
    }

    // Add item to current tail block
    this.tail.data[this.tail.writePtr++] = item;
    this.size_++;
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

    const headBlock = this.head;
    const item = headBlock.data[headBlock.readPtr];

    // Clear the slot and advance read pointer
    headBlock.data[headBlock.readPtr] = null;
    headBlock.readPtr++;

    this.size_--;

    // If head block is empty and there are more elements, move to next block
    if (headBlock.readPtr >= headBlock.writePtr) {
      if (this.size_ > 0) {
        // Move head to next block and add the old head to free list for reuse
        const next = headBlock.next!;
        this.head = next;

        // Only add to free list if we haven't exceeded the cap
        if (this.freeListCount < this.maxFreeBlocks) {
          headBlock.next = this.freeList;
          headBlock.readPtr = 0;
          headBlock.writePtr = 0;
          // clear slots to avoid retaining references
          this.freeList = headBlock;
          this.freeListCount++;
        } else {
          // Drop block (allow GC) by severing links
          headBlock.next = null;
        }
      } else {
        // Queue is now empty — reset head/tail to a single reusable block
        headBlock.readPtr = 0;
        headBlock.writePtr = 0;
        headBlock.next = null;
        this.head = this.tail = headBlock;
        // don't add the last block to freeList; keep it as the main block
      }
    }

    return item!;
  }

  /** Alias for pop_front() */
  pop(): T | undefined {
    return this.pop_front();
  }

  /**
   * Gets front element without removing.
   * @returns Front element or undefined if empty
   */
  front(): T | undefined {
    if (this.size_ === 0) {
      return undefined;
    }
    return this.head.data[this.head.readPtr]!;
  }

  /**
   * Gets back element without removing.
   * @returns Back element or undefined if empty
   */
  back(): T | undefined {
    if (this.size_ === 0) {
      return undefined;
    }
    return this.tail.data[this.tail.writePtr - 1]!;
  }

  /** Removes all elements */
  clear(): void {
    const block: BlockNode<T> = {
      data: new Array<T | null>(this.blockSize).fill(null),
      next: null,
      readPtr: 0,
      writePtr: 0,
    };

    // Set new empty queue state first
    this.head = this.tail = block;
    this.size_ = 0;

    // Keep free list
  }

  /** Returns current number of elements */
  size(): number {
    return this.size_;
  }

  /** Returns current number of elements */
  get length(): number {
    return this.size_;
  }

  /** Checks if queue is empty */
  empty(): boolean {
    return this.size_ === 0;
  }

  /** Iterator support for for...of loops */
  [Symbol.iterator](): Iterator<T> {
    let currentBlock: BlockNode<T> | null = this.head;
    let currentIndex = currentBlock ? currentBlock.readPtr : 0;

    return {
      next(): IteratorResult<T> {
        while (currentBlock !== null && currentIndex >= currentBlock.writePtr) {
          currentBlock = currentBlock.next;
          currentIndex = currentBlock ? currentBlock.readPtr : 0;
        }

        if (currentBlock === null) {
          return { done: true, value: undefined };
        }

        const value = currentBlock.data[currentIndex]!;
        currentIndex++;

        return { done: false, value };
      },
    };
  }

  /**
   * Converts queue to array.
   * @returns Array containing all elements in order
   */
  toArray(): T[] {
    const n = this.size_;
    if (n === 0) return [];

    const result: T[] = new Array<T>(n);
    let idx = 0;
    let current: BlockNode<T> | null = this.head;

    while (current !== null) {
      for (let i = current.readPtr; i < current.writePtr; i++) {
        result[idx++] = current.data[i]!;
      }
      current = current.next;
    }

    return result;
  }
}

/**
 * Internal interface for block nodes in the linked list
 * @interface BlockNode
 * @template T
 */
interface BlockNode<T> {
  /** Array containing the block data */
  data: (T | null)[];
  /** Reference to next block in the list */
  next: BlockNode<T> | null;
  /** Read pointer - index of next element to pop */
  readPtr: number;
  /** Write pointer - index of next available slot */
  writePtr: number;
}
