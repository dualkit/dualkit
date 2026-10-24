import type { Metadata } from 'next'
import { CopyCommand } from '@/components/CopyCommand'
import { Footer } from '@/components/v3/Footer'
import { Nav } from '@/components/v3/Nav'
import { ACTION_URL, CHECK_COMMAND, CONVERT_COMMAND, FORMAT_COMMAND, LINT_COMMAND, SKILLS_COMMAND } from '@/lib/copy'
import { liveData } from '@/lib/live'

export const metadata: Metadata = { title: 'Docs', description: 'Install the Dualkit skills, @dualkit/format, the Starter components, dualkit check, dualkit lint and dualkit convert.' }
export const revalidate = 300

const API: [string, string, string][] = [
  ['formatMoney(1234.5, { currency: "AED" })', 'AED 1,234.50', 'AED, SAR, QAR, KWD, BHD or OMR. Dinars and rials get three decimals. Add locale: "ar" and numerals: "arab" for Arabic.'],
  ['formatHijri(date, { timeZone: "Asia/Riyadh" })', '1 Ramadan 1447 AH', 'Umm al-Qura dates. The time zone is required.'],
  ['toWesternDigits("٠٥٠١٢٣٤٥٦٧")', '0501234567', 'Normalise typed digits before you validate or store them.'],
  ['parseUaePhone("+971 50 123 4567")', '{ ok: true, value: { e164, type } }', 'Every common way of writing a UAE mobile or landline.'],
  ['parseSaudiPhone("+966 55 123 4567")', '{ ok: true, value: { e164, type } }', 'The same for Saudi mobiles and landlines.'],
  ['parseGulfPhone("+974 3312 3456")', '{ ok: true, value: { country, e164, type } }', 'A number from any of the six GCC countries. It needs a + or 00 and the country code.'],
  ['parseQatarPhone("3312 3456")', '{ ok: true, value: { e164, type } }', 'Also parseKuwaitPhone, parseBahrainPhone and parseOmanPhone, each with format and isValid.'],
  ['parseEmiratesId("784-1990-1234567-6")', '{ ok: true, value: { formatted, year } }', 'Checks the 784 prefix and the Luhn check digit.'],
  ['parseIban(value, { country: "AE" })', '{ ok: true, value: { formatted, bankCode } }', 'All six countries. Length per country and mod 97.'],
  ['parseSaudiVatNumber("310 1223 9350 0003")', '{ ok: true, value: "310122393500003" }', '15 digits that start and end with 3. Also formatSaudiVatNumber and isValidSaudiVatNumber.'],
  ['gulfWeek("AE")', '{ weekend: [6, 7], firstWorkday: 1 }', 'Weekend days as ISO weekdays for AE, AE-SH, SA, QA, KW, BH and OM. isGulfWeekend(date, region, { timeZone }) checks one date.'],
  ['currencySign("SAR")', 'the U+20C1 sign', 'A sign for SAR, AED and OMR, and null for the rest. Most fonts do not draw it yet.'],
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
          <p className="small soft">Four skills load on their own when the task calls for them: RTL layout, type pairing, Gulf formats and bilingual copy. A fifth, dualkit-convert, walks your agent through converting an English app.</p>
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
          <p className="soft">Point it at any page, local or live. It runs 34 Arabic and right-to-left rules and writes a report you can share.</p>
          <p className="small soft">Install the browser once:</p>
          <CopyCommand command="npx playwright@1.55.0 install chromium" />
          <p className="small soft">Then check a page:</p>
          <CopyCommand command={CHECK_COMMAND} />
          <p className="small soft">In CI, add <code>uses: dualkit/dualkit/action@main</code> to a workflow. It scores every pull request and uploads the report; the inputs are in the <a href={ACTION_URL}>Action README</a>. Every rule is in <a href="https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md">RULES.md</a>.</p>
          <p className="small soft"><strong>Experimental:</strong> add <code>--review</code> and a vision model reads a screenshot for problems the rules cannot measure. It uses <code>GEMINI_API_KEY</code> (the default model, <code>gemini-flash-lite-latest</code>, has a free tier) or <code>OPENROUTER_API_KEY</code> with <code>--review-model provider:model</code>, so any cost is on your own key. Not yet measured against hand labels, so treat its findings as suggestions. They are marked review, carry a confidence, and never change the score or the exit code.</p>
        </section>
        <section className="doc-block" id="lint">
          <h2 className="h2">Lint your source</h2>
          <p className="soft">Run it in your project folder. It reads your CSS, HTML, Vue, Svelte, JavaScript and TypeScript, and CSS inside styled and css templates, against 8 source rules by default, needs no browser, and skips what your .gitignore skips.</p>
          <CopyCommand command={LINT_COMMAND} />
          <p className="small soft">Add <code>--json</code> for the findings as JSON, <code>--fail-on warning</code> or <code>--fail-on note</code> to fail on more than errors (warnings and notes are listed but do not fail the run by default), and <code>--config</code> to point at a <code>dualkit.config.json</code>. To turn a rule off for one line, put <code>dualkit-disable-next-line source/physical-css -- reason</code> in a comment above it.</p>
          <p className="small soft">In CI, use the same Action with <code>mode: lint</code> under <code>with:</code>. It needs no browser, fails the job on errors, and comments the findings on the pull request; <code>paths</code> and <code>fail-on</code> are in the <a href={ACTION_URL}>Action README</a>. Every rule and its known limits are in <a href="https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md">LINT.md</a>.</p>
        </section>
        <section className="doc-block" id="convert">
          <h2 className="h2">Convert an English app</h2>
          <p className="soft">Run it in a React or Next.js app with a clean git tree. It makes a new branch, rewrites the layout to logical properties, moves every English string into a translation file and lists each one for you or your agent to put into Arabic. It makes no model calls.</p>
          <CopyCommand command={CONVERT_COMMAND} />
          <p className="small soft">Use <code>--mode bilingual</code> for English and Arabic with a language switch, or <code>--mode arabic</code> for an Arabic-only app. Fill the Arabic in <code>dualkit-strings.json</code>, then run <code>npx dualkit@beta convert --finish</code>. It checks that every English page still looks the same, runs the 34 check rules on each Arabic page, runs your tests and writes <code>dualkit-convert.md</code>. Add <code>--start</code> and <code>--port</code> so it can open the app. Details are in the <a href="https://github.com/dualkit/dualkit/blob/main/packages/convert/README.md">convert README</a>.</p>
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
