import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/**
 * Centralized configuration for order status colors.
 * To customize, simply change the `variant` for each status.
 *
 * Available variants: 'default', 'secondary', 'destructive', 'outline',
 * 'info', 'warning', 'success', 'accent'.
 * You can also add new variants in `src/components/ui/badge.tsx`.
 */
export const STATUS_COLORS: { [key: string]: BadgeVariant } = {
  // Rojo for "Pendiente"
  pendiente: 'destructive',
  // Azul for "Impreso"
  impreso: 'info',
  // Verde for "Enviado"
  enviado: 'success',
  // Lila for "Modificado"
  modificado: 'accent',
  // Gris for "Anulado"
  anulado: 'secondary',
};

/**
 * Gets the corresponding badge variant for a given status.
 * @param status The status string (e.g., "Pendiente", "enviado").
 * @returns The badge variant name (e.g., "destructive", "success").
 */
export const getStatusVariant = (status: string): BadgeVariant => {
  const normalizedStatus = status.toLowerCase();
  return STATUS_COLORS[normalizedStatus] || 'secondary';
};
