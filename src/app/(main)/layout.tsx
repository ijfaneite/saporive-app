"use client";

import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data-provider';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { AsesorSelectionModal } from '@/components/AsesorSelectionModal';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLoading: isAuthLoading } = useAuth();
  const { isDataLoading, asesor, selectedEmpresa } = useData();
  const pathname = usePathname();

  const isPrintPage = pathname.includes('/imprimir');

  if (isPrintPage) {
    return <>{children}</>;
  }

  if (isAuthLoading || isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className='ml-4'>Cargando datos...</p>
      </div>
    );
  }

  const showSetupModal = !selectedEmpresa || !asesor;

  return (
    <div className="bg-gray-200 dark:bg-gray-900 min-h-screen flex items-center justify-center font-body">
      <div className="relative w-full max-w-md mx-auto h-screen md:h-[90vh] md:max-h-[800px] bg-background shadow-2xl flex flex-col md:rounded-3xl overflow-hidden">
        <Header />
        <main className="flex-grow overflow-y-auto">
          {showSetupModal ? (
            <div className="flex items-center justify-center h-full p-4">
               <AsesorSelectionModal />
            </div>
          ) : (
            children
          )}
        </main>
        {!showSetupModal && <BottomNav />}
      </div>
    </div>
  );
}
