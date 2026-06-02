import React, {useContext, useState} from 'react';
import PocketBase from 'pocketbase';

const PocketBaseContext = React.createContext<PocketBase | null>(null);

export const PocketBaseProvider = ({children}: {children: React.ReactNode}) => {
  const [client] = useState(() => new PocketBase('http://localhost:8080'));

  return (
    <PocketBaseContext.Provider value={client}>
      {children}
    </PocketBaseContext.Provider>
  )
}

export const usePocketBase = () => {
  const context = useContext(PocketBaseContext);
  if (!context) {
    throw new Error('usePocketBase must be used within a PocketBaseProvider');
  }
  return context;
};