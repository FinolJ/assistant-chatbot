
interface BotConversation {
  token: string;
  conversationId: string;
  expiresIn: number;
  watermark?: string;
}

// Almacén temporal de conversaciones
export const conversations = new Map<string, BotConversation>();

// Crear nueva conversación
export async function POST(): Promise<Response> {
  try {
    const directLineSecret = process.env.AZURE_BOT_DIRECT_LINE_SECRET;
    
    console.log('🔧 [CLIENT] Iniciando creación de conversación');
    
    if (!directLineSecret) {
      console.error('❌ [CLIENT] Direct Line Secret no configurado');
      return Response.json({ 
        error: 'Direct Line Secret no configurado' 
      }, { status: 500 });
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔧 [CLIENT] Creando conversación para: ${userId}`);

    const response = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${directLineSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: {
          id: userId,
          name: 'Usuario Web'
        }
      })
    });

    console.log('🔧 [CLIENT] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CLIENT] Error from Direct Line:', {
        status: response.status,
        error: errorText
      });
      
      return Response.json({ 
        error: `Error del Bot Service: ${response.status}`,
        details: errorText,
        suggestion: 'Verifica que el bot esté deployado y el endpoint sea accesible'
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ [CLIENT] Conversación creada:', {
      conversationId: data.conversationId,
      hasToken: !!data.token
    });
    
    const conversation: BotConversation = {
      token: data.token,
      conversationId: data.conversationId,
      expiresIn: data.expires_in || 3600,
      watermark: undefined
    };

    conversations.set(userId, conversation);

    return Response.json({
      userId,
      conversationId: data.conversationId,
      success: true
    });

  } catch (error) {
    console.error('❌ [CLIENT] Error crítico:', error);
    return Response.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// Enviar mensaje
export async function PUT(request: Request): Promise<Response> {
  try {
    const { userId, message } = await request.json();

    console.log('📤 [CLIENT] Enviando mensaje:', { userId, message: message?.substring(0, 50) });

    if (!userId || !message) {
      return Response.json({ 
        error: 'userId y message son requeridos' 
      }, { status: 400 });
    }

    const conversation = conversations.get(userId);
    if (!conversation) {
      return Response.json({ 
        error: 'Conversación no encontrada. Crea una nueva conversación primero.' 
      }, { status: 404 });
    }

    // Enviar mensaje al bot
    const sendUrl = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`;
    
    const messagePayload = {
      type: 'message',
      from: {
        id: userId,
        name: 'Usuario Web'
      },
      text: message.trim()
    };

    console.log('📤 [CLIENT] Enviando a:', sendUrl);

    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conversation.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('❌ [CLIENT] Error enviando mensaje:', {
        status: sendResponse.status,
        error: errorText
      });
      
      let errorMessage = 'Error enviando mensaje';
      if (sendResponse.status === 502) {
        errorMessage = 'Bot no disponible. Verifica que esté deployado correctamente.';
      }
      
      return Response.json({ 
        error: errorMessage,
        status: sendResponse.status,
        details: errorText
      }, { status: sendResponse.status });
    }

    // Esperar respuesta del bot
    console.log('⏳ [CLIENT] Esperando respuesta...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Obtener respuesta
    const botResponse = await getBotResponse(conversation);
    console.log('✅ [CLIENT] Respuesta obtenida', botResponse);
    
    return Response.json(botResponse);
    
  } catch (error) {
    console.error('❌ [CLIENT] Error:', error);
    return Response.json({
      error: 'Error procesando mensaje',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// Obtener respuesta del bot
async function getBotResponse(conversation: BotConversation, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let url = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`;
      if (conversation.watermark) {
        url += `?watermark=${conversation.watermark}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${conversation.token}`
        }
      });

      if (!response.ok) {
        if (attempt === maxRetries - 1) {
          throw new Error(`Error obteniendo respuesta: ${response.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const data = await response.json();

      console.log('📥 [CLIENT] Respuesta del bot:', data);

      if (data.watermark) {
        conversation.watermark = data.watermark;
      }

      // Filtrar solo mensajes del bot
      const botMessages = data.activities
        ?.filter((activity: any) => {
          return activity.type === 'message' && 
                 activity.from?.id !== conversation.conversationId && 
                 !activity.from?.id?.includes('user-') &&
                 activity.text;
        })
        ?.map((activity: any) => ({
          id: activity.id,
          text: activity.text,
          timestamp: activity.timestamp
        })) || [];

      if (botMessages.length > 0) {
        return { success: true, messages: botMessages };
      }

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  return { success: true, messages: [] };
}