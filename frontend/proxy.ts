/**
 * Next.js 16 middleware (renamed to proxy.ts). When Clerk is configured, protect
 * the console (/app and the auth pages get the Clerk context); otherwise this is
 * a no-op so the app runs on the dev session with no auth provider.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/app(.*)"]);
const enabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const handler = enabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtected(req)) await auth.protect();
    })
  : () => undefined;

export default handler;

export const config = {
  matcher: [
    // Run on dynamic pages (skip static files and Next internals)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes
    "/(api|trpc)(.*)",
  ],
};
