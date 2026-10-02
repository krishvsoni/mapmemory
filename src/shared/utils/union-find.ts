export class UnionFind<T extends string> {
  private parent = new Map<T, T>();
  private rank = new Map<T, number>();

  makeSet(id: T): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: T): T {
    this.makeSet(id);
    const parent = this.parent.get(id) as T;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: T, b: T): T {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return rootA;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
      return rootB;
    }
    if (rankA > rankB) {
      this.parent.set(rootB, rootA);
      return rootA;
    }
    this.parent.set(rootB, rootA);
    this.rank.set(rootA, rankA + 1);
    return rootA;
  }

  connected(a: T, b: T): boolean {
    return this.find(a) === this.find(b);
  }

  groups(): Map<T, T[]> {
    const result = new Map<T, T[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const group = result.get(root) ?? [];
      group.push(id);
      result.set(root, group);
    }
    return result;
  }
}
