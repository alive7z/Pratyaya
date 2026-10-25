import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { authApi } from "../lib/apiClient.js";

const AuthContext = createContext(null);

function normalizeAuth(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const session =
    data.data && typeof data.data === "object" && !data.user && !data.membership
      ? data.data
      : data;

  if (!session.user) {
    return null;
  }

  const merchantId =
    session.membership?.merchant?.id ??
    session.membership?.merchant?._id ??
    session.merchant?.id ??
    session.merchant?._id ??
    session.merchantId ??
    null;

  return {
    ...session,
    merchantId,
    permissions: Array.isArray(session.permissions)
      ? [...new Set(session.permissions)]
      : [],
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(false);
  const authVersionRef = useRef(0);

  const setAuth = useCallback((data) => {
    authVersionRef.current += 1;
    setAuthState(normalizeAuth(data));
    setLoading(false);
  }, []);

  const clearAuth = useCallback(() => {
    authVersionRef.current += 1;
    setAuthState(null);
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(async () => {
    const requestVersion = ++authVersionRef.current;

    try {
      const response = await authApi.me();
      const normalizedAuth = normalizeAuth(response?.data);

      if (mountedRef.current && requestVersion === authVersionRef.current) {
        setAuthState(normalizedAuth);
        setLoading(false);
      }

      return normalizedAuth;
    } catch (error) {
      if (mountedRef.current && requestVersion === authVersionRef.current) {
        setAuthState(null);
        setLoading(false);
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    refreshAuth().catch(() => {});

    return () => {
      mountedRef.current = false;
      authVersionRef.current += 1;
    };
  }, [refreshAuth]);

  const hasPermission = useCallback(
    (permission) => {
      if (!auth || !permission) {
        return false;
      }

      return auth.permissions.includes(permission);
    },
    [auth],
  );

  const hasAnyPermission = useCallback(
    (permissions) => {
      if (!auth || !Array.isArray(permissions)) {
        return false;
      }

      return permissions.some((permission) =>
        auth.permissions.includes(permission),
      );
    },
    [auth],
  );

  const hasAllPermissions = useCallback(
    (permissions) => {
      if (!auth || !Array.isArray(permissions)) {
        return false;
      }

      return permissions.every((permission) =>
        auth.permissions.includes(permission),
      );
    },
    [auth],
  );

  const value = useMemo(
    () => ({
      auth,
      loading,
      isAuthenticated: Boolean(auth),
      user: auth?.user ?? null,
      membership: auth?.membership ?? null,
      merchantId: auth?.merchantId ?? null,
      role: auth?.membership?.role ?? null,
      permissions: auth?.permissions ?? [],
      setAuth,
      clearAuth,
      refreshAuth,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [
      auth,
      loading,
      setAuth,
      clearAuth,
      refreshAuth,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
