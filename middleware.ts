import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED_PREFIXES = ["/dashboard", "/character", "/battle", "/lobby"];
const PUBLIC_EXCEPTIONS = ["/battle-test"];
const AUTH_PATHS = ["/login", "/register"];

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

async function verifyToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());

    const userId = payload.userId;
    const email = payload.email;

    if (typeof userId !== "string" || typeof email !== "string") {
      return null;
    }

    return { userId, email };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicException = PUBLIC_EXCEPTIONS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isProtected =
    !isPublicException &&
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
  const isAuthPage = AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Redirecionar raiz para dashboard (ou login se nao autenticado)
  if (pathname === "/") {
    const authHeader = request.headers.get("authorization");
    const rootToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : request.cookies.get("access_token")?.value ?? null;
    const rootUser = rootToken ? await verifyToken(rootToken) : null;
    const dest = rootUser ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : request.cookies.get("access_token")?.value ?? null;

  const user = token ? await verifyToken(token) : null;

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  if (user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.userId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
