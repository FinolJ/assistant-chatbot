'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Sun, Moon } from 'lucide-react'; // Added Sun and Moon icons
import { useTheme } from 'next-themes'; // Import useTheme hook

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

export const BotChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const botSessionRef = useRef<BotSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Use the useTheme hook
  const { theme, setTheme } = useTheme();

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
      setMessages([{
        id: 'welcome',
        text: '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        from: 'bot',
        timestamp: new Date()
      }]);

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
  const handleSendMessage = async () => {
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
    }
    
    setIsLoading(false);
  };

  // Manejar Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Inicializar bot al montar el componente
  useEffect(() => {
    initializeBot();
  }, []);

  // Scroll automático al final de los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Estado de carga inicial
  if (!isConnected && !error) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted radius slide-in">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Conectando con el bot...</p>
          {debugInfo && (
            <p className="text-xs text-muted-foreground mt-2">{debugInfo}</p>
          )}
        </div>
      </div>
    );
  }

  // Estado de error
  if (error && !isConnected) {
    return (
      <div className="bg-destructive/10 border-colored radius p-6 text-center slide-in">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium">Error de conexión</p>
        <p className="text-destructive text-sm mt-1">{error}</p>
        {debugInfo && (
          <p className="text-xs text-destructive/70 mt-2">{debugInfo}</p>
        )}
        <button 
          onClick={initializeBot} 
          className="mt-4 px-4 py-2 bg-destructive text-primary-foreground radius hover:bg-destructive/90 transition-all duration-300"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 bg-card border-colored radius shadow-sm slide-in">
      {/* Header */}
      <div className="bg-accent text-accent-foreground p-4 radius flex items-center gap-2">
        <Bot size={20} />
        <h3 className="font-medium">Asistente Virtual</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-custom-green radius-full"></span>
          <span className="text-xs">Conectado</span>
        </div>
        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="ml-4 p-2 radius hover:bg-accent/80 transition-all duration-300"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Mensajes de error en tiempo real */}
      {error && isConnected && (
        <div className="bg-custom-yellow/10 border-bottom-colored p-2">
          <p className="text-custom-yellow text-xs">{error}</p>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-custom">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 slide-in ${
              message.from === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.from === 'user' 
                ? 'bg-accent/20 text-accent' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {message.from === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`min-w-0 max-w-[70%] px-4 py-2 radius break-words ${
              message.from === 'user'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground'
            }`}>
              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
              {message.attachments && message.attachments.length > 0 && (
                <p className="text-xs mt-1 opacity-70">
                  [{message.attachments.length} archivo(s) adjunto(s)]
                </p>
              )}
              <p className={`text-xs mt-1 ${
                message.from === 'user' ? 'text-accent-foreground/70' : 'text-muted-foreground'
              }`}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start gap-3 slide-in">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Bot size={16} className="text-muted-foreground" />
            </div>
            <div className="bg-muted radius px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-bottom-colored p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            className="flex-1 border-colored radius px-3 py-2 text-sm bg-background text-foreground placeholder-custom focus:border-accent transition-all duration-300"
            disabled={isLoading || !isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !isConnected}
            className="bg-accent text-accent-foreground px-4 py-2 radius hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};