import {authedFetch} from './authApi';

export type AffiliateProduct = {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  productUrl: string;
  price: number;
  currency: string;
  category: string;
  brand: string;
};

export async function listProducts(
  q?: string,
  category?: string,
  limit = 20,
): Promise<{items: AffiliateProduct[]}> {
  const qs = new URLSearchParams({limit: String(limit)});
  if (q?.trim()) qs.set('q', q.trim());
  if (category?.trim()) qs.set('category', category.trim());
  const res = await authedFetch(`/products?${qs.toString()}`);
  if (!res.ok) return {items: []};
  return res.json() as Promise<{items: AffiliateProduct[]}>;
}

export async function resolveProducts(ids: string[]): Promise<{items: AffiliateProduct[]}> {
  if (ids.length === 0) return {items: []};
  const res = await authedFetch(`/products/resolve`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ids}),
  });
  if (!res.ok) return {items: []};
  return res.json() as Promise<{items: AffiliateProduct[]}>;
}
