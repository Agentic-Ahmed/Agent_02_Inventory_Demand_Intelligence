import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * A Button that renders as a Next.js Link. Base UI's Button defaults to
 * expecting a native <button>, so we set nativeButton={false} when the
 * rendered element is an anchor. Use this anywhere a styled link is needed.
 */
export function ButtonLink({
  href,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { href: string }) {
  return (
    <Button nativeButton={false} render={<Link href={href} />} {...props}>
      {children}
    </Button>
  );
}
