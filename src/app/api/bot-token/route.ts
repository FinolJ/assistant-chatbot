import { NextRequest, NextResponse } from 'next/server';

interface BotConversation {
  token: string;
  conversationId: string;
  expiresIn: number;
  watermark?: string;
}

// Almacén temporal de conversaciones
// NOTA: En un entorno de producción, este Map DEBERÍA ser reemplazado
// por un almacén persistente (e.g., base de datos, Redis) para evitar
// la pérdida de sesiones al reiniciar el servidor.
const conversations = new Map<string, BotConversation>();

// Crear nueva conversación
export async function POST(): Promise<Response> {
  try {
    const directLineSecret = process.env.AZURE_BOT_DIRECT_LINE_SECRET;

    console.log('🔧 [CLIENT] Iniciando creación de conversación');

    if (!directLineSecret) {
      console.error('❌ [CLIENT] Direct Line Secret no configurado');
      return NextResponse.json({
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

    console.log('🔧 [CLIENT] Respuesta de Direct Line para creación de conversación:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [CLIENT] Error al iniciar conversación con Direct Line:', errorData);
      return NextResponse.json({
        error: 'Error al iniciar conversación con el bot',
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    const { token, conversationId, expiresIn } = data;

    // Almacenar los datos de la conversación
    conversations.set(userId, { token, conversationId, expiresIn, watermark: undefined });
    console.log(`✅ [CLIENT] Conversación iniciada: ${conversationId}, userId: ${userId}`);

    return NextResponse.json({ success: true, userId, conversationId });

  } catch (error) {
    console.error('❌ [CLIENT] Error en la creación de conversación:', error);
    return NextResponse.json({ error: 'Error interno del servidor al crear conversación.' }, { status: 500 });
  }
}

// Enviar mensaje y obtener respuesta
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId, message } = await request.json(); // Obtenemos el mensaje y userId del cliente

    if (!userId || !message) {
      console.warn('⚠️ [CLIENT] userId o mensaje no proporcionado.');
      return NextResponse.json({ error: 'userId y mensaje son requeridos.' }, { status: 400 });
    }

    const conversation = conversations.get(userId);

    if (!conversation) {
      console.error(`❌ [CLIENT] No se encontró la conversación para el userId: ${userId}`);
      return NextResponse.json({ error: 'Conversación no encontrada. Por favor, inicialice el bot.' }, { status: 404 });
    }

    console.log(`🔧 [CLIENT] Enviando mensaje a Direct Line para conversationId: ${conversation.conversationId}, userId: ${userId}`);

    // Construir el payload del mensaje para Direct Line
    const messagePayload = {
      type: 'message',
      from: { id: userId, name: 'Usuario Web' },
      text: message,
      locale: 'es-ES' // Puedes ajustar el locale según sea necesario
    };

    // Enviar el mensaje a la API de Direct Line
    const sendResponse = await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conversation.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload),
    });

    console.log('🔧 [CLIENT] Respuesta de Direct Line al enviar mensaje:', sendResponse.status);

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json();
      console.error('❌ [CLIENT] Error al enviar mensaje a Direct Line:', errorData);
      return NextResponse.json({ error: 'Error al enviar mensaje al bot', details: errorData }, { status: sendResponse.status });
    }

    // --- MODIFICACIÓN CLAVE: Se eliminó el setTimeout fijo aquí ---
    // En lugar de esperar un tiempo fijo, se llama directamente a getBotResponse
    // la cual ya implementa lógica de polling con reintentos.
    const botResponse = await getBotResponse(conversation);

    if (botResponse.success) {
      console.log('✅ [CLIENT] Mensaje de bot recibido:', botResponse.messages);
      return NextResponse.json({ success: true, botMessages: botResponse.messages });
    } else {
      console.warn('⚠️ [CLIENT] No se recibió respuesta del bot o hubo un error al obtenerla.');
      return NextResponse.json({ success: false, error: botResponse.error || 'No se recibió respuesta del bot.' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [CLIENT] Error en la función PUT (enviar mensaje):', error);
    return NextResponse.json({ error: 'Internal server error al enviar mensaje.' }, { status: 500 });
  }
}

// Función auxiliar para obtener respuestas del bot (polling)
async function getBotResponse(conversation: BotConversation): Promise<{ success: boolean; messages?: any[]; error?: string }> {
  const maxRetries = 5; // Aumentado a 5 reintentos para mayor robustez
  const retryDelay = 1000; // 1 segundo

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let url = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`;
    if (conversation.watermark) {
      url += `?watermark=${conversation.watermark}`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${conversation.token}`
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ [CLIENT] Intento ${attempt + 1}/${maxRetries}: Error obteniendo respuesta de Direct Line: ${response.status}`);
        if (attempt === maxRetries - 1) {
          throw new Error(`Error obteniendo respuesta final: ${response.status} ${response.statusText}`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      const data = await response.json();

      if (data.watermark) {
        conversation.watermark = data.watermark;
      }

      // Filtrar solo mensajes del bot
      const botMessages = data.activities
        ?.filter((activity: any) => {
          // Asegúrate de que es un mensaje, no del usuario actual ni un evento interno de Direct Line
          return activity.type === 'message' &&
                 activity.from?.id !== conversation.conversationId && // Evita eco si el bot reenvía el mensaje del usuario
                 !activity.from?.id?.includes('user-') && // Asegura que no es un mensaje de un usuario
                 activity.text; // Solo mensajes con texto
        })
        ?.map((activity: any) => ({
          id: activity.id,
          text: activity.text,
          timestamp: activity.timestamp
        })) || [];

      if (botMessages.length > 0) {
        return { success: true, messages: botMessages };
      }

      // Si no hay mensajes y no es el último intento, espera y reintenta
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

    } catch (error: any) {
      console.error(`❌ [CLIENT] Intento ${attempt + 1}/${maxRetries}: Error en getBotResponse:`, error.message);
      if (attempt === maxRetries - 1) {
        return { success: false, error: `Error final al obtener respuesta del bot: ${error.message}` };
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  console.log('⚠️ [CLIENT] No se recibieron mensajes del bot después de todos los reintentos.');
  return { success: false, error: 'Tiempo de espera agotado para la respuesta del bot.' };
}

// Endpoint GET - Para verificación (opcional)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'Direct Line API endpoint para cliente funcionando correctamente',
    timestamp: new Date().toISOString(),
  });
}