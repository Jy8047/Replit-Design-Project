import type { ReactNode } from 'react';

export function PageHeading({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 22,
        flexWrap: 'wrap',
        marginBottom: 28,
      }}
    >
      <div>
        <div className="eyebrow">{kicker}</div>
        <h1 className="page-title">{title}</h1>
        <p className="lead" style={{ margin: 0 }}>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}
