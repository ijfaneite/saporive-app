import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  const isAuthPage = pathname === '/login'

  if (pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // If token exists, allow access to dashboard (new home)
    return NextResponse.next()
  }

  if (isAuthPage) {
    if (token) {
      // If logged in, redirect from login page to dashboard
      return NextResponse.redirect(new URL('/', request.url))
    }
  } else {
    if (!token) {
      // If not logged in, redirect any other protected page to login
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/pedidos/:path*', '/precios/:path*', '/configuracion/:path*'],
}
