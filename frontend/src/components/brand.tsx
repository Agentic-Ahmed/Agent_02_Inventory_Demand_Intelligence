import { cn } from "@/lib/utils";

/**
 * Quorum mark: three agent nodes reaching consensus (a quorum), with the
 * coordination point at the center. Simple geometric brand mark, inherits
 * currentColor so it themes with the surrounding text.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <path
        d="M7 8 L17 8 M7 8 L12 17 M17 8 L12 17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="7" cy="8" r="2.4" fill="currentColor" />
      <circle cx="17" cy="8" r="2.4" fill="currentColor" />
      <circle cx="12" cy="17" r="2.4" fill="currentColor" />
      <circle cx="12" cy="11" r="1.5" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function Brand({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark className={cn("text-primary", markClassName)} />
      {showWordmark && (
        <span className="text-[1.05rem] font-semibold tracking-tight text-foreground">
          Quorum
        </span>
      )}
    </span>
  );
}
