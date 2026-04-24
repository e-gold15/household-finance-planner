import '@testing-library/jest-dom'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem:    (key: string) => store[key] ?? null,
  setItem:    (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear:      () => { Object.keys(store).forEach((k) => delete store[k]) },
  get length() { return Object.keys(store).length },
  key:        (i: number) => Object.keys(store)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock crypto.subtle for password hashing
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => Math.random().toString(36).slice(2),
    subtle: {
      digest: async (_algo: string, data: BufferSource) => {
        // Deterministic fake hash: just returns a fixed ArrayBuffer derived from input length
        const arr = new Uint8Array(32)
        const bytes = new Uint8Array(data as ArrayBuffer)
        for (let i = 0; i < 32; i++) arr[i] = (bytes[i % bytes.length] ?? 0) ^ i
        return arr.buffer
      },
    },
  },
})

// Suppress console.error in tests (keeps output clean)
beforeEach(() => {
  localStorageMock.clear()
})
