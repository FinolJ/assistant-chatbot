'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createDirectLine } from 'botframework-webchat';

interface AssistantContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  directLine: ReturnType<typeof createDirectLine> | null;
  isConnected: boolean;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const useAssistant = () => {
    const context = useContext(AssistantContext);
    if (!context) throw new Error('useAssistant debe ser usado dentro de un AssistantProvider');
    return context;
};

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const initialize = async () => {
          try {
            const response = await fetch('/api/bot-token', { method: 'POST' });
            const { token } = await response.json();
            if (!token) throw new Error('Token no recibido de la API');
            setToken(token);
            setIsConnected(true);
          } catch (err) {
            console.error("Error al inicializar el bot:", err);
            setIsConnected(false);
          }
        };
        initialize();
    }, []);

    const directLine = useMemo(() => (token ? createDirectLine({ token }) : null), [token]);

    const value = { isOpen, setIsOpen, directLine, isConnected };

    return (
        <AssistantContext.Provider value={value}>
          {children}
        </AssistantContext.Provider>
    );
};