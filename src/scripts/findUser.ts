import { api } from '../services/api/client';

export async function findUser(query: string) {
  return api.users.search(query);
}
