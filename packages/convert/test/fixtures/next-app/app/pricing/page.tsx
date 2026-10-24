const plans = [
  { name: 'Basic', price: 29 },
  { name: 'Plus', price: 59 },
]

export default function Pricing() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Choose your plan</h1>
      <ul className="mt-4 space-y-3">
        {plans.map(({ name, price }) => (
          <li key={name} className="flex justify-between rounded border p-4">
            <span>{name}</span>
            <span className="pr-2">${price} per month</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
