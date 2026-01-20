"use client";

import { useAuth } from '@/lib/auth';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { AsesorSelectionModal } from '@/components/AsesorSelectionModal';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { asesor, isLoading, user, selectedEmpresa } = useAuth();
  const pathname = usePathname();

  const isPrintPage = pathname.includes('/imprimir');

  // Para la página de impresión, mostramos solo el contenido, sin layout
  if (isPrintPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const showSetupModal = user && (!selectedEmpresa || !asesor);

  return (
    <div className="bg-gray-200 dark:bg-gray-900 min-h-screen flex items-center justify-center font-body">
      <div className="relative w-full max-w-md mx-auto h-screen md:h-[90vh] md:max-h-[800px] bg-background shadow-2xl flex flex-col md:rounded-3xl overflow-hidden">
        <Header />
        <main className="flex-grow overflow-y-auto">
          {showSetupModal ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <p className="mt-4 text-muted-foreground">Requiere configuración inicial...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
        <BottomNav />
        {showSetupModal && <AsesorSelectionModal />}
      </div>
    </div>
  );
}
