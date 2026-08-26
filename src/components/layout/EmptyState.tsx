export function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="border border-dashed border-neutral-400 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
      ) : null}
    </div>
  )
}
