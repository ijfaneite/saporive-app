import type {Metadata} from 'next';
import {AuthProvider} from '@/lib/auth';
import {Toaster} from '@/components/ui/toaster';
import { ThemeProvider } from "@/components/theme-provider";
import './globals.css';

export const metadata: Metadata = {
  title: 'saporive-app',
  description: 'saporive-app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
