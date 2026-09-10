import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { apiLogin, apiRegisterParent, apiMe } from '../api/resources';
import { getTokens, setTokens, errorMessage } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (payload: { nom: string; prenom: string; email: string; password: string }) => Promise<boolean>;
  logout: () => void;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, login: async () => false, register: async () => false, logout: () => {}, authError: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Au chargement de l'app : si des tokens sont déjà stockés (session précédente),
  // on tente de restaurer la session en interrogeant /api/auth/me/.
  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) { setLoading(false); return; }
    apiMe()
      .then(setUser)
      .catch(() => setTokens(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const { access, refresh, user: loggedInUser } = await apiLogin(email, password);
      setTokens({ access, refresh });
      setUser(loggedInUser);
      return true;
    } catch {
      setAuthError('Email ou mot de passe incorrect.');
      return false;
    }
  };

  const register = async (payload: { nom: string; prenom: string; email: string; password: string }): Promise<boolean> => {
    setAuthError(null);
    try {
      const { access, refresh, user: newUser } = await apiRegisterParent(payload);
      setTokens({ access, refresh });
      setUser(newUser);
      return true;
    } catch (err) {
      setAuthError(errorMessage(err));
      return false;
    }
  };

  const logout = () => {
    setTokens(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, authError }}>
      {children}
    </AuthContext.Provider>
  );
};
