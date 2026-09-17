import React from 'react';
import { WifiOff } from 'lucide-react';
import { useConnectivity } from '../context/ConnectivityContext';

const OfflineBanner: React.FC = () => {
  const { isOnline } = useConnectivity();
  if (isOnline) return null;

  return (
    <div style={{
      background: '#7c2d12', color: 'white', fontSize: 12, fontWeight: 600,
      padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
    }}>
      <WifiOff size={13} />
      Hors connexion — vous consultez les dernières données synchronisées. Les notes, présences et paiements que vous saisissez seront envoyés automatiquement à la reconnexion.
    </div>
  );
};

export default OfflineBanner;
