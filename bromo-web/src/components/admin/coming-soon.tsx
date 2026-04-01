export function ComingSoon({
  title,
  description,
  platformName,
}: {
  title: string;
  description: string;
  platformName: string;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      <div className="border-border text-muted-foreground bg-background/60 rounded-xl border border-dashed px-4 py-10 text-center text-sm">
        Coming soon — this module follows the {platformName} rollout checklist.
      </div>
    </div>
  );
}
