"use client";

import { useAuth } from '@/lib/auth';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { AsesorSelectionModal } from '@/components/AsesorSelectionModal';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { asesor, isLoading, user, selectedEmpresa } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && user && !selectedEmpresa && pathname !== '/configuracion') {
      router.replace('/configuracion');
    }
  }, [isLoading, user, selectedEmpresa, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  // Si no hay empresa seleccionada, mostramos un mensaje hasta que se redirija
  if (user && !selectedEmpresa && pathname !== '/configuracion') {
    return (
       <div className="flex items-center justify-center min-h-screen bg-background">
         <div className='text-center'>
           <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
           <p className="mt-4 text-muted-foreground">Seleccione una empresa para continuar...</p>
         </div>
       </div>
     );
   }

  const showAsesorModal = user && !asesor;

  return (
    <div className="bg-gray-200 dark:bg-gray-900 min-h-screen flex items-center justify-center font-body">
      <div className="relative w-full max-w-md mx-auto h-screen md:h-[90vh] md:max-h-[800px] bg-background shadow-2xl flex flex-col md:rounded-3xl overflow-hidden">
        <Header />
        <main className="flex-grow overflow-y-auto">
          {children}
        </main>
        <BottomNav />
        {showAsesorModal && <AsesorSelectionModal />}
      </div>
    </div>
  );
}
