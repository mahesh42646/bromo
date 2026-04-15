import {authedFetch} from './authApi';

export type LedgerReason =
  | 'topup'
  | 'promotion_spend'
  | 'promotion_refund'
  | 'admin_credit'
  | 'admin_debit'
  | 'referral_reward';

export type LedgerEntry = {
  _id: string;
  delta: number;
  balanceAfter: number;
  reason: LedgerReason;
  refType?: 'Promotion' | 'Admin';
  refId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type CoinPackage = {
  id: 'starter' | 'pro' | 'creator' | 'elite';
  label: string;
  coins: number;
  priceLabel: string;
  highlight?: boolean;
};

export const COIN_PACKAGES: CoinPackage[] = [
  {id: 'starter', label: 'Starter', coins: 500, priceLabel: '₹49'},
  {id: 'pro', label: 'Pro', coins: 2000, priceLabel: '₹149', highlight: true},
  {id: 'creator', label: 'Creator', coins: 5000, priceLabel: '₹299'},
  {id: 'elite', label: 'Elite', coins: 15000, priceLabel: '₹799'},
];

export async function getWallet(): Promise<{balance: number; ledger: LedgerEntry[]}> {
  const res = await authedFetch('/wallet');
  if (!res.ok) throw new Error('Failed to fetch wallet');
  return res.json();
}

export async function buyCoins(packageId: CoinPackage['id']): Promise<{balance: number; credited: number}> {
  const res = await authedFetch('/wallet/self-topup', {
    method: 'POST',
    body: JSON.stringify({packageId}),
  });
  if (!res.ok) throw new Error('Top-up failed');
  return res.json();
}
