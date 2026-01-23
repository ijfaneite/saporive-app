import Dexie, { type Table } from 'dexie';
import type { Pedido } from './types';

export class AppDatabase extends Dexie {
  localPedidos!: Table<Pedido>; 

  constructor() {
    super('saporive-app-db');
    this.version(1).stores({
      // Primary key is idPedido, createdAt is an index for sorting
      localPedidos: 'idPedido, createdAt'
    });
  }
}

export const db = new AppDatabase();
