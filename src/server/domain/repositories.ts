// src/server/domain/repositories.ts
// Persistence seam. Services depend on these interfaces; the in-memory impls back tests/dev,
// and a Prisma-backed impl drops in for production without touching service logic. PRD §10.1.

export interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  list(filter?: (entity: T) => boolean): Promise<T[]>;
}

export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly items = new Map<string, T>();

  async get(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }
  async save(entity: T): Promise<T> {
    this.items.set(entity.id, entity);
    return entity;
  }
  async list(filter?: (entity: T) => boolean): Promise<T[]> {
    const all = [...this.items.values()];
    return filter === undefined ? all : all.filter(filter);
  }
  /** Remove all entities matching the predicate. Returns the number deleted. (UU PDP erasure, §13.4.) */
  async deleteWhere(predicate: (entity: T) => boolean): Promise<number> {
    let n = 0;
    for (const [id, item] of this.items) {
      if (predicate(item)) {
        this.items.delete(id);
        n += 1;
      }
    }
    return n;
  }
}
