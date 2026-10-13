export type Skill = { name: string; description: string; body: string }
export function parseSkill(text: string): Skill
export function renderCursorRule(skill: Skill): string
