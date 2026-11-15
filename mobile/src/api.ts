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
export const API_HOST = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_HOST;
export const API_BASE = `${API_HOST}/api/v1`;

/** Site-relative image paths (/storage/…, /images/…) need the site's host in the app. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
}

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

/** A photo picked from the camera or gallery, ready to attach to a form. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

/** Adds a picked file to multipart form data (native takes the uri; web needs the bytes). */
export async function appendFile(form: FormData, field: string, file: LocalFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
  } else {
    form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
}

/** POST multipart form data (photo uploads). The runtime sets the Content-Type boundary. */
async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      res.status === 413 ? 'Those photos are too large to upload. Try fewer or smaller photos.' : json.message ?? `Request failed (${res.status})`,
      json.errors,
    );
  }
  return json as T;
}

export const api = {
  upload,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/** First validation message from a 422, else the error's message. */
export function errorText(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof ApiError && e.errors) {
    const first = Object.values(e.errors)[0]?.[0];
    if (first) return first;
  }
  return (e as Error)?.message ?? fallback;
}

/** Envelope every dashboard GET returns: the web page's Inertia props. */
export interface PageResponse<T> {
  component: string;
  data: T;
}
