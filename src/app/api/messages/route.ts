// route.ts (para /api/messages - ¡Este es el endpoint de TU BOT real!)

import { NextRequest, NextResponse } from 'next/server';
import { BotFrameworkAdapter, TurnContext, MemoryStorage, ConversationState } from 'botbuilder';

// Configuración del adaptador del bot.
// MicrosoftAppId y MicrosoftAppPassword son las credenciales de tu REGISTRO DE BOT en Azure,
// NO el secreto de Direct Line.
const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId, // Asegúrate de configurar estas variables de entorno en tu despliegue del bot
  appPassword: process.env.MicrosoftAppPassword,
});

// Opcional: Para mantener el estado de la conversación (ej. para diálogos)
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);

// Define la lógica de tu bot
class MyHelpBot {
  constructor(private conversationState: ConversationState) {}

  async onTurn(context: TurnContext) {
    if (context.activity.type === 'message' && context.activity.text) {
      // Lógica de tu bot de ayuda aquí
      const userMessage = context.activity.text.toLowerCase();
      let replyText = '';

      if (userMessage.includes('hola') || userMessage.includes('saludos')) {
        replyText = '¡Hola! Soy PlantTalk Bot, tu asistente de ayuda para plantas. ¿Cómo puedo ayudarte hoy?';
      } else if (userMessage.includes('ayuda') || userMessage.includes('problema')) {
        replyText = 'Claro, dime qué problema tienes con tus plantas. Por ejemplo: "Mi planta tiene hojas amarillas" o "Necesito consejos de riego para cactus."';
      } else if (userMessage.includes('gracias')) {
        replyText = 'De nada. ¡Estoy aquí para ayudarte!';
      } else {
        replyText = `Entiendo que dijiste: "${context.activity.text}". Por favor, especifica un poco más tu pregunta sobre plantas.`;
      }

      // IMPORTANTE: context.sendActivity() hace que la respuesta
      // sea enviada de vuelta a Direct Line para que tu cliente la reciba.
      await context.sendActivity(replyText);

    } else if (context.activity.type === 'conversationUpdate') {
      // Maneja las actualizaciones de conversación (ej. cuando el bot se añade a la conversación)
      for (const member of context.activity.membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity('¡Hola! Soy PlantTalk Bot, tu asistente de ayuda para plantas. ¿En qué puedo ayudarte?');
        }
      }
    }
    // Guarda el estado de la conversación (si estás usándolo)
    await this.conversationState.saveChanges(context);
  }
}

const myBot = new MyHelpBot(conversationState);

// Endpoint POST - Azure Bot Framework enviará actividades aquí
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const activity = await request.json(); // La actividad enviada por Azure Bot Service

    // Procesar la actividad con el Bot Framework Adapter.
    // El adapter se encarga de pasar la actividad a la lógica de tu bot (myBot.onTurn)
    // y de enviar las respuestas de vuelta a Direct Line.
    await adapter.processActivity(activity, async (context: TurnContext) => {
      await myBot.onTurn(context);
    });

    // Siempre devuelve un 200 OK a Azure Bot Service para indicar que la actividad fue recibida.
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('❌ [BOT] Error procesando actividad:', error);
    // Devuelve un error si algo sale mal al procesar la actividad.
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// Endpoint GET - Para verificación (opcional)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'Endpoint de mensajería del BOT funcionando correctamente. Este endpoint recibe mensajes de Azure Bot Service.',
    timestamp: new Date().toISOString(),
  });
}