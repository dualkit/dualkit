import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApplyPage } from '@/components/careers/ApplyPage'
import { ROLES, roleBySlug } from '@/lib/careers'

type Props = { params: Promise<{ role: string }> }

export const revalidate = 300
export const dynamicParams = false
export const generateStaticParams = () => ROLES.map((r) => ({ role: r.slug }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const role = roleBySlug((await params).role)
  return role ? { title: `Apply: ${role.title} · Careers`, description: role.summary, robots: { index: false } } : {}
}

export default async function Apply({ params }: Props) {
  const role = roleBySlug((await params).role)
  if (!role) notFound()
  return <ApplyPage role={role} />
}
