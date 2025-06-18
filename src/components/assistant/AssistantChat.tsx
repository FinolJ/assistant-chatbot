"use client";

import React from "react";
import ClientWebChat from "./ClientWebChat"; 
import { Send, Bot, User, AlertCircle, X, Minimize2 } from "lucide-react";
import { useAssistant } from "./AssistantProvider";

export const AssistantChat: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    directLine,
    isConnected,
  } = useAssistant();

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border-colored radius shadow-lg z-50 flex flex-col slide-in">
      <div className="bg-accent text-accent-foreground p-4 radius flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <h3 className="font-medium">Asistente Virtual</h3>
          {isConnected && (
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-xs">En línea</span>
            </div>
          )}
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
      
      <div className="flex-1" style={{ position: 'relative' }}>
        {isConnected && directLine ? (
          <ClientWebChat directLine={directLine} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Conectando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};