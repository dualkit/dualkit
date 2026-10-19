import type { Metadata } from 'next'
import { CopyCommand } from '@/components/CopyCommand'
import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import { ACTION_URL, CHECK_COMMAND, FORMAT_COMMAND, SKILLS_COMMAND } from '@/lib/copy'
import { liveData } from '@/lib/live'

export const metadata: Metadata = { title: 'Docs', description: 'Install the Dualkit skills, @dualkit/format, the Starter components and dualkit check.' }
export const revalidate = 300

const API: [string, string, string][] = [
  ['formatMoney(1234.5, { currency: "AED" })', 'AED 1,234.50', 'AED, SAR, QAR, KWD, BHD or OMR. Dinars and rials get three decimals. Add locale: "ar" and numerals: "arab" for Arabic.'],
  ['formatHijri(date, { timeZone: "Asia/Riyadh" })', '1 Ramadan 1447 AH', 'Umm al-Qura dates. Always pass the time zone.'],
  ['toWesternDigits("٠٥٠١٢٣٤٥٦٧")', '0501234567', 'Normalise typed digits before you validate or store them.'],
  ['parseUaePhone("+971 50 123 4567")', '{ ok: true, value: { e164, type } }', 'Every common way of writing a UAE mobile or landline.'],
  ['parseSaudiPhone("+966 55 123 4567")', '{ ok: true, value: { e164, type } }', 'The same for Saudi mobiles and landlines.'],
  ['parseEmiratesId("784-1990-1234567-6")', '{ ok: true, value: { formatted, year } }', 'Checks the 784 prefix and the Luhn check digit.'],
  ['parseIban(value, { country: "AE" })', '{ ok: true, value: { formatted, bankCode } }', 'AE, SA, BH, KW and QA. Length per country and mod 97.'],
]

export default async function Docs() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap page docs">
        <header className="page-head"><h1 className="rise">Docs</h1><p className="lede">The skills teach your agent, the library does the formatting, and the components are yours to change.</p></header>
        <section className="doc-block" id="skills">
          <h2 className="h2">Skills</h2>
          <p className="soft">The skills are listed in the Claude plugin directory, so you can install them from there in Claude Code, Cowork and the Claude apps. Or, in Claude Code, add the marketplace and install the plugin. In Cursor, copy <code>cursor/rules</code> into your project&rsquo;s <code>.cursor/rules</code>.</p>
          <CopyCommand command={SKILLS_COMMAND} />
          <CopyCommand command="/plugin install dualkit@dualkit" />
          <p className="small soft">Any other agent that reads skills, such as Codex or Cursor:</p>
          <CopyCommand command="npx skills add dualkit/dualkit" />
          <p className="small soft">Four skills load on their own when the task calls for them: RTL layout, type pairing, Gulf formats and bilingual copy.</p>
        </section>
        <section className="doc-block" id="format">
          <h2 className="h2">@dualkit/format</h2>
          <CopyCommand command={FORMAT_COMMAND} />
          <div className="card api">
            {API.map(([call, out, note]) => (
              <div className="api-row" key={call}><code>{call}</code><code className="muted">{out}</code><span className="small">{note}</span></div>
            ))}
          </div>
          <p className="small soft">The parse functions never throw. They return <code>{'{ ok: false, error: { code, message } }'}</code>, and the code is stable, so you can map it to your own Arabic and English copy.</p>
        </section>
        <section className="doc-block" id="starter">
          <h2 className="h2">Starter components</h2>
          <p className="soft">Each of the eight installs with the shadcn CLI as source you own, along with the shared tokens and styles.</p>
          <CopyCommand command="npx shadcn@latest add https://dualkit.dev/r/amount.json" />
          <p className="small soft">Swap <code>amount</code> for <code>button</code>, <code>date-display</code>, <code>digit-input</code>, <code>field</code>, <code>sheet</code>, <code>tabs</code> or <code>toast</code>. Then import <code>components/dualkit/tokens.css</code> and <code>styles.css</code> once.</p>
        </section>
        <section className="doc-block" id="check">
          <h2 className="h2">Check a screen</h2>
          <p className="soft">Point it at any page, local or live. It runs twenty Arabic and right-to-left rules and writes a report you can share.</p>
          <p className="small soft">Install the browser once:</p>
          <CopyCommand command="npx playwright@1.55.0 install chromium" />
          <p className="small soft">Then check a page:</p>
          <CopyCommand command={CHECK_COMMAND} />
          <p className="small soft">In CI, add <code>uses: dualkit/dualkit/action@main</code> to a workflow. It scores every pull request and uploads the report; the inputs are in the <a href={ACTION_URL}>Action README</a>. Every rule is in <a href="https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md">RULES.md</a>.</p>
        </section>
        <section className="doc-block">
          <h2 className="h2">Source</h2>
          <p className="soft">Everything is MIT licensed and lives at <a href="https://github.com/dualkit/dualkit">github.com/dualkit/dualkit</a>. Open an issue if any Arabic reads wrong.</p>
        </section>
      </main>
      <Footer status={live.status} downloads={live.downloads} />
    </>
  )
}
