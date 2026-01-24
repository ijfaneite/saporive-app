import Dexie, { type Table } from 'dexie';
import type { Pedido, User, Asesor, Producto, Cliente, Empresa } from './types';

export interface IConfig {
  key: string;
  value: any;
}

export class AppDatabase extends Dexie {
  pedidos!: Table<Pedido, string>;
  user!: Table<User, string>;
  asesores!: Table<Asesor, string>;
  productos!: Table<Producto, string>;
  clientes!: Table<Cliente, string>;
  empresas!: Table<Empresa, number>;
  config!: Table<IConfig, string>;

  constructor() {
    super('saporive-app-db');
    this.version(3).stores({
      pedidos: 'idPedido, createdAt, isLocal',
      user: 'username',
      asesores: 'idAsesor',
      productos: 'idProducto',
      clientes: 'idCliente',
      empresas: 'idEmpresa',
      config: 'key',
    });
  }

  async clearAllData() {
    await Promise.all([
      this.pedidos.clear(),
      this.user.clear(),
      this.asesores.clear(),
      this.productos.clear(),
      this.clientes.clear(),
      this.empresas.clear(),
      this.config.clear(),
    ]);
  }
}

export const db = new AppDatabase();
