import type { Metadata } from 'next'
import { CopyCommand } from '@/components/CopyCommand'
import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import { FORMAT_COMMAND, SKILLS_COMMAND } from '@/lib/copy'
import { liveData } from '@/lib/live'

export const metadata: Metadata = { title: 'Docs', description: 'Install the Dualkit skills and @dualkit/format.' }
export const revalidate = 300

const API: [string, string, string][] = [
  ['formatMoney(1234.5, { currency: "AED" })', 'AED 1,234.50', 'Money in AED or SAR. Add locale: "ar" and numerals: "arab" for Arabic.'],
  ['formatHijri(date, { timeZone: "Asia/Riyadh" })', '1 Ramadan 1447 AH', 'Umm al-Qura dates. Always pass the time zone.'],
  ['toWesternDigits("٠٥٠١٢٣٤٥٦٧")', '0501234567', 'Normalise typed digits before you validate or store them.'],
  ['parseUaePhone("+971 50 123 4567")', '{ ok: true, value: { e164, type } }', 'Every common way of writing a UAE mobile or landline.'],
  ['parseEmiratesId("784-1990-1234567-6")', '{ ok: true, value: { formatted, year } }', 'Checks the 784 prefix and the Luhn check digit.'],
  ['parseIban(value, { country: "AE" })', '{ ok: true, value: { formatted, bankCode } }', 'AE, SA, BH, KW and QA. Length per country and mod 97.'],
]

export default async function Docs() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap page docs">
        <header className="page-head"><h1 className="rise">Docs</h1><p className="sec-lede">Two installs. The skills teach your agent, the library does the formatting.</p></header>
        <section className="doc-block" id="skills">
          <h2>Skills</h2>
          <p className="secondary">In Claude Code, add the marketplace, then install the plugin. In Cursor, copy <code>cursor/rules</code> into your project&rsquo;s <code>.cursor/rules</code>.</p>
          <CopyCommand command={SKILLS_COMMAND} />
          <CopyCommand command="/plugin install dualkit@dualkit" />
          <p className="cap">Four skills load on their own when the task calls for them: RTL layout, type pairing, Gulf formats and bilingual copy.</p>
        </section>
        <section className="doc-block" id="format">
          <h2>@dualkit/format</h2>
          <CopyCommand command={FORMAT_COMMAND} />
          <div className="card api">
            {API.map(([call, out, note]) => (
              <div className="api-row" key={call}><code>{call}</code><code className="muted">{out}</code><span className="cap">{note}</span></div>
            ))}
          </div>
          <p className="cap">The parse functions never throw. They return <code>{'{ ok: false, error: { code, message } }'}</code>, and the code is stable, so you can map it to your own Arabic and English copy.</p>
        </section>
        <section className="doc-block">
          <h2>Source</h2>
          <p className="secondary">Everything is MIT licensed and lives at <a href="https://github.com/dualkit/dualkit">github.com/dualkit/dualkit</a>. Open an issue if any Arabic reads wrong.</p>
        </section>
      </main>
      <Footer status={live.status} downloads={live.downloads} />
    </>
  )
}
