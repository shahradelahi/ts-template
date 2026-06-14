/**
 * A simple Least Recently Used (LRU) cache.
 *
 * @example
 * const cache = new SimpleLRUCache<string, number>(2);
 * cache.set('a', 1);
 * cache.set('b', 2);
 * cache.get('a'); // returns 1
 * cache.set('c', 3); // evicts 'b'
 */
export class SimpleLRUCache<K, V> {
  #maxSize: number;
  #map = new Map<K, V>();

  constructor(maxSize: number) {
    this.#maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.#map.get(key);
    if (value !== undefined) {
      this.#map.delete(key);
      this.#map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.#maxSize) {
      const firstKey = this.#map.keys().next().value;
      if (firstKey !== undefined) {
        this.#map.delete(firstKey);
      }
    }
    this.#map.set(key, value);
  }

  clear(): void {
    this.#map.clear();
  }

  get size(): number {
    return this.#map.size;
  }

  get maxSize(): number {
    return this.#maxSize;
  }
}
