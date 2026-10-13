const FRONTMATTER = /^---\n([\s\S]*?)\n---\n+([\s\S]*)$/

/** @param {string} text @returns {{ name: string, description: string, body: string }} */
export function parseSkill(text) {
  const match = FRONTMATTER.exec(text)
  if (!match) throw new Error('SKILL.md must start with --- frontmatter ---')
  const fields = Object.fromEntries(
    (match[1] ?? '').split('\n').map((line) => {
      const at = line.indexOf(':')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    }),
  )
  if (!fields.name || !fields.description) throw new Error('SKILL.md frontmatter needs name and description')
  return { name: fields.name, description: fields.description, body: match[2] ?? '' }
}

/** A Cursor "agent requested" rule: Cursor reads the description and pulls the rule in when it fits. */
export function renderCursorRule(skill) {
  return `---\ndescription: ${skill.description}\nglobs:\nalwaysApply: false\n---\n\n${skill.body}`
}
