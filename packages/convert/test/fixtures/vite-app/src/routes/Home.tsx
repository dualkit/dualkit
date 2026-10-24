import styles from './Home.module.css'

export function Home() {
  return (
    <section className={styles.hero}>
      <h1>Plan your day</h1>
      <p className="pl-2 text-left">Keep every task in one place.</p>
    </section>
  )
}
