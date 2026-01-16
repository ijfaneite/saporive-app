export interface User {
  username: string;
  createdAt: string;
  updatedAt: string;
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

export interface Asesor {
  idAsesor: string;
  Asesor: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Producto {
  idProducto: string;
  Producto: string;
  Precio: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Cliente {
  idCliente: string;
  Cliente: string;
  Rif: string;
  Zona: string;
  idAsesor: string;
  asesor?: Asesor;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface DetallePedido {
  id: string;
  idPedido: string;
  idProducto: string;
  Precio: number;
  Cantidad: number;
  Total: number;
  producto?: Producto;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

// Para la creación, la API espera un formato más simple para los detalles
export interface DetallePedidoCreate {
    idProducto: string;
    Precio: number;
    Cantidad: number;
}

export interface Pedido {
  idPedido: string;
  idEmpresa: number;
  fechaPedido: string;
  totalPedido: number;
  idAsesor: string;
  idCliente: string;
  Status: string;
  Rif?: string; // Mantener por compatibilidad si la API lo envía
  asesor?: Asesor;
  cliente?: Cliente;
  detalles: DetallePedido[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

// Para la creación, la API espera que los detalles sean del tipo DetallePedidoCreate
export interface PedidoCreate extends Omit<Pedido, 'detalles' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'asesor' | 'cliente'> {
    detalles: DetallePedidoCreate[];
}
