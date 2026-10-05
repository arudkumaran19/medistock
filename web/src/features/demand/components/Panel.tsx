/**
 * Section container.
 * Sathurstiga S. (IT24103156).
 *
 * One container primitive rather than a scattering of ad-hoc cards, so every section
 * on every demand page shares the same header rhythm, border and padding.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Panel({
  title,
  description,
  icon,
  actions,
  children,
  flush = false,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  /** Removes body padding, for panels whose content is a full-bleed table. */
  flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div className="panel__heading">
          {icon && (
            <span className="panel__icon">
              <Icon name={icon} size={16} />
            </span>
          )}
          <div>
            <h3 className="panel__title">{title}</h3>
            {description && <p className="panel__description">{description}</p>}
          </div>
        </div>
        {actions && <div className="panel__actions">{actions}</div>}
      </header>

      <div className={flush ? undefined : 'panel__body'}>{children}</div>
    </section>
  );
}

/** Page title block, shared by all four demand pages. */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head__row">
        <div>
          <h2 className="page-head__title">{title}</h2>
          <p className="page-head__subtitle">{subtitle}</p>
        </div>
        {actions && <div className="page-head__actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export default Panel;
