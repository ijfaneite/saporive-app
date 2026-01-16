export interface User {
  id: string;
  username: string;
  email: string;
  disabled: boolean;
}

export interface Asesor {
  idAsesor: string;
  Asesor: string;
}

export interface Producto {
  idProducto: string;
  Producto: string;
  Precio: number;
}

export interface Cliente {
  idCliente: string;
  Rif: string;
  Cliente: string;
  Zona: string;
  idAsesor: string;
}

export interface Pedido {
  idPedido: string;
  idEmpresa: number;
  fechaPedido: string; // ISO date string
  totalPedido: number;
  idAsesor: string;
  Status: string;
  idCliente: string;
  Rif?: string;
  detalles: DetallePedido[];
}

export interface DetallePedido {
  id: string;
  idPedido: string;
  idProducto: string;
  Precio: number;
  Cantidad: number;
  Total: number;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Empresa {
  idEmpresa: string;
  RazonSocial: string;
  idPedido: number;
  idRecibo: number;
}
