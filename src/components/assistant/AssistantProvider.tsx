'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// --- INTERFACES ---

interface Message {
  id: string;
  text: string;
  from: 'user' | 'bot';
  timestamp: Date;
  attachments?: any[];
}

interface BotSession {
  userId: string;
  token: string;
  conversationId: string;
}

interface AssistantContextType {
  // Chat state
  messages: Message[];
  inputMessage: string;
  setInputMessage: (message: string) => void;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  debugInfo: string;
  
  // UI state
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  unreadCount: number;
  
  // Actions
  sendMessage: () => Promise<void>;
  initializeBot: () => Promise<void>;
}

// --- CONTEXT CREATION ---

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (context === undefined) {
    throw new Error('useAssistant debe ser usado dentro de un AssistantProvider');
  }
  return context;
};

// --- PROVIDER COMPONENT ---

interface AssistantProviderProps {
  children: React.ReactNode;
}

export const AssistantProvider: React.FC<AssistantProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Usamos una ref para guardar la sesión del bot y evitar re-renderizados innecesarios.
  const botSessionRef = React.useRef<BotSession | null>(null);

  // Inicializa la conexión con el bot
  const initializeBot = async () => {
    // Evita reinicializar si ya está conectado
    if (isConnected || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      setDebugInfo('Iniciando conexión con el bot...');
      
      const response = await fetch('/api/bot-token', { method: 'POST' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error conectando con el bot');
      }

      const data = await response.json();
      
      botSessionRef.current = {
        userId: data.userId,
        token: data.token,
        conversationId: data.conversationId
      };
      
      setIsConnected(true);
      setDebugInfo(`Conectado exitosamente. Usuario ID: ${data.userId}`);
      
      const welcomeMessage: Message = {
        id: 'welcome',
        text: '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        from: 'bot',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
      
      if (!isOpen) {
        setUnreadCount(1);
      }

    } catch (error) {
      console.error('Error inicializando bot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      setDebugInfo(`Error de conexión: ${errorMessage}`);
    } finally {
        setIsLoading(false);
    }
  };

  // Envía un mensaje a nuestra API
  const sendMessageToBot = async (message: string) => {
    if (!botSessionRef.current) {
      throw new Error('Bot no inicializado');
    }

    setDebugInfo(`Enviando mensaje: "${message}"`);

    const response = await fetch('/api/bot-token', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: botSessionRef.current.userId,
        message: message
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error enviando mensaje');
    }

    const result = await response.json();
    setDebugInfo(`Respuesta recibida: ${result.messages?.length || 0} mensajes del bot`);
    
    return result;
  };

  // Lógica principal para enviar un mensaje
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isConnected) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputMessage.trim(),
      from: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    
    const currentMessage = inputMessage.trim();
    setInputMessage('');

    try {
      const result = await sendMessageToBot(currentMessage);
      
      // LÓGICA MODIFICADA: Procesa solo el ÚLTIMO mensaje del array.
      if (result.success && result.messages && Array.isArray(result.messages) && result.messages.length > 0) {
        
        // Tomamos solo el último mensaje de texto del array
        const lastMessageText = result.messages[result.messages.length - 1];

        const newBotMessage: Message = {
          id: `bot-${Date.now()}`,
          text: lastMessageText,
          from: 'bot' as const,
          timestamp: new Date()
        };

        // Añadimos ese único mensaje al estado del chat.
        setMessages(prev => [...prev, newBotMessage]);
        setDebugInfo(`Se agregó el último mensaje del bot`);
        
        // Si el chat no está abierto, incrementar contador de no leídos en 1.
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }

      } else {
        // Si la API no devuelve un formato esperado, lanzamos un error.
        throw new Error(result.error || 'No se recibió una respuesta válida del bot.');
      }
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error enviando mensaje';
      setError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
      
      const errorBotMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Lo siento, hubo un problema al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        from: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorBotMessage]);
      
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto para resetear el contador de no leídos cuando se abre el chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Efecto para inicializar el bot al montar el proveedor
  useEffect(() => {
    initializeBot();
  }, []);

  const value: AssistantContextType = {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    isConnected,
    error,
    debugInfo,
    isOpen,
    setIsOpen,
    unreadCount,
    sendMessage,
    initializeBot
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
};