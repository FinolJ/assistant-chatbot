import { NextRequest, NextResponse } from 'next/server';

// La interfaz no cambia, seguimos necesitando el watermark.
interface BotConversation {
  token: string;
  conversationId: string;
  expiresIn: number;
  userId: string;
  watermark?: string;
}

export const conversations = new Map<string, BotConversation>();

/**
 * POST /api/bot-token
 * Inicia una nueva conversación con el servicio de Direct Line.
 */
export async function POST(): Promise<Response> {
  try {
    const directLineSecret = process.env.AZURE_BOT_DIRECT_LINE_SECRET;
    if (!directLineSecret) {
      throw new Error('El secreto de Direct Line (AZURE_BOT_DIRECT_LINE_SECRET) no está configurado en el servidor.');
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[SERVER] Creando conversación para userId: ${userId}`);

    const response = await fetch('https://directline.botframework.com/v3/directline/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${directLineSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user: { id: userId } })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[SERVER] Error al iniciar conversación con Direct Line. Status: ${response.status}, Body: ${errorBody}`);
      throw new Error('Fallo al iniciar conversación con Direct Line.');
    }
    
    const data = await response.json();
    const { token, conversationId, expiresIn } = data;

    conversations.set(userId, { token, conversationId, expiresIn, userId });
    console.log(`[SERVER] ✅ Conversación iniciada para userId: ${userId}`);

    return NextResponse.json({ success: true, userId, token, conversationId });

  } catch (error: any) {
    console.error('❌ [SERVER] Error fatal en la creación de conversación:', error.message);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/**
 * PUT /api/bot-token
 * Envía un mensaje y sondea para obtener las respuestas del bot.
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const { userId, message } = await request.json();
    if (!userId || !message) {
      return NextResponse.json({ error: 'El userId y el mensaje son requeridos.' }, { status: 400 });
    }
    
    const conversation = conversations.get(userId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada. Por favor, inicia una nueva conversación.' }, { status: 404 });
    }

    // --- Enviar el mensaje del usuario ---
    await fetch(`https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conversation.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'message', from: { id: userId }, text: message }),
    });

    console.log(`[SERVER] Mensaje de ${userId} enviado. Empezando a sondear respuestas...`);

    // --- Sondear para obtener las respuestas del bot ---
    // La función ahora devuelve un array de strings.
    const botReplies = await pollForBotReplies(conversation, userId);

    console.log(`[SERVER] Sondeo completado para ${userId}. Respuestas encontradas:`, botReplies.length);
    
    if (botReplies.length > 0) {
      console.log(`[SERVER] ✅ Respuestas del bot encontradas para ${userId}:`, botReplies);
      return NextResponse.json({ success: true, messages: botReplies });
    } else {
      console.warn(`[SERVER] ⚠️ No se encontró respuesta del bot para ${userId} después de esperar.`);
      return NextResponse.json({ success: false, error: 'Tiempo de espera agotado para la respuesta del bot.' }, { status: 504 });
    }

  } catch (error: any) {
    console.error("❌ [SERVER] Error en PUT:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


/**
 * Función de sondeo que consulta la API de Direct Line y acumula todas las respuestas del bot.
 * @param conversation - El objeto de la conversación guardada.
 * @param userId - El ID del usuario actual.
 * @returns Un array con todos los mensajes de texto del bot.
 */
async function pollForBotReplies(conversation: BotConversation, userId: string): Promise<string[]> {
  const allReplies: string[] = [];
  const maxRetries = 10;
  const retryDelay = 500; // 500ms

  for (let i = 0; i < maxRetries; i++) {
    const url = `https://directline.botframework.com/v3/directline/conversations/${conversation.conversationId}/activities?watermark=${conversation.watermark || ''}`;

    const activityResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${conversation.token}` }
    });

    if (!activityResponse.ok) break;

    const activityData = await activityResponse.json();

    // Filtramos TODAS las actividades que sean mensajes del bot
    const botMessages = activityData.activities.filter(
      (activity: any) => activity.type === 'message' && activity.from.id !== userId
    );

    if (botMessages.length > 0) {
        // Añadimos el texto de cada mensaje encontrado al array de respuestas
        for(const botMessage of botMessages) {
            allReplies.push(botMessage.text);
        }
    }
    
    if (activityData.watermark) {
      conversation.watermark = activityData.watermark;
      conversations.set(conversation.userId, conversation);
    }
    
    if (allReplies.length > 0) {
      return allReplies;
    }

    
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  return allReplies; // Devolvemos las respuestas encontradas, o un array vacío si no hubo.
}