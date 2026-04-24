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

// Mock crypto — covers password hashing (subtle.digest) + token generation (getRandomValues)
let _uuidCounter = 0
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${++_uuidCounter}`,
    /** Deterministic fill: arr[i] = (i * 7 + 13) % 256 — always different from Math.random() */
    getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
      const u8 = new Uint8Array((arr as unknown as { buffer: ArrayBuffer }).buffer)
      for (let i = 0; i < u8.length; i++) u8[i] = (i * 7 + 13) % 256
      return arr
    },
    subtle: {
      digest: async (_algo: string, data: BufferSource) => {
        // Deterministic fake hash: XOR each byte with its index — not crypto-secure, fine for tests
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
