import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Property Basket API client (/api/v1).
 *
 * Base URL notes:
 *  - Android emulator reaches the host machine via 10.0.2.2.
 *  - Expo web / iOS simulator use 127.0.0.1.
 *  - Point EXPO_PUBLIC_API_URL at your LAN IP (e.g. http://192.168.0.12:8090)
 *    to test on a physical phone, or at the production domain.
 */
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:8090' : 'http://127.0.0.1:8090';
export const API_BASE = `${process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_HOST}/api/v1`;

const TOKEN_KEY = 'pb.token';

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken === null) cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, json.message ?? `Request failed (${res.status})`, json.errors);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};

/** Envelope every dashboard GET returns: the web page's Inertia props. */
export interface PageResponse<T> {
  component: string;
  data: T;
}
