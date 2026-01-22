// --- Basic & Auth ---
export interface User {
  username: string;
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
  idRol: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// --- Empresa ---
export interface Empresa {
  idEmpresa: number;
  RazonSocial: string;
  idPedido: number;
  idRecibo: number;
}

// --- Asesor ---
export interface Asesor {
  idAsesor: string;
  Asesor: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// --- Producto ---
export interface Producto {
  idProducto: string;
  Producto: string;
  Precio: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// --- Cliente ---
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


// --- PEDIDO & DETALLES: Payloads for Creation/Update ---

// Corresponds to schemas.DetallePedidoBase
export interface DetallePedidoBase {
    idProducto: string;
    Precio: number;
    Cantidad: number;
}

// Corresponds to schemas.PedidoCreate
export interface PedidoCreatePayload {
    idPedido: string;
    idEmpresa: number;
    fechaPedido: string; // ISO-8601 string
    totalPedido: number;
    idAsesor: string;
    idCliente: string;
    Status: string;
    detalles: DetallePedidoBase[];
}


// --- PEDIDO & DETALLES: Response shapes from API ---

// Corresponds to schemas.DetallePedido
export interface DetallePedido {
  id: string;
  idPedido: string;
  idProducto: string;
  Precio: number;
  Cantidad: number;
  Total: number;
  producto?: Producto;
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
  createdBy: string;
  updatedBy: string;
}

// Corresponds to schemas.Pedido
export interface Pedido {
  idPedido: string;
  idEmpresa: number;
  fechaPedido: string; // ISO-8601 string
  totalPedido: number;
  idAsesor: string;
  idCliente: string;
  Status: string;
  Rif?: string; // Kept for compatibility with existing UI logic
  asesor?: Asesor;
  cliente?: Cliente;
  detalles: DetallePedido[];
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
  createdBy: string;
  updatedBy: string;
}
