import type { ButtonHTMLAttributes } from 'react'
import { cx } from './direction'
import { Icon, type IconName } from './icons'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  /** forward and back flip with the reading direction; the others never do. */
  icon?: IconName
}

export function Button({ variant = 'primary', icon, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} className={cx('dk-button', `dk-button--${variant}`, className)}>
      <span className="dk-button__label">{children}</span>
      {icon && <Icon name={icon} />}
    </button>
  )
}
