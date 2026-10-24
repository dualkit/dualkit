export default function Home() {
  return (
    <section className="pl-2">
      <h1 className="text-3xl font-bold">Fresh groceries, delivered fast</h1>
      <p className="mt-2 text-gray-600">Order before noon and get it today.</p>
      <input
        type="search"
        placeholder="Search for products"
        className="mt-4 w-full rounded border px-3 py-2"
      />
    </section>
  )
}
