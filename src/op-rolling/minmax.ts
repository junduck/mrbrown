import type { OpContext } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { Deque } from "../containers/deque.js";

/**
 * Rolling minimum over a sliding window using monotonic deque.
 * O(1) amortized time per update.
 * @group Rolling Statistics
 */
export class RollingMin {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<number>;

  get value(): number | null {
    return this.buffer.full() ? this.minDeque.front()! : null;
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    // Monotonic deque primarily push_back, so allocate 1.5x to avoid rebalancing
    this.minDeque = new Deque(Math.ceil(opts.period * 1.5));
  }

  update(x: number): number | null {
    if (this.buffer.full()) {
      const old = this.buffer.front()!;
      if (!this.minDeque.empty() && this.minDeque.front() === old) {
        this.minDeque.pop_front();
      }
    }

    this.buffer.push(x);

    while (!this.minDeque.empty() && this.minDeque.back()! >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back(x);

    return this.buffer.full() ? this.minDeque.front()! : null;
  }

  reset(): void {
    this.buffer.clear();
    this.minDeque.clear();
  }

  static readonly doc: OpContext = {
    type: "RollingMin",
    init: "{period: number}",
    input: "x",
    output: "number",
  };
}

/**
 * Rolling maximum over a sliding window using monotonic deque.
 * O(1) amortized time per update.
 * @group Rolling Statistics
 */
export class RollingMax {
  readonly buffer: CircularBuffer<number>;
  private maxDeque: Deque<number>;

  get value(): number | null {
    return this.buffer.full() ? this.maxDeque.front()! : null;
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    // Monotonic deque primarily push_back, so allocate 1.5x to avoid rebalancing
    this.maxDeque = new Deque(Math.ceil(opts.period * 1.5));
  }

  update(x: number): number | null {
    if (this.buffer.full()) {
      const old = this.buffer.front()!;
      if (!this.maxDeque.empty() && this.maxDeque.front() === old) {
        this.maxDeque.pop_front();
      }
    }

    this.buffer.push(x);

    while (!this.maxDeque.empty() && this.maxDeque.back()! <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back(x);

    return this.buffer.full() ? this.maxDeque.front()! : null;
  }

  reset(): void {
    this.buffer.clear();
    this.maxDeque.clear();
  }

  static readonly doc: OpContext = {
    type: "RollingMax",
    init: "{period: number}",
    input: "x",
    output: "number",
  };
}

/**
 * Rolling minimum and maximum over a sliding window.
 * O(1) amortized time per update.
 * @group Rolling Statistics
 */
export class RollingMinMax {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<number>;
  private maxDeque: Deque<number>;

  get value(): { min: number; max: number } | null {
    if (!this.buffer.full()) return null;
    return {
      min: this.minDeque.front()!,
      max: this.maxDeque.front()!,
    };
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    // Monotonic deque primarily push_back, so allocate 1.5x to avoid rebalancing
    const dequeCapacity = Math.ceil(opts.period * 1.5);
    this.minDeque = new Deque(dequeCapacity);
    this.maxDeque = new Deque(dequeCapacity);
  }

  update(x: number): { min: number; max: number } | null {
    if (this.buffer.full()) {
      const old = this.buffer.front()!;
      if (!this.minDeque.empty() && this.minDeque.front() === old) {
        this.minDeque.pop_front();
      }
      if (!this.maxDeque.empty() && this.maxDeque.front() === old) {
        this.maxDeque.pop_front();
      }
    }

    this.buffer.push(x);

    while (!this.minDeque.empty() && this.minDeque.back()! >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back(x);

    while (!this.maxDeque.empty() && this.maxDeque.back()! <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back(x);

    if (!this.buffer.full()) return null;
    return {
      min: this.minDeque.front()!,
      max: this.maxDeque.front()!,
    };
  }

  reset(): void {
    this.buffer.clear();
    this.minDeque.clear();
    this.maxDeque.clear();
  }

  static readonly doc: OpContext = {
    type: "RollingMinMax",
    init: "{period: number}",
    input: "x",
    output: "{min, max}",
  };
}

/**
 * Rolling minimum with position tracking over a sliding window.
 * Returns both minimum value and its index within the window (0 = oldest).
 * O(1) amortized time per update.
 * @group Rolling Statistics
 */
export class RollingArgMin {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<{ val: number; pos: number }>;
  private readonly period: number;
  private position: number = 0;

  get value(): { val: number; pos: number } | null {
    if (!this.buffer.full() || this.minDeque.empty()) return null;
    const front = this.minDeque.front()!;
    return { val: front.val, pos: this.position - front.pos - 1 };
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    // Monotonic deque primarily push_back, so allocate 1.5x to avoid rebalancing
    this.minDeque = new Deque(Math.ceil(opts.period * 1.5));
    this.period = opts.period;
  }

  update(x: number): { val: number; pos: number } | null {
    this.buffer.push(x);

    while (
      !this.minDeque.empty() &&
      this.position - this.minDeque.front()!.pos >= this.period
    ) {
      this.minDeque.pop_front();
    }

    while (!this.minDeque.empty() && this.minDeque.back()!.val >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back({ val: x, pos: this.position });

    this.position++;

    if (!this.buffer.full()) return null;
    const front = this.minDeque.front()!;
    return { val: front.val, pos: this.position - front.pos - 1 };
  }

  reset(): void {
    this.buffer.clear();
    this.minDeque.clear();
    this.position = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingArgMin",
    init: "{period: number}",
    input: "x",
    output: "{val, pos}",
  };
}

/**
 * Rolling maximum with position tracking over a sliding window.
 * Returns both maximum value and its index within the window (0 = oldest).
 * O(1) amortized time per update.
 * @group Rolling Statistics
 */
export class RollingArgMax {
  readonly buffer: CircularBuffer<number>;
  private maxDeque: Deque<{ val: number; pos: number }>;
  private readonly period: number;
  private position: number = 0;

  get value(): { val: number; pos: number } | null {
    if (!this.buffer.full() || this.maxDeque.empty()) return null;
    const front = this.maxDeque.front()!;
    return { val: front.val, pos: this.position - front.pos - 1 };
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    // Monotonic deque primarily push_back, so allocate 1.5x to avoid rebalancing
    this.maxDeque = new Deque(Math.ceil(opts.period * 1.5));
    this.period = opts.period;
  }

  update(x: number): { val: number; pos: number } | null {
    this.buffer.push(x);

    while (
      !this.maxDeque.empty() &&
      this.position - this.maxDeque.front()!.pos >= this.period
    ) {
      this.maxDeque.pop_front();
    }

    while (!this.maxDeque.empty() && this.maxDeque.back()!.val <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back({ val: x, pos: this.position });

    this.position++;

    if (!this.buffer.full()) return null;
    const front = this.maxDeque.front()!;
    return { val: front.val, pos: this.position - front.pos - 1 };
  }

  reset(): void {
    this.buffer.clear();
    this.maxDeque.clear();
    this.position = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingArgMax",
    init: "{period: number}",
    input: "x",
    output: "{val, pos}",
  };
}

/**
 * Rolling minimum and maximum with position tracking over a sliding window.
 * Returns both min/max values and their indices within the window (0 = oldest).
 * O(1) amortized time per update.
 * @group Rolling Statistics
 */
export class RollingArgMinMax {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<{ val: number; pos: number }>;
  private maxDeque: Deque<{ val: number; pos: number }>;
  private readonly period: number;
  private position: number = 0;

  get value(): {
    min: { val: number; pos: number };
    max: { val: number; pos: number };
  } | null {
    if (!this.buffer.full()) return null;
    const minFront = this.minDeque.front()!;
    const maxFront = this.maxDeque.front()!;

    return {
      min: { val: minFront.val, pos: this.position - minFront.pos - 1 },
      max: { val: maxFront.val, pos: this.position - maxFront.pos - 1 },
    };
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    // Monotonic deque primarily push_back, so allocate 1.5x to avoid rebalancing
    const dequeCapacity = Math.ceil(opts.period * 1.5);
    this.minDeque = new Deque(dequeCapacity);
    this.maxDeque = new Deque(dequeCapacity);
    this.period = opts.period;
  }

  update(x: number): {
    min: { val: number; pos: number };
    max: { val: number; pos: number };
  } | null {
    this.buffer.push(x);

    while (
      !this.minDeque.empty() &&
      this.position - this.minDeque.front()!.pos >= this.period
    ) {
      this.minDeque.pop_front();
    }
    while (
      !this.maxDeque.empty() &&
      this.position - this.maxDeque.front()!.pos >= this.period
    ) {
      this.maxDeque.pop_front();
    }

    while (!this.minDeque.empty() && this.minDeque.back()!.val >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back({ val: x, pos: this.position });

    while (!this.maxDeque.empty() && this.maxDeque.back()!.val <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back({ val: x, pos: this.position });

    this.position++;

    if (!this.buffer.full()) return null;
    const minFront = this.minDeque.front()!;
    const maxFront = this.maxDeque.front()!;

    return {
      min: { val: minFront.val, pos: this.position - minFront.pos - 1 },
      max: { val: maxFront.val, pos: this.position - maxFront.pos - 1 },
    };
  }

  reset(): void {
    this.buffer.clear();
    this.minDeque.clear();
    this.maxDeque.clear();
    this.position = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingArgMinMax",
    init: "{period: number}",
    input: "x",
    output: "{min: {val, pos}, max: {val, pos}}",
  };
}

export const ROLLING_MINMAX_OPS = [
  RollingMin,
  RollingMax,
  RollingMinMax,
  RollingArgMin,
  RollingArgMax,
  RollingArgMinMax,
] as const;
