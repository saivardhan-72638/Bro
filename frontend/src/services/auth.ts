export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "bro-token";

export interface User {
  id: number;
  email: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}

// fetch() that automatically sends the login token
export async function authFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    notifyUnauthorized();
  }

  return res;
}

async function authRequest(
  path: "/auth/login" | "/auth/register",
  email: string,
  password: string
): Promise<User> {
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      data && typeof data.detail === "string"
        ? data.detail
        : "Something went wrong. Please try again.";

    throw new Error(detail);
  }

  setToken(data.token);
  return data.user as User;
}

export function login(email: string, password: string) {
  return authRequest("/auth/login", email, password);
}

export function register(email: string, password: string) {
  return authRequest("/auth/register", email, password);
}

export async function fetchMe(): Promise<User | null> {
  if (!getToken()) return null;

  try {
    const res = await authFetch("/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}