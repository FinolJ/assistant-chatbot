'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

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

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (context === undefined) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
};

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
  
  const botSessionRef = useRef<BotSession | null>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Inicializar conexión con el bot
  const initializeBot = async () => {
    try {
      setError(null);
      setDebugInfo('Iniciando conexión con el bot...');
      
      const response = await fetch('/api/bot-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

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
      
      // Mensaje de bienvenida
      const welcomeMessage: Message = {
        id: 'welcome',
        text: '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        from: 'bot',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
      
      // Si el chat no está abierto, incrementar contador de no leídos
      if (!isOpen) {
        setUnreadCount(1);
      }

    } catch (error) {
      console.error('Error inicializando bot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      setDebugInfo(`Error de conexión: ${errorMessage}`);
    }
  };

  // Enviar mensaje al bot a través de nuestra API
  const sendMessageToBot = async (message: string) => {
    if (!botSessionRef.current) {
      throw new Error('Bot no inicializado');
    }

    setDebugInfo(`Enviando mensaje: "${message}"`);

    const response = await fetch('/api/bot-token', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
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
    setDebugInfo(`Respuesta recibida: ${result.botMessages?.length || 0} mensajes del bot`);
    
    return result;
  };

  // Manejar envío de mensaje
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isConnected) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputMessage.trim(),
      from: 'user',
      timestamp: new Date()
    };

    // Agregar mensaje del usuario inmediatamente
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    
    const currentMessage = inputMessage.trim();
    setInputMessage('');

    try {
      const result = await sendMessageToBot(currentMessage);
      
      if (result.success && result.botMessages && result.botMessages.length > 0) {
        // Agregar mensajes del bot que no hemos procesado antes
        const newBotMessages = result.botMessages
          .filter((msg: any) => !processedMessageIds.current.has(msg.id))
          .map((msg: any) => {
            processedMessageIds.current.add(msg.id);
            return {
              id: msg.id,
              text: msg.text,
              from: 'bot' as const,
              timestamp: new Date(msg.timestamp || Date.now()),
              attachments: msg.attachments
            };
          });

        if (newBotMessages.length > 0) {
          setMessages(prev => [...prev, ...newBotMessages]);
          setDebugInfo(`Se agregaron ${newBotMessages.length} mensajes del bot`);
          
          // Si el chat no está abierto, incrementar contador de no leídos
          if (!isOpen) {
            setUnreadCount(prev => prev + newBotMessages.length);
          }
        } else {
          setDebugInfo('No se encontraron mensajes nuevos del bot');
        }
      } else {
        // Si no hay respuesta del bot después de todos los reintentos
        const fallbackMessage: Message = {
          id: `bot-fallback-${Date.now()}`,
          text: 'No he podido procesar tu mensaje en este momento. ¿Podrías intentar reformularlo?',
          from: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setDebugInfo('No se recibió respuesta del bot, usando mensaje fallback');
        
        // Si el chat no está abierto, incrementar contador de no leídos
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      }
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error enviando mensaje';
      setError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
      
      // Mensaje de error para el usuario
      const errorBotMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Lo siento, hubo un problema al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        from: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorBotMessage]);
      
      // Si el chat no está abierto, incrementar contador de no leídos
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    }
    
    setIsLoading(false);
  };

  // Resetear contador cuando se abre el chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Inicializar bot al montar el componente
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