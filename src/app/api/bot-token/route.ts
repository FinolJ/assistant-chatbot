interface BotConversation {
  token: string;
  conversationId: string;
  expiresIn: number;
  watermark?: string;
}

// Almacén temporal de conversaciones activas (en producción usar Redis/DB)
const conversations = new Map<string, BotConversation>();

// Generar token y crear conversación
export async function POST() {
  try {
    const directLineSecret = process.env.AZURE_BOT_DIRECT_LINE_SECRET;
    
    console.log('🔧 [POST] Iniciando creación de conversación');
    console.log('🔧 [POST] Secret configurado:', !!directLineSecret);

    if (!directLineSecret) {
      console.error('❌ [POST] Direct Line Secret no configurado');
      return Response.json({ error: 'Secret de Direct Line no configurado' }, { status: 500 });
    }

    const userId = `user-${Date.now()}`;
    console.log(`🔧 [POST] Creando conversación para usuario: ${userId}`);

    // Primero, vamos a probar la conectividad básica
    console.log('🔧 [POST] Probando conectividad con Direct Line...');
    
    const response = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${directLineSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: {
          id: userId,
          name: 'Usuario'
        }
      })
    });

    console.log('🔧 [POST] Response status:', response.status);
    console.log('🔧 [POST] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [POST] Error from Direct Line:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return Response.json({ 
        error: `Error del bot: ${response.status} - ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ [POST] Conversación creada exitosamente:', {
      conversationId: data.conversationId,
      tokenLength: data.token?.length || 0,
      expiresIn: data.expires_in
    });
    
    // Almacenar la conversación
    const conversation: BotConversation = {
      token: data.token,
      conversationId: data.conversationId,
      expiresIn: data.expires_in || 3600,
      watermark: undefined
    };

    conversations.set(userId, conversation);
    console.log('✅ [POST] Conversación almacenada para usuario:', userId);

    return Response.json({
      userId,
      token: data.token,
      conversationId: data.conversationId,
      expiresIn: data.expires_in || 3600
    });

  } catch (error) {
    console.error('❌ [POST] Error crítico:', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 });
  }
}

// Enviar mensaje al bot
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, message } = body;

    console.log('📤 [PUT] Iniciando envío de mensaje');
    console.log('📤 [PUT] Datos recibidos:', { userId, message: message?.substring(0, 50) });

    if (!userId || !message) {
      console.error('❌ [PUT] Datos faltantes:', { userId: !!userId, message: !!message });
      return Response.json({ error: 'userId y message son requeridos' }, { status: 400 });
    }

    const conversation = conversations.get(userId);
    console.log('📤 [PUT] Conversación encontrada:', !!conversation);
    
    if (!conversation) {
      console.error('❌ [PUT] Conversación no encontrada para usuario:', userId);
      console.log('📤 [PUT] Conversaciones disponibles:', Array.from(conversations.keys()));
      return Response.json({ 
        error: 'Conversación no encontrada. Debe crear una conversación primero.',
        availableUsers: Array.from(conversations.keys())
      }, { status: 404 });
    }

    console.log('📤 [PUT] Detalles de conversación:', {
      conversationId: conversation.conversationId,
      tokenLength: conversation.token?.length || 0,
      watermark: conversation.watermark
    });

    // Preparar el payload del mensaje
    const messagePayload = {
      type: 'message',
      from: {
        id: userId,
        name: 'Usuario'
      },
      text: message.trim()
    };

    console.log('📤 [PUT] Payload del mensaje:', messagePayload);

    // URL del endpoint
    const sendUrl = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`;
    console.log('📤 [PUT] URL de envío:', sendUrl);

    // Enviar mensaje al bot
    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conversation.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    console.log('📤 [PUT] Response status:', sendResponse.status);
    console.log('📤 [PUT] Response status text:', sendResponse.statusText);
    console.log('📤 [PUT] Response headers:', Object.fromEntries(sendResponse.headers.entries()));

    // Leer la respuesta completa para debugging
    const responseText = await sendResponse.text();
    console.log('📤 [PUT] Response body:', responseText);

    if (!sendResponse.ok) {
      console.error('❌ [PUT] Error enviando mensaje:', {
        status: sendResponse.status,
        statusText: sendResponse.statusText,
        body: responseText
      });
      
      // Análisis específico del error
      let errorMessage = `Error enviando mensaje: ${sendResponse.status}`;
      let errorDetails = responseText;
      
      if (sendResponse.status === 401) {
        errorMessage = 'Token no válido o expirado';
      } else if (sendResponse.status === 403) {
        errorMessage = 'No autorizado para enviar mensajes';
      } else if (sendResponse.status === 404) {
        errorMessage = 'Conversación no encontrada en el bot';
      } else if (sendResponse.status === 502) {
        errorMessage = 'El bot no está respondiendo (Bad Gateway)';
        errorDetails = 'Posibles causas: Bot no deployado, bot con errores, o configuración incorrecta';
      }
      
      return Response.json({ 
        error: errorMessage,
        details: errorDetails,
        status: sendResponse.status,
        conversationId: conversation.conversationId
      }, { status: sendResponse.status });
    }

    // Parsear respuesta exitosa
    let sendResult;
    try {
      sendResult = JSON.parse(responseText);
      console.log('✅ [PUT] Mensaje enviado exitosamente:', sendResult);
    } catch (parseError) {
      console.error('❌ [PUT] Error parseando respuesta:', parseError);
      return Response.json({ 
        error: 'Respuesta inválida del servicio',
        details: responseText
      }, { status: 500 });
    }

    // Esperar un poco antes de buscar la respuesta
    console.log('⏳ [PUT] Esperando respuesta del bot...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Obtener respuesta del bot
    const result = await getBotMessages(conversation);
    console.log('✅ [PUT] Resultado final:', result);
    
    return Response.json(result);
    
  } catch (error) {
    console.error('❌ [PUT] Error crítico:', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Error procesando mensaje'
    }, { status: 500 });
  }
}

// Función helper para obtener mensajes
async function getBotMessages(conversation: BotConversation, maxRetries = 3, delayMs = 2000) {
  console.log(`📥 [GET_MESSAGES] Iniciando búsqueda de mensajes`);
  console.log(`📥 [GET_MESSAGES] Conversación: ${conversation.conversationId}`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let url = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`;
      if (conversation.watermark) {
        url += `?watermark=${conversation.watermark}`;
      }

      console.log(`📥 [GET_MESSAGES] Intento ${attempt + 1}/${maxRetries} - URL: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${conversation.token}`,
          'Accept': 'application/json'
        }
      });

      console.log(`📥 [GET_MESSAGES] Response status: ${response.status}`);

      if (!response.ok) {
        console.error(`❌ [GET_MESSAGES] Error (intento ${attempt + 1}):`, response.status, response.statusText);
        if (attempt === maxRetries - 1) {
          throw new Error(`Error obteniendo respuesta: ${response.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      const data = await response.json();
      console.log(`📥 [GET_MESSAGES] Actividades recibidas: ${data.activities?.length || 0}`);

      // Actualizar watermark
      if (data.watermark) {
        conversation.watermark = data.watermark;
      }

      // Filtrar mensajes del bot
      const botMessages = data.activities
        ?.filter((activity: any) => {
          const isMessage = activity.type === 'message';
          const isFromBot = !activity.from?.id?.includes('user-');
          const hasContent = activity.text || (activity.attachments && activity.attachments.length > 0);
          
          console.log(`📥 [GET_MESSAGES] Evaluando actividad ${activity.id}:`, {
            type: activity.type,
            fromId: activity.from?.id,
            hasContent,
            isFromBot,
            text: activity.text?.substring(0, 30)
          });

          return isMessage && isFromBot && hasContent;
        })
        ?.map((activity: any) => ({
          id: activity.id,
          text: activity.text || 'Mensaje con contenido adjunto',
          timestamp: activity.timestamp,
          attachments: activity.attachments || []
        })) || [];

      console.log(`📥 [GET_MESSAGES] Mensajes del bot encontrados: ${botMessages.length}`);

      if (botMessages.length > 0) {
        return { success: true, botMessages };
      }

      if (attempt < maxRetries - 1) {
        console.log(`⏳ [GET_MESSAGES] Esperando ${delayMs}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`❌ [GET_MESSAGES] Error en intento ${attempt + 1}:`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  console.log('📥 [GET_MESSAGES] No se encontraron mensajes después de todos los intentos');
  return { success: true, botMessages: [] };
}

// Obtener mensajes de la conversación
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('📋 [GET] Obteniendo mensajes para usuario:', userId);

    if (!userId) {
      return Response.json({ error: 'userId es requerido' }, { status: 400 });
    }

    const conversation = conversations.get(userId);
    if (!conversation) {
      console.error('❌ [GET] Conversación no encontrada:', userId);
      return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    let url = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`;
    if (conversation.watermark) {
      url += `?watermark=${conversation.watermark}`;
    }

    console.log('📋 [GET] URL:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${conversation.token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [GET] Error obteniendo mensajes:', errorText);
      return Response.json({ 
        error: `Error obteniendo mensajes: ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();

    if (data.watermark) {
      conversation.watermark = data.watermark;
    }

    const messages = data.activities
      ?.filter((activity: any) => activity.type === 'message')
      ?.map((activity: any) => ({
        id: activity.id,
        text: activity.text,
        from: activity.from?.id?.includes('user-') ? 'user' : 'bot',
        timestamp: activity.timestamp,
        attachments: activity.attachments || []
      })) || [];

    console.log('✅ [GET] Mensajes obtenidos:', messages.length);
    return Response.json({ messages });

  } catch (error) {
    console.error('❌ [GET] Error crítico:', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Error obteniendo mensajes'
    }, { status: 500 });
  }
}