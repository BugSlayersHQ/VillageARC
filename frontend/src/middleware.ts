import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Official Clerk Middleware for Next.js App Router
// When @clerk/nextjs is installed with pnpm add @clerk/nextjs, this delegates to clerkMiddleware()
let clerkHandler: ((req: NextRequest) => Promise<NextResponse> | NextResponse) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clerkMiddleware } = require('@clerk/nextjs/server');
  clerkHandler = clerkMiddleware();
} catch {
  clerkHandler = null;
}

export default function middleware(req: NextRequest) {
  if (clerkHandler) {
    return clerkHandler(req);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
