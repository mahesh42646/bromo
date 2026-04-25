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

export type StorePlanId = 'basic' | 'premium' | 'gold';

export type StorePlan = {
  id: StorePlanId;
  title: string;
  monthlyPriceInr: number;
  billedAs: string;
  badge: 'standard' | 'premium' | 'gold';
  sortBoost: number;
  radiusKm: number;
  features: string[];
};

export type StoreSubscription = {
  planId: 'none' | StorePlanId;
  status: 'inactive' | 'pending' | 'active' | 'expired';
  badge: 'none' | 'standard' | 'premium' | 'gold';
  amountInr: number;
  startsAt: string | null;
  endsAt: string | null;
  lastOrderId: string;
  lastPaymentId: string;
  pendingPlanId: StorePlanId | null;
  pendingOrderId: string;
  pendingAmountInr: number;
  pendingCreatedAt: string | null;
};

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
  subscription: StoreSubscription;
  activePlan?: StorePlan | null;
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
  videoUrl?: string;
  inStock: boolean;
  tags: string[];
  viewsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function forceApiMediaUrl(url: string | undefined | null): string {
  if (!url?.trim()) return '';
  const input = url.trim();
  const base = apiBase().replace(/\/+$/, '');
  try {
    const parsed = new URL(input);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${base}${parsed.pathname}${parsed.search}`;
    }
    return input;
  } catch {
    if (input.startsWith('/uploads/')) return `${base}${input}`;
    return input;
  }
}

function normalizeProduct(product: StoreProduct): StoreProduct {
  return {
    ...product,
    photos: Array.isArray(product.photos) ? product.photos.map(p => forceApiMediaUrl(p)).filter(Boolean) : [],
  };
}

function normalizeStore(store: Store): Store {
  return {
    ...store,
    profilePhoto: forceApiMediaUrl(store.profilePhoto),
    bannerImage: forceApiMediaUrl(store.bannerImage),
  };
}

// ─── Store CRUD ──────────────────────────────────────────────────

export async function getMyStore(): Promise<Store> {
  const res = await authorizedFetch(`${apiBase()}/stores/mine`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'No store');
  return normalizeStore((await res.json()).store);
}

export async function getStore(storeId: string): Promise<Store> {
  const res = await fetch(`${apiBase()}/stores/${storeId}`);
  if (!res.ok) throw new Error('Store not found');
  return normalizeStore((await res.json()).store);
}

export type StoresFilter = {
  city?: string;
  delivery?: boolean;
  lat?: number;
  lng?: number;
  maxDistance?: number;
  q?: string;
  category?: string;
  minRating?: number;
  plan?: StorePlanId;
  sortBy?: 'nearest' | 'popular' | 'rating' | 'newest';
  page?: number;
  limit?: number;
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
  if (filter.minRating != null) params.set('minRating', String(filter.minRating));
  if (filter.plan) params.set('plan', filter.plan);
  if (filter.sortBy) params.set('sortBy', filter.sortBy);
  if (filter.page) params.set('page', String(filter.page));
  if (filter.limit != null) params.set('limit', String(filter.limit));

  const res = await fetch(`${apiBase()}/stores?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load stores');
  const body = await res.json();
  return {
    ...body,
    stores: Array.isArray(body.stores) ? body.stores.map(normalizeStore) : [],
  };
}

export async function getFeaturedStores(): Promise<Store[]> {
  const res = await fetch(`${apiBase()}/stores/featured`);
  if (!res.ok) return [];
  return ((await res.json()).stores ?? []).map(normalizeStore);
}

export async function getStorePlans(): Promise<StorePlan[]> {
  const res = await fetch(`${apiBase()}/stores/plans`);
  if (!res.ok) return [];
  return (await res.json()).plans ?? [];
}

export async function getMyStoreSubscription(): Promise<{
  subscription: StoreSubscription;
  activePlan: StorePlan | null;
  plans: StorePlan[];
}> {
  const res = await authorizedFetch(`${apiBase()}/stores/mine/subscription`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Failed to load subscription');
  return res.json();
}

export async function createStoreSubscriptionCheckout(planId: StorePlanId): Promise<{
  checkout: {
    provider: 'razorpay_simulated';
    orderId: string;
    amountInr: number;
    currency: 'INR';
    merchantName: string;
    plan: StorePlan;
    prefill: {name: string; email: string; contact: string};
  };
  store: Store;
}> {
  const res = await authorizedFetch(`${apiBase()}/stores/mine/subscription/checkout`, {
    method: 'POST',
    body: JSON.stringify({planId}),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'Failed to start checkout');
  return {...body, store: normalizeStore(body.store)};
}

export async function verifyStoreSubscriptionPayment(orderId: string, paymentId: string): Promise<{
  ok: true;
  message: string;
  subscription: StoreSubscription;
  activePlan: StorePlan;
  store: Store;
}> {
  const res = await authorizedFetch(`${apiBase()}/stores/mine/subscription/verify`, {
    method: 'POST',
    body: JSON.stringify({orderId, paymentId}),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'Payment verification failed');
  return {...body, store: normalizeStore(body.store)};
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
  return normalizeStore(body.store);
}

export type UpdateStorePayload = Partial<Omit<CreateStorePayload, 'lat' | 'lng'>> & {
  lat?: number;
  lng?: number;
  removeProfilePhoto?: boolean;
  removeBannerImage?: boolean;
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
  if (payload.removeProfilePhoto != null) form.append('removeProfilePhoto', String(payload.removeProfilePhoto));
  if (payload.removeBannerImage != null) form.append('removeBannerImage', String(payload.removeBannerImage));
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
  return normalizeStore(body.store);
}

// ─── Products ────────────────────────────────────────────────────

export async function listProducts(storeId: string, category?: string): Promise<StoreProduct[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${apiBase()}/stores/${storeId}/products${params}`);
  if (!res.ok) return [];
  return ((await res.json()).products ?? []).map(normalizeProduct);
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
  videoUrl?: string;
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
  if (payload.videoUrl != null) form.append('videoUrl', payload.videoUrl);

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
  return normalizeProduct(body.product);
}

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  replacePhotos?: boolean;
};

export async function updateProduct(storeId: string, productId: string, payload: UpdateProductPayload): Promise<StoreProduct> {
  const token = await getIdToken();
  const form = new FormData();

  if (payload.name != null) form.append('name', payload.name);
  if (payload.description != null) form.append('description', payload.description);
  if (payload.price != null) form.append('price', String(payload.price));
  if (payload.originalPrice !== undefined) form.append('originalPrice', payload.originalPrice ? String(payload.originalPrice) : '');
  if (payload.category != null) form.append('category', payload.category);
  if (payload.inStock != null) form.append('inStock', String(payload.inStock));
  if (payload.tags != null) form.append('tags', payload.tags);
  if (payload.videoUrl != null) form.append('videoUrl', payload.videoUrl);
  if (payload.replacePhotos != null) form.append('replacePhotos', String(payload.replacePhotos));

  (payload.photoUris ?? []).forEach((uri, i) => {
    const ext = uri.split('.').pop() ?? 'jpg';
    form.append('photos', {uri, type: `image/${ext === 'jpg' ? 'jpeg' : ext}`, name: `photo_${i}.${ext}`} as never);
  });

  const res = await fetch(`${apiBase()}/stores/${storeId}/products/${productId}`, {
    method: 'PUT',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? 'Failed to update product');
  return normalizeProduct(body.product);
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
