import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BenchPage, benchDescription, benchTitle } from '@/components/bench/BenchPage'
import { latestBenchMonth, listBenchMonths, loadBenchMonth } from '@/lib/bench'

type Props = { params: Promise<{ month: string }> }

export const revalidate = 300
export const dynamicParams = false
export const generateStaticParams = () => listBenchMonths().map((month) => ({ month }))

export const metadata: Metadata = { title: benchTitle, description: benchDescription }

export default async function BenchMonthPage({ params }: Props) {
  const { month } = await params
  const data = loadBenchMonth(month)
  if (!data) notFound()
  return <BenchPage data={data} latest={latestBenchMonth()} months={listBenchMonths()} planned={null} />
}
