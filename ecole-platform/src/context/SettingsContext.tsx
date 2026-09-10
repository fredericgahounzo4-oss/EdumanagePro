import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Langue, translations } from '../i18n';

export interface AppSettings {
  nomEcole: string;
  ville: string;
  pays: string;
  anneeScolaire: string;
  devise: string;
  langue: Langue;
  theme: 'clair' | 'sombre';
  emailNotif: boolean;
  smsNotif: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  nomEcole: 'EduManage Pro',
  ville: 'Lomé',
  pays: 'Togo',
  anneeScolaire: '2024-2025',
  devise: 'FCFA',
  langue: 'fr',
  theme: 'clair',
  emailNotif: true,
  smsNotif: false,
};

const STORAGE_KEY = 'edumanage-settings';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  t: (key: string) => key,
});

export const useSettings = () => useContext(SettingsContext);

const loadInitial = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore corrupted storage
  }
  return DEFAULT_SETTINGS;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.theme === 'sombre');
    document.documentElement.lang = settings.langue;
  }, [settings]);

  const updateSettings = (patch: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...patch }));

  const t = (key: string): string => translations[settings.langue]?.[key] ?? translations.fr[key] ?? key;

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, t }}>
      {children}
    </SettingsContext.Provider>
  );
};
