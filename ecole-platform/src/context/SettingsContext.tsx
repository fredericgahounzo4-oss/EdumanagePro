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
  /** Boîte postale de l'établissement, affichée sur les documents officiels (bulletins, reçus). */
  bp: string;
  telephone1: string;
  telephone2: string;
  /** En-tête ministériel affiché sur les bulletins (ex. "Ministère des Enseignements Primaire et Secondaire"). */
  ministere: string;
  /** Nom du pays tel qu'affiché sur les documents officiels (ex. "République Togolaise"). */
  republique: string;
  /** Devise nationale affichée sur les bulletins (ex. "Travail - Liberté - Patrie"). */
  deviseNationale: string;
  /** Couleur d'accent utilisée sur le bulletin de notes (en-tête, tableau, moyenne). */
  couleurBulletin: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  nomEcole: 'Complexe Scolaire St Martial',
  ville: 'Lomé',
  pays: 'Togo',
  anneeScolaire: '2025-2026',
  devise: 'FCFA',
  langue: 'fr',
  theme: 'clair',
  emailNotif: true,
  smsNotif: false,
  bp: '5090',
  telephone1: '90 84 18 10',
  telephone2: '91 99 36 29',
  ministere: 'Ministère des Enseignements Primaire et Secondaire',
  republique: 'République Togolaise',
  deviseNationale: 'Travail - Liberté - Patrie',
  couleurBulletin: '#2563a8',
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
