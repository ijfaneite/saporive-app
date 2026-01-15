"use client";

import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function PedidosPage() {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold font-headline text-primary">Pedidos</h1>
      <div className="text-center py-10 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground mb-4">No hay pedidos recientes.</p>
        <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Nuevo Pedido
        </Button>
      </div>
    </div>
  );
}
