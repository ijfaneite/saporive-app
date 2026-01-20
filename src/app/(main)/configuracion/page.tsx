"use client";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils";

export default function ConfiguracionPage() {
  const { logout, syncData, isSyncing } = useAuth();
  const { toast } = useToast();

  const handleSync = async () => {
    toast({
      title: "Sincronización iniciada",
      description: "Los datos se están actualizando en segundo plano.",
    });
    await syncData();
    toast({
        title: "Sincronización completada",
        description: "Todos los datos están al día.",
      });
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold font-headline text-primary">Configuración</h1>
      
      <Card>
        <CardHeader>
            <CardTitle>Datos de la Aplicación</CardTitle>
            <CardDescription>Sincronice los datos para obtener la información más reciente.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="outline" className="w-full" onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
                {isSyncing ? "Sincronizando..." : "Sincronizar Datos"}
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Sesión</CardTitle>
            <CardDescription>Cierre la sesión en su cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción cerrará su sesión y deberá volver a iniciarla para continuar.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={logout}>Continuar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
