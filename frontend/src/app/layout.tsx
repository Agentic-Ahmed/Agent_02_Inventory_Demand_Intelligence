import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { clerkEnabled } from "@/lib/auth/clerk";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Quorum: Inventory & Demand Intelligence",
    template: "%s · Quorum",
  },
  description:
    "Autonomous inventory and demand intelligence. Forecast, reorder, and rebalance stock before stockouts happen, with humans in control of every spend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        GeistSans.variable,
        GeistMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );

  // Wrap in Clerk only when configured, so the app runs with no auth provider in
  // dev. Brand the Clerk UI with our teal primary.
  if (!clerkEnabled) return tree;
  return (
    <ClerkProvider appearance={{ variables: { colorPrimary: "#0D9488" } }}>
      {tree}
    </ClerkProvider>
  );
}
