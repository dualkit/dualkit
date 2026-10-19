import data from '../../public/v3/gulf-grid.json'
import { decodeGrid, type GridJson } from './grid'

/** The decoded Gulf grid, shared by the server wrapper (for the city names) and the client map. */
export const GRID = decodeGrid(data as unknown as GridJson)
export const CITY_NAMES = Object.keys(GRID.cities)
