'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Bot, HelpCircle } from 'lucide-react';
// Assuming AssistantProvider properly sets up the context
import { useAssistant } from './AssistantProvider'; 

export const AssistantBubble: React.FC = () => {
  const { isOpen, setIsOpen, unreadCount, isConnected } = useAssistant();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  // Animation for entry
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Hide pulse after a few seconds
  useEffect(() => {
    if (showPulse) {
      const timer = setTimeout(() => {
        setShowPulse(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showPulse]);

  // Show pulse when there are unread messages
  useEffect(() => {
    if (unreadCount > 0) {
      setShowPulse(true);
    }
  }, [unreadCount]);

  const handleClick = () => {
    setIsOpen(!isOpen);
    setShowPulse(false);
  };

  return (
    <>
      {/* Floating button */}
      <div 
        className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ${
          isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <button 
          onClick={handleClick}
          className={`relative w-14 h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full shadow-lg transition-all duration-300 flex items-center justify-center group cursor-pointer ${
            isOpen ? 'scale-90' : 'hover:scale-110'
          }`}
          aria-label="Abrir asistente virtual"
        >
          {/* Main icon */}
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            {isConnected ? (
              <MessageCircle size={24} className="transition-all duration-200" />
            ) : (
              <Bot size={24} className="transition-all duration-200" />
            )}
          </div>

          {/* Unread messages badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}

          {/* Pulse effect */}
          {showPulse && !isOpen && (
            <div className="absolute inset-0 rounded-full bg-accent/40 animate-ping opacity-30"></div>
          )}

          {/* Tooltip */}
          <div className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-card border-colored radius text-foreground text-sm px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-lg">
            {isOpen ? 'Minimizar chat' : 'Abrir asistente'}
            {/* The arrow for the tooltip will also pick up theme colors if 'border-card' is set correctly */}
            <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-card"></div>
          </div>
        </button>
      </div>

      {/* Initial help indicator (optional) */}
      {!isOpen && showPulse && isAnimating && (
        <div className="fixed bottom-20 right-4 z-30 bg-card border-colored radius shadow-lg p-3 max-w-xs slide-in">
          <div className="flex items-start gap-2">
            <HelpCircle size={16} className="text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">¿Necesitas ayuda?</p>
              <p className="text-xs text-muted-foreground mt-1">Haz clic en el botón para chatear conmigo</p>
            </div>
          </div>
          {/* Small arrow pointing to the button */}
          <div className="absolute bottom-0 right-6 transform translate-y-1/2 rotate-45 w-2 h-2 bg-card border-r border-b border-colored"></div>
        </div>
      )}

      {/* Styles for fadeIn animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
};