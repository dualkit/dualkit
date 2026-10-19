import { CopyCommand } from '@/components/CopyCommand'
import { V3 } from '@/lib/v3/copy'
import { Button, Frame, Painting, Glass } from './primitives'
import './sec.css'
import './footer.css'

const C = V3.closing

/** Closing: one glass panel on the painting, the install line, and the two ways forward. */
export function Closing() {
  return (
    <section className="v3-sec" aria-labelledby="v3-closing-title">
      <div className="v3-wrap">
        <Frame className="v3-close-frame">
          <Painting className="v3-close-painting">
            <Glass className="v3-close-panel">
              <h2 id="v3-closing-title" className="v3-h2">{C.heading}</h2>
              <div className="v3-close-cmd"><CopyCommand command={C.command} /></div>
              <div className="v3-close-actions">
                <Button href="/docs" kind="glass" arrow>{C.primary}</Button>
                <Button href="/docs" kind="outline">{C.secondary}</Button>
              </div>
            </Glass>
          </Painting>
        </Frame>
      </div>
    </section>
  )
}
