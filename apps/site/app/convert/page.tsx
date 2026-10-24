import type { Metadata } from 'next'
import { ConvertPage } from '@/components/convert/ConvertPage'
import { CONVERT_COPY } from '@/lib/convert-copy'

export const metadata: Metadata = { title: CONVERT_COPY.title, description: CONVERT_COPY.description }
export const revalidate = 300

export default function Convert() {
  return <ConvertPage />
}
