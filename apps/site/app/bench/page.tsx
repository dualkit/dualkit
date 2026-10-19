import type { Metadata } from 'next'
import { BenchPage, benchDescription, benchTitle } from '@/components/bench/BenchPage'
import { latestBenchMonth, listBenchMonths, plannedBench } from '@/lib/bench'

export const metadata: Metadata = { title: benchTitle, description: benchDescription }
export const revalidate = 300

export default async function Bench() {
  const latest = latestBenchMonth()
  return <BenchPage data={latest} latest={latest} months={listBenchMonths()} planned={latest ? null : plannedBench()} />
}
