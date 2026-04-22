enum Color {
  RED,
  BLACK,
}

class RBNode<T> {
  constructor(
    public key: T,
    public color: Color = Color.RED,
    public left: RBNode<T> | null = null,
    public right: RBNode<T> | null = null,
    public parent: RBNode<T> | null = null,
  ) {}
}

/**
 * Red-Black Tree using standard pointer-based implementation.
 *
 * @template T The type of elements stored in the tree
 * @group Data Structures
 */
export class RBTree<T> {
  private root: RBNode<T> | null = null;
  private size_: number = 0;
  private compare: (a: T, b: T) => number;

  /**
   * Creates a Red-Black Tree.
   * @param compare Comparator function (default: numeric comparison)
   */
  constructor(compare?: (a: T, b: T) => number) {
    this.compare = compare ?? ((a: any, b: any) => a - b);
  }

  // Left rotation: node's right child becomes its parent
  //     x              y
  //    / \            / \
  //   a   y    =>    x   c
  //      / \        / \
  //     b   c      a   b
  private rotateLeft(node: RBNode<T>): void {
    const right = node.right!;
    node.right = right.left;

    if (right.left !== null) {
      right.left.parent = node;
    }

    right.parent = node.parent;

    if (node.parent === null) {
      this.root = right;
    } else if (node === node.parent.left) {
      node.parent.left = right;
    } else {
      node.parent.right = right;
    }

    right.left = node;
    node.parent = right;
  }

  // Right rotation: node's left child becomes its parent
  //       y          x
  //      / \        / \
  //     x   c  =>  a   y
  //    / \            / \
  //   a   b          b   c
  private rotateRight(node: RBNode<T>): void {
    const left = node.left!;
    node.left = left.right;

    if (left.right !== null) {
      left.right.parent = node;
    }

    left.parent = node.parent;

    if (node.parent === null) {
      this.root = left;
    } else if (node === node.parent.right) {
      node.parent.right = left;
    } else {
      node.parent.left = left;
    }

    left.right = node;
    node.parent = left;
  }

  private fixInsert(node: RBNode<T>): void {
    while (node.parent !== null && node.parent.color === Color.RED) {
      if (node.parent === node.parent.parent!.left) {
        const uncle = node.parent.parent!.right;

        if (uncle !== null && uncle.color === Color.RED) {
          node.parent.color = Color.BLACK;
          uncle.color = Color.BLACK;
          node.parent.parent!.color = Color.RED;
          node = node.parent.parent!;
        } else {
          if (node === node.parent.right) {
            node = node.parent;
            this.rotateLeft(node);
          }
          node.parent!.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          this.rotateRight(node.parent!.parent!);
        }
      } else {
        const uncle = node.parent.parent!.left;

        if (uncle !== null && uncle.color === Color.RED) {
          node.parent.color = Color.BLACK;
          uncle.color = Color.BLACK;
          node.parent.parent!.color = Color.RED;
          node = node.parent.parent!;
        } else {
          if (node === node.parent.left) {
            node = node.parent;
            this.rotateRight(node);
          }
          node.parent!.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          this.rotateLeft(node.parent!.parent!);
        }
      }
    }

    this.root!.color = Color.BLACK;
  }

  /**
   * Inserts a key into the tree.
   * @param key Key to insert
   */
  insert(key: T): void {
    const node = new RBNode(key);

    let parent: RBNode<T> | null = null;
    let current = this.root;

    while (current !== null) {
      parent = current;
      if (this.compare(node.key, current.key) < 0) {
        current = current.left;
      } else {
        current = current.right;
      }
    }

    node.parent = parent;

    if (parent === null) {
      this.root = node;
    } else if (this.compare(node.key, parent.key) < 0) {
      parent.left = node;
    } else {
      parent.right = node;
    }

    this.size_++;

    if (node.parent === null) {
      node.color = Color.BLACK;
      return;
    }

    if (node.parent.parent === null) {
      return;
    }

    this.fixInsert(node);
  }

  private transplant(u: RBNode<T>, v: RBNode<T> | null): void {
    if (u.parent === null) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }

    if (v !== null) {
      v.parent = u.parent;
    }
  }

  private minimum(node: RBNode<T>): RBNode<T> {
    while (node.left !== null) {
      node = node.left;
    }
    return node;
  }

  private fixDelete(node: RBNode<T> | null, parent: RBNode<T> | null): void {
    while (
      node !== this.root &&
      (node === null || node.color === Color.BLACK)
    ) {
      if (node === parent!.left) {
        let sibling = parent!.right!;

        if (sibling.color === Color.RED) {
          sibling.color = Color.BLACK;
          parent!.color = Color.RED;
          this.rotateLeft(parent!);
          sibling = parent!.right!;
        }

        if (
          (sibling.left === null || sibling.left.color === Color.BLACK) &&
          (sibling.right === null || sibling.right.color === Color.BLACK)
        ) {
          sibling.color = Color.RED;
          node = parent;
          parent = node!.parent;
        } else {
          if (sibling.right === null || sibling.right.color === Color.BLACK) {
            if (sibling.left !== null) {
              sibling.left.color = Color.BLACK;
            }
            sibling.color = Color.RED;
            this.rotateRight(sibling);
            sibling = parent!.right!;
          }

          sibling.color = parent!.color;
          parent!.color = Color.BLACK;
          if (sibling.right !== null) {
            sibling.right.color = Color.BLACK;
          }
          this.rotateLeft(parent!);
          node = this.root;
          break;
        }
      } else {
        let sibling = parent!.left!;

        if (sibling.color === Color.RED) {
          sibling.color = Color.BLACK;
          parent!.color = Color.RED;
          this.rotateRight(parent!);
          sibling = parent!.left!;
        }

        if (
          (sibling.right === null || sibling.right.color === Color.BLACK) &&
          (sibling.left === null || sibling.left.color === Color.BLACK)
        ) {
          sibling.color = Color.RED;
          node = parent;
          parent = node!.parent;
        } else {
          if (sibling.left === null || sibling.left.color === Color.BLACK) {
            if (sibling.right !== null) {
              sibling.right.color = Color.BLACK;
            }
            sibling.color = Color.RED;
            this.rotateLeft(sibling);
            sibling = parent!.left!;
          }

          sibling.color = parent!.color;
          parent!.color = Color.BLACK;
          if (sibling.left !== null) {
            sibling.left.color = Color.BLACK;
          }
          this.rotateRight(parent!);
          node = this.root;
          break;
        }
      }
    }

    if (node !== null) {
      node.color = Color.BLACK;
    }
  }

  /**
   * Deletes a key from the tree.
   * @param key Key to delete
   * @returns true if key was found and deleted, false otherwise
   */
  delete(key: T): boolean {
    const node = this.findNode(key);
    if (node === null) return false;

    this.size_--;

    let nodeToFix: RBNode<T> | null;
    let nodeToFixParent: RBNode<T> | null;
    const originalColor = node.color;

    if (node.left === null) {
      nodeToFix = node.right;
      nodeToFixParent = node.parent;
      this.transplant(node, node.right);
    } else if (node.right === null) {
      nodeToFix = node.left;
      nodeToFixParent = node.parent;
      this.transplant(node, node.left);
    } else {
      const successor = this.minimum(node.right);
      const successorOriginalColor = successor.color;
      nodeToFix = successor.right;

      if (successor.parent === node) {
        nodeToFixParent = successor;
      } else {
        nodeToFixParent = successor.parent;
        this.transplant(successor, successor.right);
        successor.right = node.right;
        successor.right.parent = successor;
      }

      this.transplant(node, successor);
      successor.left = node.left;
      successor.left.parent = successor;
      successor.color = node.color;

      if (successorOriginalColor === Color.BLACK) {
        this.fixDelete(nodeToFix, nodeToFixParent);
      }
      return true;
    }

    if (originalColor === Color.BLACK) {
      this.fixDelete(nodeToFix, nodeToFixParent);
    }

    return true;
  }

  private findNode(key: T): RBNode<T> | null {
    let current = this.root;

    while (current !== null) {
      const cmp = this.compare(key, current.key);
      if (cmp === 0) {
        return current;
      } else if (cmp < 0) {
        current = current.left;
      } else {
        current = current.right;
      }
    }

    return null;
  }

  /**
   * Searches for a key in the tree.
   * @param key Key to search for
   * @returns The key if found, undefined otherwise
   */
  search(key: T): T | undefined {
    const node = this.findNode(key);
    return node?.key;
  }

  /**
   * Checks if a key exists in the tree.
   * @param key Key to check
   * @returns true if key exists, false otherwise
   */
  has(key: T): boolean {
    return this.findNode(key) !== null;
  }

  /**
   * Returns the minimum key in the tree.
   * @returns Minimum key or undefined if empty
   */
  min(): T | undefined {
    if (this.root === null) return undefined;
    return this.minimum(this.root).key;
  }

  /**
   * Returns the maximum key in the tree.
   * @returns Maximum key or undefined if empty
   */
  max(): T | undefined {
    if (this.root === null) return undefined;
    let node = this.root;
    while (node.right !== null) {
      node = node.right;
    }
    return node.key;
  }

  /** Returns current number of elements */
  size(): number {
    return this.size_;
  }

  /** Checks if tree is empty */
  empty(): boolean {
    return this.size_ === 0;
  }

  /** Removes all elements */
  clear(): void {
    this.root = null;
    this.size_ = 0;
  }

  /**
   * Drains all elements in sorted order.
   * Mutates the tree (empties it).
   */
  drain(): T[] {
    const result: T[] = [];
    while (this.root !== null) {
      const minKey = this.min()!;
      this.delete(minKey);
      result.push(minKey);
    }
    return result;
  }

  /** In-order traversal generator (non-consuming). */
  *inOrder(): Generator<T> {
    yield* this.inOrderNode(this.root);
  }

  private *inOrderNode(node: RBNode<T> | null): Generator<T> {
    if (node === null) return;
    yield* this.inOrderNode(node.left);
    yield node.key;
    yield* this.inOrderNode(node.right);
  }
}
