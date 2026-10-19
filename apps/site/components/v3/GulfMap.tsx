import { cityExamples } from '@/lib/v3/region-examples'
import { CITY_NAMES } from '@/lib/v3/region-grid'
import { GulfMapView } from './GulfMapView'

/** Server side: renders each city's @dualkit/format example when the page is built (and revalidated), then hands them to the map. */
export function GulfMap() {
  return <GulfMapView examples={cityExamples(CITY_NAMES)} />
}
