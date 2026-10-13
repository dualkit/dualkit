'use client'
import { useState } from 'react'
import { FORMAT_COMMAND, SKILLS_COMMAND } from '@/lib/copy'
import { CopyCommand } from './CopyCommand'
import { Segmented } from './Segmented'

const OPTIONS = [{ value: 'skills', label: 'Skills' }, { value: 'format', label: 'Format' }] as const
const COMMANDS = { skills: SKILLS_COMMAND, format: FORMAT_COMMAND }

export function Install({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<'skills' | 'format'>('skills')
  return (
    <div className="install">
      <Segmented label="Install" options={OPTIONS} value={tab} onChange={setTab} />
      <div className="actions">
        <CopyCommand command={COMMANDS[tab]} swapping />
        {children}
      </div>
    </div>
  )
}
