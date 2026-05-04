import {authedFetch} from './authApi';

export type TurnCredentials = {
  iceServers: Array<{urls: string | string[]; username?: string; credential?: string}>;
  nonce: string;
  expiresAt: number;
};

export async function fetchTurnCredentials(): Promise<TurnCredentials | null> {
  const res = await authedFetch('/calls/turn-credentials', {method: 'POST'});
  if (!res.ok) return null;
  return res.json() as Promise<TurnCredentials>;
}
