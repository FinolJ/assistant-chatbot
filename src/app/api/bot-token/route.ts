import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Se mantiene tu interfaz original
interface BotConversation {
  token: string;
  conversationId: string;
  expiresIn: number;
  userId: string;
  watermark?: string;
}

// Este mapa ya no se usará en la función PUT
export const conversations = new Map<string, BotConversation>();

/**
 * POST /api/bot-token
 * Inicia una nueva conversación con el servicio de Direct Line.
 */
export async function POST(): Promise<Response> {
  const store = await cookies(); // Corregido: sin await

  try {
    const directLineSecret = process.env.AZURE_BOT_DIRECT_LINE_SECRET;
    if (!directLineSecret) {
      throw new Error(
        "El secreto de Direct Line (AZURE_BOT_DIRECT_LINE_SECRET) no está configurado en el servidor."
      );
    }

    const userId = `user-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log(`[SERVER] Creando conversación para userId: ${userId}`);

    const response = await fetch(
      "https://directline.botframework.com/v3/directline/conversations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directLineSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user: { id: userId } }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[SERVER] Error al iniciar conversación con Direct Line. Status: ${response.status}, Body: ${errorBody}`
      );
      throw new Error("Fallo al iniciar conversación con Direct Line.");
    }

    const data = await response.json();
    const { token, conversationId, expiresIn } = data;

    // Aunque ya no lo usaremos en PUT, lo mantenemos por si acaso
    conversations.set(userId, { token, conversationId, expiresIn, userId });
    console.log(`[SERVER] ✅ Conversación iniciada para userId: ${userId}`);

    // Tu lógica para establecer las cookies se mantiene
    store.set("conversationId", conversationId, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    store.set("conversationToken", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return NextResponse.json({ success: true, userId, token, conversationId });
  } catch (error: any) {
    console.error(
      "❌ [SERVER] Error fatal en la creación de conversación:",
      error.message
    );
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bot-token
 * Envía un mensaje y sondea para obtener las respuestas del bot.
 */
export async function PUT(request: NextRequest): Promise<Response> {
  const store = await cookies(); // Corregido: sin await

  // Leemos los valores de las cookies, tal como lo tenías
  const conversationId = store.get("conversationId")?.value;
  const conversationToken = store.get("conversationToken")?.value;

  try {
    // Verificamos que las cookies existan
    if (!conversationId || !conversationToken) {
        return NextResponse.json(
            { error: "Sesión no encontrada en las cookies. Por favor, reinicia la conversación." },
            { status: 404 }
        );
    }

    const { userId, message } = await request.json();
    if (!userId || !message) {
      return NextResponse.json(
        { error: "El userId y el mensaje son requeridos." },
        { status: 400 }
      );
    }
    
    // -----------------------------------------------------------------
    // CAMBIO PRINCIPAL: Se elimina el uso del mapa en memoria.
    // Ya no se usa `conversations.get(userId)`.
    // -----------------------------------------------------------------

    // --- Enviar el mensaje del usuario usando los datos de las cookies ---
    await fetch(
      `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`,
      {
        method: "POST",
        headers: {
          // Usamos el token de la cookie
          Authorization: `Bearer ${conversationToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "message",
          from: { id: userId },
          text: message,
        }),
      }
    );

    console.log(
      `[SERVER] Mensaje de ${userId} enviado. Empezando a sondear respuestas...`
    );

    // --- Sondear para obtener las respuestas del bot ---
    // Pasamos los valores de las cookies directamente a la función de sondeo
    const botReplies = await pollForBotReplies(
      userId,
      conversationId,
      conversationToken
    );

    if (botReplies.length > 0) {
      return NextResponse.json({ success: true, messages: botReplies });
    } else {
      // Si no hay respuesta, devolvemos un éxito con un array vacío.
      return NextResponse.json({ success: true, messages: [] });
    }
  } catch (error: any) {
    console.error("❌ [SERVER] Error en PUT:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Función de sondeo simplificada para no depender de un estado de watermark
 * que estaba guardado en el mapa en memoria.
 */
async function pollForBotReplies(
  userId: string,
  conversationId: string,
  token: string
): Promise<string[]> {
  const allReplies: string[] = [];
  const maxRetries = 10;
  const retryDelay = 500;

  for (let i = 0; i < maxRetries; i++) {
    // Simplificamos la URL para no usar el watermark por ahora
    const url = `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`;

    const activityResponse = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!activityResponse.ok) break;

    const activityData = await activityResponse.json();

    const botMessages = activityData.activities.filter(
      (activity: any) =>
        activity.type === "message" && activity.from.id !== userId && activity.text
    );
    
    // Para evitar leer los mismos mensajes una y otra vez, solo procesaremos la última actividad del bot
    if (botMessages.length > 0) {
      const lastMessage = botMessages[botMessages.length - 1];
      allReplies.push(lastMessage.text);
      // Devolvemos la respuesta inmediatamente para no seguir sondeando
      return allReplies;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  return allReplies;
}