import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Sends visitors with no login cookie straight to the login page, before any page renders.
 * This only checks that a cookie exists; every page and action still verifies the session itself.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("sid")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // everything except the login/signup/reset pages, API routes, static files, the service worker
  // and the PWA files (the browser fetches the manifest and icons without a login cookie)
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|offline.html|icons/|login|signup|forgot-password|reset-password).*)",
  ],
};
