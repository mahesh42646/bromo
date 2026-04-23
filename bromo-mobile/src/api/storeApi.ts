import {apiBase, authorizedFetch, getIdToken} from './authApi';

export type StoreCategory =
  | 'Fashion & Clothing'
  | 'Electronics & Tech'
  | 'Food & Beverages'
  | 'Health & Beauty'
  | 'Home & Decor'
  | 'Sports & Fitness'
  | 'Grocery'
  | 'Books & Stationery'
  | 'Toys & Games'
  | 'Services'
  | 'Other';

export const STORE_CATEGORIES: StoreCategory[] = [
  'Fashion & Clothing',
  'Electronics & Tech',
  'Food & Beverages',
  'Health & Beauty',
  'Home & Decor',
  'Sports & Fitness',
  'Grocery',
  'Books & Stationery',
  'Toys & Games',
  'Services',
  'Other',
];

export type Store = {
  _id: string;
  owner: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  location: {type: 'Point'; coordinates: [number, number]};
  hasDelivery: boolean;
  profilePhoto: string;
  bannerImage: string;
  category: StoreCategory;
  description: string;
  isActive: boolean;
  totalProducts: number;
  totalViews: number;
  ratingAvg: number;
  ratingCount: number;
  tags: string[];
  isFavorited?: boolean;
  distance?: number;
  createdAt: string;
  updatedAt: string;
};

export type StoreProduct = {
  _id: string;
  store: string;
  owner: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  photos: string[];
  inStock: boolean;
  tags: string[];
  viewsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Store CRUD ──────────────────────────────────────────────────

export async function getMyStore(): Promise<Store> {
  const res = await authorizedFetch(`${apiBase()}/stores/mine`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'No store');
  return (await res.json()).store;
}

export async function getStore(storeId: string): Promise<Store> {
  const res = await fetch(`${apiBase()}/stores/${storeId}`);
  if (!res.ok) throw new Error('Store not found');
  return (await res.json()).store;
}

export type StoresFilter = {
  city?: string;
  delivery?: boolean;
  lat?: number;
  lng?: number;
  maxDistance?: number;
  q?: string;
  category?: string;
  page?: number;
};

export async function listStores(filter: StoresFilter = {}): Promise<{stores: Store[]; total: number}> {
  const params = new URLSearchParams();
  if (filter.city) params.set('city', filter.city);
  if (filter.delivery) params.set('delivery', 'true');
  if (filter.lat != null) params.set('lat', String(filter.lat));
  if (filter.lng != null) params.set('lng', String(filter.lng));
  if (filter.maxDistance != null) params.set('maxDistance', String(filter.maxDistance));
  if (filter.q) params.set('q', filter.q);
  if (filter.category) params.set('category', filter.category);
  if (filter.page) params.set('page', String(filter.page));

  const res = await fetch(`${apiBase()}/stores?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load stores');
  return res.json();
}

export async function getFeaturedStores(): Promise<Store[]> {
  const res = await fetch(`${apiBase()}/stores/featured`);
  if (!res.ok) return [];
  return (await res.json()).stores ?? [];
}

export type CreateStorePayload = {
  name: string;
  phone: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  hasDelivery: boolean;
  category: StoreCategory;
  description?: string;
  profilePhotoUri?: string;
  bannerImageUri?: string;
};

export async function createStore(payload: CreateStorePayload): Promise<Store> {
  const token = await getIdToken();
  const form = new FormData();
  form.append('name', payload.name);
  form.append('phone', payload.phone);
  form.append('city', payload.city);
  form.append('address', payload.address);
  form.append('lat', String(payload.lat));
  form.append('lng', String(payload.lng));
  form.append('hasDelivery', String(payload.hasDelivery));
  form.append('category', payload.category);
  if (payload.description) form.append('description', payload.description);

  if (payload.profilePhotoUri) {
    const ext = payload.profilePhotoUri.split('.').pop() ?? 'jpg';
    form.append('profilePhoto', {
      uri: payload.profilePhotoUri,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      name: `profile.${ext}`,
    } as never);
  }
  if (payload.bannerImageUri) {
    const ext = payload.bannerImageUri.split('.').pop() ?? 'jpg';
    form.append('bannerImage', {
      uri: payload.bannerImageUri,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      name: `banner.${ext}`,
    } as never);
  }

  const res = await fetch(`${apiBase()}/stores`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'Failed to create store');
  return body.store;
}

export type UpdateStorePayload = Partial<Omit<CreateStorePayload, 'lat' | 'lng'>> & {
  lat?: number;
  lng?: number;
};

export async function updateStore(storeId: string, payload: UpdateStorePayload): Promise<Store> {
  const token = await getIdToken();
  const form = new FormData();
  const fields: Array<keyof typeof payload> = ['name', 'phone', 'city', 'address', 'category', 'description'];
  for (const k of fields) {
    if (payload[k] != null) form.append(k, String(payload[k]));
  }
  if (payload.lat != null) form.append('lat', String(payload.lat));
  if (payload.lng != null) form.append('lng', String(payload.lng));
  if (payload.hasDelivery != null) form.append('hasDelivery', String(payload.hasDelivery));
  if (payload.profilePhotoUri) {
    const ext = payload.profilePhotoUri.split('.').pop() ?? 'jpg';
    form.append('profilePhoto', {uri: payload.profilePhotoUri, type: `image/${ext}`, name: `profile.${ext}`} as never);
  }
  if (payload.bannerImageUri) {
    const ext = payload.bannerImageUri.split('.').pop() ?? 'jpg';
    form.append('bannerImage', {uri: payload.bannerImageUri, type: `image/${ext}`, name: `banner.${ext}`} as never);
  }

  const res = await fetch(`${apiBase()}/stores/${storeId}`, {
    method: 'PUT',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'Failed to update store');
  return body.store;
}

// ─── Products ────────────────────────────────────────────────────

export async function listProducts(storeId: string, category?: string): Promise<StoreProduct[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${apiBase()}/stores/${storeId}/products${params}`);
  if (!res.ok) return [];
  return (await res.json()).products ?? [];
}

export type CreateProductPayload = {
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  category: string;
  inStock?: boolean;
  tags?: string;
  photoUris?: string[];
};

export async function createProduct(storeId: string, payload: CreateProductPayload): Promise<StoreProduct> {
  const token = await getIdToken();
  const form = new FormData();
  form.append('name', payload.name);
  form.append('price', String(payload.price));
  form.append('category', payload.category);
  if (payload.description) form.append('description', payload.description);
  if (payload.originalPrice) form.append('originalPrice', String(payload.originalPrice));
  if (payload.inStock != null) form.append('inStock', String(payload.inStock));
  if (payload.tags) form.append('tags', payload.tags);

  (payload.photoUris ?? []).forEach((uri, i) => {
    const ext = uri.split('.').pop() ?? 'jpg';
    form.append('photos', {uri, type: `image/${ext === 'jpg' ? 'jpeg' : ext}`, name: `photo_${i}.${ext}`} as never);
  });

  const res = await fetch(`${apiBase()}/stores/${storeId}/products`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'Failed to add product');
  return body.product;
}

export async function deleteProduct(storeId: string, productId: string): Promise<void> {
  const res = await authorizedFetch(`${apiBase()}/stores/${storeId}/products/${productId}`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to delete product');
}

// ─── Favorites ───────────────────────────────────────────────────

export async function favoriteStore(storeId: string): Promise<void> {
  await authorizedFetch(`${apiBase()}/stores/${storeId}/favorite`, {method: 'POST'});
}

export async function unfavoriteStore(storeId: string): Promise<void> {
  await authorizedFetch(`${apiBase()}/stores/${storeId}/favorite`, {method: 'DELETE'});
}
