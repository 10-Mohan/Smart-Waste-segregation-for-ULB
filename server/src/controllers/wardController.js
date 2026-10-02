import { Ward } from '../models/index.js';

export async function listWards(_request, response) {
  const wards = await Ward.findAll({ order: [['name', 'ASC']] });
  response.json({ wards });
}