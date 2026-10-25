import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

/**
 * Cliente exclusivo de leitura para garantir que este app NUNCA
 * execute create, update ou delete nas bases fiscais compartilhadas.
 */
export const readOnlyData = {
  async getList<T = RecordModel>(
    collectionName: string,
    page = 1,
    perPage = 50,
    options?: { filter?: string; sort?: string; fields?: string },
  ) {
    return pb.collection(collectionName).getList<T>(page, perPage, options)
  },

  async getFullList<T = RecordModel>(
    collectionName: string,
    options?: { filter?: string; sort?: string; fields?: string },
  ) {
    return pb.collection(collectionName).getFullList<T>(options)
  },

  async getOne<T = RecordModel>(collectionName: string, id: string) {
    return pb.collection(collectionName).getOne<T>(id)
  },
}
