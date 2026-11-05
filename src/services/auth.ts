import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './firebase';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Ensure persistent access to offline Google connection
provider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline',
});

export const STORAGE_KEYS_AUTH = {
  ACCESS_TOKEN: 'bit_civil_google_access_token',
  USER_EMAIL: 'bit_civil_google_user_email',
  USER_NAME: 'bit_civil_google_user_name',
  USER_PHOTO: 'bit_civil_google_user_photo',
  CONNECTED_TIME: 'bit_civil_google_connected_time',
};

export const isTokenStale = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
  if (!token) return true;
  const timeStr = localStorage.getItem(STORAGE_KEYS_AUTH.CONNECTED_TIME);
  if (!timeStr) return false;
  const elapsed = Date.now() - Number(timeStr);
  // Google OAuth access tokens expire in 60 minutes. Consider stale at 55 minutes.
  return elapsed > 55 * 60 * 1000;
};

export const clearExpiredToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS_AUTH.CONNECTED_TIME);
  }
};

let isSigningIn = false;
let cachedAccessToken: string | null = null;
if (typeof window !== 'undefined') {
  if (!isTokenStale()) {
    cachedAccessToken = localStorage.getItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
  } else {
    clearExpiredToken();
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (isTokenStale()) {
        clearExpiredToken();
      } else if (!cachedAccessToken && typeof window !== 'undefined') {
        cachedAccessToken = localStorage.getItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
      }

      if (typeof window !== 'undefined') {
        if (user.email) localStorage.setItem(STORAGE_KEYS_AUTH.USER_EMAIL, user.email);
        if (user.displayName) localStorage.setItem(STORAGE_KEYS_AUTH.USER_NAME, user.displayName);
        if (user.photoURL) localStorage.setItem(STORAGE_KEYS_AUTH.USER_PHOTO, user.photoURL);
        if (cachedAccessToken) {
          localStorage.setItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN, cachedAccessToken);
        }
      }

      if (cachedAccessToken && onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (onAuthFailure) {
        onAuthFailure();
      }
    } else {
      clearExpiredToken();
      if (!isSigningIn && onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain access token from Google Sign-In.');
    }
    cachedAccessToken = credential.accessToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN, cachedAccessToken);
      if (result.user.email) localStorage.setItem(STORAGE_KEYS_AUTH.USER_EMAIL, result.user.email);
      if (result.user.displayName) localStorage.setItem(STORAGE_KEYS_AUTH.USER_NAME, result.user.displayName);
      if (result.user.photoURL) localStorage.setItem(STORAGE_KEYS_AUTH.USER_PHOTO, result.user.photoURL);
      localStorage.setItem(STORAGE_KEYS_AUTH.CONNECTED_TIME, String(Date.now()));
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (isTokenStale()) {
    clearExpiredToken();
    return null;
  }
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
    if (saved) {
      cachedAccessToken = saved;
      return saved;
    }
  }
  return null;
};

export const getSavedGoogleEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS_AUTH.USER_EMAIL);
  }
  return null;
};

export const isGoogleConnected = (): boolean => {
  if (isTokenStale()) return false;
  return Boolean(
    cachedAccessToken ||
    (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN))
  );
};

export const setManualAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS_AUTH.CONNECTED_TIME, String(Date.now()));
    } else {
      localStorage.removeItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
    }
  }
};

export const googleSignOut = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS_AUTH.USER_EMAIL);
    localStorage.removeItem(STORAGE_KEYS_AUTH.USER_NAME);
    localStorage.removeItem(STORAGE_KEYS_AUTH.USER_PHOTO);
    localStorage.removeItem(STORAGE_KEYS_AUTH.CONNECTED_TIME);
  }
};
