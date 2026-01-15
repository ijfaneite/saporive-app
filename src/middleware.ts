import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  const isAuthPage = pathname === '/login'

  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/pedidos', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL('/pedidos', request.url))
    }
  } else {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/pedidos/:path*', '/precios/:path*', '/configuracion/:path*'],
}
