/** Shared by the card and table views so switching between them reads the same. */
export function YarnEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4">🧶</div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{message}</h3>
      <p className="text-foreground/70 max-w-md">Browse yarns and add them to your stash!</p>
    </div>
  )
}
