"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, List, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/pedidos', label: 'Pedidos', icon: Package },
  { href: '/precios', label: 'Lista de Precios', icon: List },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex justify-around items-center p-2 bg-card border-t border-border shadow-t-lg">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link href={item.href} key={item.href} className={cn(
            "flex flex-col items-center justify-center gap-1 w-24 transition-colors duration-200",
            isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}>
            <item.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
