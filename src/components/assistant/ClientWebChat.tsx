'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const WebChatComponent = dynamic(
    
  () => import('botframework-webchat').then(mod => mod.default),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><p>Cargando chat...</p></div>
  }
);

type Props = {
    directLine: ReturnType<typeof import('botframework-webchat').createDirectLine> | null;
    styleOptions?: Record<string, any>;
}

const ClientWebChat = ({ directLine, styleOptions }: Props) => {
  if (!directLine) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Conectando...</p>
      </div>
    );
  }

  return <WebChatComponent directLine={directLine} styleOptions={styleOptions} />;
};

export default ClientWebChat;