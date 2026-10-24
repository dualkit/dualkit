type Props = { params: Promise<{ id: string }> }

export default async function Order({ params }: Props) {
  const { id } = await params
  const placed = new Date('2026-03-14T10:30:00Z')
  return (
    <section>
      <h1 className="text-2xl font-bold">Order {id}</h1>
      <p className="mt-2 text-gray-600">
        Placed on {placed.toLocaleDateString('en-US', { dateStyle: 'long' })}
      </p>
      <p className="ml-4 mt-4 text-left">Your items are on the way.</p>
    </section>
  )
}
