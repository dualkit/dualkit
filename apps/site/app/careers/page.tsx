import type { Metadata } from 'next'
import { CareersPage } from '@/components/careers/CareersPage'
import { CAREERS } from '@/lib/careers'

export const metadata: Metadata = { title: CAREERS.title, description: CAREERS.description }
export const revalidate = 300

export default function Careers() {
  return <CareersPage />
}
