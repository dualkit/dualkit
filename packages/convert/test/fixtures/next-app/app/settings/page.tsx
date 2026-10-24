export default function Settings() {
  return (
    <form className="space-y-4">
      <h1 className="text-2xl font-bold">Account settings</h1>
      <label className="block">
        Phone number
        <input
          type="tel"
          placeholder="Enter your phone number"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </label>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save changes</button>
    </form>
  )
}
