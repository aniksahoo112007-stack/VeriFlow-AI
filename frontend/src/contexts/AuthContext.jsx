import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setAccessToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const apply = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);
  useEffect(() => {
    api
      .post("/auth/refresh")
      .then(({ data }) => apply(data.data))
      .catch(() => setAccessToken(null))
      .finally(() => setReady(true));
    const reset = () => setUser(null);
    window.addEventListener("veriflow:logout", reset);
    return () => window.removeEventListener("veriflow:logout", reset);
  }, [apply]);
  const value = useMemo(
    () => ({
      user,
      ready,
      login: async (payload) => {
        const { data } = await api.post("/auth/login", payload);
        apply(data.data);
      },
      register: async (payload) => {
        const { data } = await api.post("/auth/register", payload);
        apply(data.data);
      },
      googleLogin: async (credential) => {
        const { data } = await api.post("/auth/google", { credential });
        apply(data.data);
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, ready, apply],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
