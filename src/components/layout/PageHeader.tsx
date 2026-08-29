export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-6">
      <h1 className="page-title">{title}</h1>
      {description ? <p className="page-subtitle">{description}</p> : null}
    </header>
  )
}
