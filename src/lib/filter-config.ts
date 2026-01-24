/**
 * @fileoverview Este archivo centraliza la lógica de filtrado para la aplicación,
 * permitiendo reutilizar y mantener fácilmente las funciones de búsqueda.
 */

import { Pedido, Cliente, Producto } from '@/lib/types';

/**
 * Filtra una lista de pedidos basándose en un término de búsqueda.
 * La búsqueda se realiza en los siguientes campos:
 * - ID del Pedido
 * - Estado del Pedido
 * - Nombre del Cliente
 * - RIF del Cliente
 * - Zona del Cliente
 * 
 * La búsqueda no distingue entre mayúsculas y minúsculas.
 *
 * @param pedidos - El array de objetos Pedido a filtrar.
 * @param searchTerm - El término de búsqueda introducido por el usuario.
 * @param getCliente - Una función que recibe un idCliente y devuelve el objeto Cliente correspondiente.
 * @returns Un nuevo array de Pedidos que coinciden con el criterio de búsqueda.
 */
export const filterPedidosByTerm = (
  pedidos: Pedido[],
  searchTerm: string,
  getCliente: (idCliente: string) => Cliente | undefined
): Pedido[] => {
  if (!searchTerm) {
    return pedidos;
  }

  const lowercasedTerm = searchTerm.toLowerCase();

  return pedidos.filter(pedido => {
    const cliente = getCliente(pedido.idCliente);
    const matchesId = pedido.idPedido.toLowerCase().includes(lowercasedTerm);
    const matchesStatus = pedido.Status.toLowerCase().includes(lowercasedTerm);
    const matchesCliente = cliente && cliente.Cliente.toLowerCase().includes(lowercasedTerm);
    const matchesRif = cliente && cliente.Rif.toLowerCase().includes(lowercasedTerm);
    const matchesZona = cliente && cliente.Zona.toLowerCase().includes(lowercasedTerm);

    return matchesId || matchesStatus || matchesCliente || matchesRif || matchesZona;
  });
};

/**
 * Filtra una lista de productos basándose en un término de búsqueda.
 * La búsqueda se realiza en los siguientes campos:
 * - Nombre del Producto
 * - ID del Producto (código)
 *
 * La búsqueda no distingue entre mayúsculas y minúsculas.
 *
 * @param productos - El array de objetos Producto a filtrar.
 * @param searchTerm - El término de búsqueda introducido por el usuario.
 * @returns Un nuevo array de Productos que coinciden con el criterio de búsqueda.
 */
export const filterProductosByTerm = (
    productos: Producto[],
    searchTerm: string
): Producto[] => {
    if (!searchTerm) {
        return productos;
    }

    const lowercasedTerm = searchTerm.toLowerCase();

    return productos.filter(producto =>
        producto.Producto.toLowerCase().includes(lowercasedTerm) ||
        producto.idProducto.toLowerCase().includes(lowercasedTerm)
    );
};
