"use client";

import React, { useEffect, useRef } from "react";
import { Send, Bot, User, AlertCircle, X, Minimize2 } from "lucide-react";
import { useAssistant } from "./AssistantProvider";

export const AssistantChat: React.FC = () => {
  const {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    isConnected,
    error,
    debugInfo,
    isOpen,
    setIsOpen,
    sendMessage,
    initializeBot,
  } = useAssistant();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Manejar Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Scroll automático al final de los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Estado de carga inicial
  if (!isConnected && !error) {
    return (
      <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border-colored radius shadow-lg z-50 slide-in">
        {/* Header */}
        <div className="bg-accent text-accent-foreground p-4 radius flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={20} />
            <h3 className="font-medium">Asistente Virtual</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="text-accent-foreground hover:text-accent-foreground/80 transition-all duration-300 cursor-pointer"
            >
              <Minimize2 size={16} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-accent-foreground hover:text-accent-foreground/80 transition-all duration-300 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Loading state */}
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Conectando con el bot...</p>
            {debugInfo && (
              <p className="text-xs text-muted-foreground mt-2">{debugInfo}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error && !isConnected) {
    return (
      <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border-colored radius shadow-lg z-50 slide-in">
        {/* Header */}
        <div className="bg-destructive text-primary-foreground p-4 radius flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} />
            <h3 className="font-medium">Error de Conexión</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-primary-foreground hover:text-primary-foreground/80 transition-all duration-300"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error content */}
        <div className="p-6 text-center h-80 flex flex-col justify-center">
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
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border-colored radius shadow-lg z-50 flex flex-col slide-in">
      {/* Header */}
      <div className="bg-accent text-accent-foreground p-4 radius flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <h3 className="font-medium">Asistente Virtual</h3>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-xs">En línea</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="text-accent-foreground hover:text-accent-foreground/80 transition-all duration-300 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
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
            className={`flex items-start gap-2 slide-in ${
              message.from === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                message.from === "user"
                  ? "bg-accent/20 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {message.from === "user" ? <User size={12} /> : <Bot size={12} />}
            </div>

            <div
              className={`min-w-0 max-w-[70%] px-3 py-2 radius break-words ${
                message.from === "user"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.text}
              </p>
              {message.attachments && message.attachments.length > 0 && (
                <p className="text-xs mt-1 opacity-70">
                  [{message.attachments.length} archivo(s) adjunto(s)]
                </p>
              )}
              <p
                className={`text-xs mt-1 ${
                  message.from === "user"
                    ? "text-accent-foreground/70"
                    : "text-muted-foreground"
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2 slide-in">
            <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
              <Bot size={12} className="text-muted-foreground" />
            </div>
            <div className="bg-muted radius px-3 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-bottom-colored p-3">
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
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading || !isConnected}
            className="bg-accent text-accent-foreground px-3 py-2 radius hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};