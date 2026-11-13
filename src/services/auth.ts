import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const GIS_SCOPES = [
  ...SCOPES,
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Standard single-value prompt so Firebase Auth /__/auth/handler completes reliably
provider.setCustomParameters({
  prompt: 'select_account',
});

export const STORAGE_KEYS_AUTH = {
  ACCESS_TOKEN: 'bit_civil_google_access_token',
  USER_EMAIL: 'bit_civil_google_user_email',
  USER_NAME: 'bit_civil_google_user_name',
  USER_PHOTO: 'bit_civil_google_user_photo',
  CONNECTED_TIME: 'bit_civil_google_connected_time',
};

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

// In-memory only OAuth access token cache (never persisted to localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let tokenObtainedAt = 0;

// Clean up any legacy token previously stored in localStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS_AUTH.CONNECTED_TIME);
  } catch {
    // ignore storage errors
  }
}

export const isTokenStale = (): boolean => {
  if (!cachedAccessToken || !tokenObtainedAt) return true;
  const elapsed = Date.now() - tokenObtainedAt;
  // Google OAuth access tokens expire in 60 minutes. Consider stale at 50 minutes.
  return elapsed > 50 * 60 * 1000;
};

export const clearExpiredToken = () => {
  cachedAccessToken = null;
  tokenObtainedAt = 0;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEYS_AUTH.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS_AUTH.CONNECTED_TIME);
    } catch {
      // ignore
    }
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (firebaseUser: User | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (typeof window !== 'undefined') {
        try {
          if (user.email) localStorage.setItem(STORAGE_KEYS_AUTH.USER_EMAIL, user.email);
          if (user.displayName) localStorage.setItem(STORAGE_KEYS_AUTH.USER_NAME, user.displayName);
          if (user.photoURL) localStorage.setItem(STORAGE_KEYS_AUTH.USER_PHOTO, user.photoURL);
        } catch {
          // ignore
        }
      }

      if (cachedAccessToken && !isTokenStale()) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        clearExpiredToken();
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      // Preserve GIS token if one was explicitly obtained directly during this session
      if (cachedAccessToken && !isTokenStale()) {
        return;
      }
      clearExpiredToken();
      if (!isSigningIn && onAuthFailure) {
        onAuthFailure(null);
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
      throw new Error(
        'Google Sign-In completed, but no Google Sheets OAuth access token was returned. Please try again and allow Spreadsheet permissions.'
      );
    }
    cachedAccessToken = credential.accessToken;
    tokenObtainedAt = Date.now();

    if (typeof window !== 'undefined') {
      try {
        if (result.user.email) localStorage.setItem(STORAGE_KEYS_AUTH.USER_EMAIL, result.user.email);
        if (result.user.displayName) localStorage.setItem(STORAGE_KEYS_AUTH.USER_NAME, result.user.displayName);
        if (result.user.photoURL) localStorage.setItem(STORAGE_KEYS_AUTH.USER_PHOTO, result.user.photoURL);
      } catch {
        // ignore
      }
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const isGisReady = (): boolean => {
  return Boolean(typeof window !== 'undefined' && window.google?.accounts?.oauth2?.initTokenClient);
};

/**
 * Direct Google Identity Services OAuth Token Client fallback.
 * Bypasses Firebase Auth's /__/auth/iframe popup bridge which can fail with
 * auth/popup-closed-by-user in cross-origin preview iframes or strict browsers.
 * Must be invoked directly from a synchronous user click handler.
 */
export const googleSignInDirectGIS = (): Promise<{ user: User; accessToken: string }> => {
  const oauth2 = typeof window !== 'undefined' ? window.google?.accounts?.oauth2 : undefined;
  if (!oauth2?.initTokenClient) {
    return Promise.reject(
      new Error('Google Identity Services script is still loading. Please wait a second or open the app in a new tab.')
    );
  }

  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  if (!clientId) {
    return Promise.reject(new Error('OAuth Client ID is missing in configuration.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    isSigningIn = true;

    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      isSigningIn = false;
      reject(err);
    };

    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: GIS_SCOPES.join(' '),
        callback: async (resp: GisTokenResponse) => {
          if (settled) return;
          if (resp.error || !resp.access_token) {
            finishError(new Error(resp.error_description || resp.error || 'Google authorization did not return an access token.'));
            return;
          }

          const token = resp.access_token;
          cachedAccessToken = token;
          tokenObtainedAt = Date.now();

          let email = getSavedGoogleEmail() || 'google-user@bitsathy.ac.in';
          let displayName = 'Google Sheet User';
          let photoURL: string | null = null;
          let uid = 'gis-google-user';

          try {
            const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (infoRes.ok) {
              const profile = await infoRes.json();
              if (profile.email) email = profile.email;
              if (profile.name) displayName = profile.name;
              if (profile.picture) photoURL = profile.picture;
              if (profile.sub) uid = `gis-${profile.sub}`;
            }
          } catch {
            // Non-fatal; access_token is still valid for Google Sheets API
          }

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEYS_AUTH.USER_EMAIL, email);
              localStorage.setItem(STORAGE_KEYS_AUTH.USER_NAME, displayName);
              if (photoURL) localStorage.setItem(STORAGE_KEYS_AUTH.USER_PHOTO, photoURL);
            } catch {
              // ignore
            }
          }

          const gisUser = {
            uid,
            email,
            displayName,
            photoURL,
          } as unknown as User;

          settled = true;
          isSigningIn = false;
          resolve({ user: gisUser, accessToken: token });
        },
        error_callback: (err: { type?: string; message?: string }) => {
          const errType = err?.type || '';
          if (errType === 'popup_closed') {
            finishError(new Error('Google authorization popup was closed before completing sign-in. Try opening the app in a new tab.'));
          } else if (errType === 'popup_failed_to_open') {
            finishError(new Error('Browser blocked the Google authorization popup. Allow popups or click "Open App in New Tab".'));
          } else {
            finishError(new Error(err?.message || errType || 'Direct Google OAuth failed.'));
          }
        },
      });

      // Trigger synchronously during click gesture
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (e: any) {
      finishError(e instanceof Error ? e : new Error(String(e)));
    }
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  if (isTokenStale()) {
    clearExpiredToken();
    return null;
  }
  return cachedAccessToken;
};

export const getSavedGoogleEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS_AUTH.USER_EMAIL);
  }
  return null;
};

export const isGoogleConnected = (): boolean => {
  return Boolean(cachedAccessToken && !isTokenStale());
};

export const setManualAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  tokenObtainedAt = token ? Date.now() : 0;
};

export const googleSignOut = async () => {
  const tokenToRevoke = cachedAccessToken;
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  if (tokenToRevoke && typeof window !== 'undefined' && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tokenToRevoke);
    } catch {
      // ignore
    }
  }
  clearExpiredToken();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEYS_AUTH.USER_EMAIL);
      localStorage.removeItem(STORAGE_KEYS_AUTH.USER_NAME);
      localStorage.removeItem(STORAGE_KEYS_AUTH.USER_PHOTO);
    } catch {
      // ignore
    }
  }
};
