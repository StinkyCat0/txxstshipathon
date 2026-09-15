/**
 * API client for the FastAPI backend. Single source of truth for endpoints.
 *
 * Base URL: derives the LAN host from Expo's hostUri so physical devices
 * reach the dev machine; falls back to localhost for web/simulator.
 * Override with EXPO_PUBLIC_API_URL.
 */
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File, UploadType } from 'expo-file-system';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8001`;
  }
  return Platform.select({ android: 'http://10.0.2.2:8001', default: 'http://localhost:8001' })!;
}

export const API_URL = resolveBaseUrl();

/** Turn a backend-relative path ("/uploads/x.png") into an absolute URL. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

// ---------- types (mirror backend schemas) ----------

export interface UserSummary {
  id: number;
  name: string;
  age: number;
  bio: string;
  photo: string | null;
}

export interface PromptAnswer {
  prompt_key: string;
  answer: string;
}

export interface Profile {
  id: number;
  name: string;
  age: number;
  bio: string;
  location: string;
  gender: string;
  interested_in: string;
  profile_complete: boolean;
  photos: string[];
  prompts: PromptAnswer[];
}

export interface Post {
  id: number;
  text: string;
  image: string | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  author_id: number;
  author_name: string;
  author_age: number;
  author_photo: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  text: string;
  author_id: number;
  author_name: string;
  author_photo: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: number;
  name: string;
  photo: string | null;
  matches: number;
  post_likes: number;
  right_swipes_received: number;
  score: number;
}
export interface MatchEntry {
  match_id: number;
  matched_at: string;
  profile: Profile;
}

export interface Message {
  id: number;
  match_id: number;
  sender_id: number;
  text: string;
  created_at: string;
}

// ---------- request helper ----------

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

/** POST one image as multipart/form-data to `url`; returns the parsed body. */
async function uploadFile<T>(
  url: string,
  uri: string,
  meta?: { fileName?: string | null; mimeType?: string | null },
): Promise<T> {
  if (Platform.OS === 'web') {
    const form = new FormData();
    const filename = meta?.fileName ?? uri.split('/').pop() ?? 'photo.jpg';
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, filename);
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`upload -> ${res.status}`);
    return res.json();
  }
  // Normalize to JPEG: decodes HEIC and resolves ph:// iCloud refs into a
  // real file. Fall back to the raw asset if manipulation fails or stalls.
  let fileUri = uri;
  let mimeType = meta?.mimeType ?? 'image/jpeg';
  try {
    const image = await Promise.race([
      manipulateAsync(uri, [], { compress: 0.9, format: SaveFormat.JPEG }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('manipulate timeout')), 15000),
      ),
    ]);
    fileUri = image.uri;
    mimeType = 'image/jpeg';
  } catch {
    // upload the original asset as-is; backend transcodes what it can
  }
  // expo/fetch rejects React Native's {uri,name,type} FormData parts, so
  // upload natively through expo-file-system instead of FormData.
  const result = await new File(fileUri).upload(url, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`upload -> ${result.status}`);
  }
  return JSON.parse(result.body);
}

// ---------- endpoints ----------

export const api = {
  listUsers: () => req<UserSummary[]>('GET', '/users'),

  createUser: (input: { name: string; age: number; bio?: string; location?: string; gender?: string; interested_in?: string }) =>
    req<{ id: number; token: string }>('POST', '/users', input),

  updateUser: (id: number, patch: Partial<{ name: string; age: number; bio: string; location: string; gender: string; interested_in: string }>) =>
    req<Profile>('PATCH', `/users/${id}`, patch),

  getProfile: (id: number) => req<Profile>('GET', `/profiles/${id}`),

  setPrompts: (id: number, prompts: PromptAnswer[]) =>
    req<Profile>('PUT', `/users/${id}/prompts`, prompts),

  uploadPhoto: (
    id: number,
    uri: string,
    meta?: { fileName?: string | null; mimeType?: string | null },
  ) => uploadFile<{ url: string }>(`${API_URL}/users/${id}/photos`, uri, meta),

  /** Store an image and get back its filename for use in a post. */
  uploadImage: (uri: string, meta?: { fileName?: string | null; mimeType?: string | null }) =>
    uploadFile<{ path: string }>(`${API_URL}/uploads`, uri, meta),

  createPost: (userId: number, input: { text: string; image?: string | null }) =>
    req<Post>('POST', `/posts?user_id=${userId}`, input),

  getFeed: (userId: number) => req<Post[]>('GET', `/feed?user_id=${userId}`),

  toggleLike: (postId: number, userId: number) =>
    req<{ liked: boolean; like_count: number }>('POST', `/posts/${postId}/like?user_id=${userId}`),

  getComments: (postId: number) => req<Comment[]>('GET', `/posts/${postId}/comments`),

  addComment: (postId: number, userId: number, input: { text: string; parent_id?: number | null }) =>
    req<Comment>('POST', `/posts/${postId}/comments?user_id=${userId}`, input),

  getDeck: (userId: number) => req<Profile[]>('GET', `/deck?user_id=${userId}`),

  swipe: (swiperId: number, swipedId: number, direction: 'left' | 'right') =>
    req<{ matched: boolean; match_id: number | null }>('POST', `/swipes?swiper_id=${swiperId}`, {
      swiped_id: swipedId,
      direction,
    }),
  getMatches: (userId: number) => req<MatchEntry[]>('GET', `/users/${userId}/matches`),

  getMessages: (matchId: number, userId: number) =>
    req<Message[]>('GET', `/matches/${matchId}/messages?user_id=${userId}`),

  sendMessage: (matchId: number, userId: number, text: string) =>
    req<Message>('POST', `/matches/${matchId}/messages?user_id=${userId}`, { text }),

  getLeaderboard: () => req<LeaderboardEntry[]>('GET', '/leaderboard'),
};
