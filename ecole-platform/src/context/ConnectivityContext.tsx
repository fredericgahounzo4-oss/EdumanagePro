import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ConnectivityContextType {
  isOnline: boolean;
  /** Incrémenté à chaque passage hors-ligne -> en ligne. À ajouter aux
   * dépendances d'un useEffect de chargement de données pour déclencher un
   * rafraîchissement automatique au retour de connexion (ce qui remplace
   * naturellement les éléments "pending" par les vraies données du serveur). */
  reconnectedAt: number;
}

const ConnectivityContext = createContext<ConnectivityContextType>({ isOnline: true, reconnectedAt: 0 });

export const useConnectivity = () => useContext(ConnectivityContext);

export const ConnectivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [reconnectedAt, setReconnectedAt] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setReconnectedAt(Date.now());
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline, reconnectedAt }}>
      {children}
    </ConnectivityContext.Provider>
  );
};
