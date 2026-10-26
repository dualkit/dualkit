import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RolePage } from '@/components/careers/RolePage'
import { ROLES, roleBySlug } from '@/lib/careers'

type Props = { params: Promise<{ role: string }> }

export const revalidate = 300
export const dynamicParams = false
export const generateStaticParams = () => ROLES.map((r) => ({ role: r.slug }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const role = roleBySlug((await params).role)
  return role ? { title: `${role.title} · Careers`, description: role.summary } : {}
}

export default async function Role({ params }: Props) {
  const role = roleBySlug((await params).role)
  if (!role) notFound()
  return <RolePage role={role} />
}
