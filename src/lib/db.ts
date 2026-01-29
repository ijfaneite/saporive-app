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
    this.version(5).stores({
      pedidos: 'idPedido, createdAt, isLocal',
      user: 'username',
      asesores: 'idAsesor',
      productos: 'idProducto',
      clientes: 'idCliente, idAsesor',
      empresas: 'idEmpresa',
      config: 'key',
    });
  }

  async clearAllDataOnLogout() {
    // We only clear tables that contain session-specific data.
    // Master data and configuration are kept to allow for offline access 
    // and persistence between sessions as requested.
    await Promise.all([
      this.pedidos.clear(), // Clears local and synced orders from previous session
      this.user.clear(),     // Clears previous user object
    ]);
  }
}

export const db = new AppDatabase();
