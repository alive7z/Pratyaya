import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../lib/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then((data) => setAuth(data.data))
      .catch(() => setAuth(null))
      .finally(() => setLoading(false));
  }, []);

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
