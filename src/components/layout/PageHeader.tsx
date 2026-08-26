export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-6 max-w-2xl">
      <h1 className="app-heading">{title}</h1>
      {description ? (
        <p className="mt-1.5 text-sm text-muted">{description}</p>
      ) : null}
    </header>
  )
}
