export function Tasks() {
  return (
    <section className="p-4">
      <h1 className="text-2xl">Your tasks</h1>
      <input placeholder="Add a task" className="mt-2 border px-2 py-1" />
      <p className="mt-2">Due {new Date('2026-03-14').toLocaleDateString('en-US')}</p>
    </section>
  )
}
