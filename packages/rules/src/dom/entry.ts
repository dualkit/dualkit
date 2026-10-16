import { readScreen } from './reader'

;(globalThis as unknown as { dualkitReader: { readScreen: typeof readScreen } }).dualkitReader = { readScreen }
