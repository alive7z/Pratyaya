import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { authApi } from "../lib/apiClient.js";

const AuthContext = createContext(null);

function normalizeAuth(data) {
  if (!data) return null;
  const merchantId =
    data.membership?.merchant?.id || data.merchant?.id || data.merchantId;
  return {
    ...data,
    merchantId,
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAuth = useCallback((data) => {
    setAuthState(normalizeAuth(data));
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then((res) => setAuth(res.data))
      .catch(() => setAuthState(null))
      .finally(() => setLoading(false));
  }, [setAuth]);

  return (
    <AuthContext.Provider value={{ auth, loading, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
