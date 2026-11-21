import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface PendingOnboarding {
  username?: string;
  displayName?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  pendingOnboarding: PendingOnboarding | null;
  clearAuthError: () => void;
  setPendingOnboarding: (data: PendingOnboarding | null) => void;
  signInWithGoogle: (onboarding?: PendingOnboarding) => Promise<User | null>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
    username?: string
  ) => Promise<User | null>;
  resetPassword: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau kata sandi salah. Silakan periksa kembali.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk melalui tab Masuk.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.';
    case 'auth/popup-closed-by-user':
      return 'Jendela masuk Google ditutup sebelum proses selesai.';
    case 'auth/operation-not-allowed':
      return 'Login Email/Kata Sandi belum diaktifkan di Firebase Console proyek ini (Authentication → Sign-in method → Email/Password). Anda tetap dapat langsung Masuk atau Daftar dengan tombol Google di bawah.';
    default:
      return err instanceof Error
        ? err.message
        : 'Terjadi kesalahan saat memproses autentikasi.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingOnboarding, setPendingOnboarding] =
    useState<PendingOnboarding | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async (onboarding?: PendingOnboarding) => {
    setAuthError(null);
    if (onboarding?.username || onboarding?.displayName) {
      setPendingOnboarding(onboarding);
    }
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      return result.user;
    } catch (err: unknown) {
      setAuthError(mapFirebaseAuthError(err));
      return null;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      return result.user;
    } catch (err: unknown) {
      setAuthError(mapFirebaseAuthError(err));
      return null;
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    username?: string
  ) => {
    setAuthError(null);
    setPendingOnboarding({
      username: username?.trim() || undefined,
      displayName: displayName.trim() || undefined,
    });
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      if (displayName.trim()) {
        await updateProfile(result.user, {
          displayName: displayName.trim(),
        });
      }
      return result.user;
    } catch (err: unknown) {
      setPendingOnboarding(null);
      setAuthError(mapFirebaseAuthError(err));
      return null;
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (err: unknown) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    }
  };

  const signOut = async () => {
    setAuthError(null);
    setPendingOnboarding(null);
    await firebaseSignOut(auth);
  };

  const authFetch = async (
    input: RequestInfo | URL,
    init: RequestInit = {}
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Sesi tidak aktif. Silakan masuk kembali.');
    }
    const token = await currentUser.getIdToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(input, { ...init, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        pendingOnboarding,
        clearAuthError,
        setPendingOnboarding,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        signOut,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
