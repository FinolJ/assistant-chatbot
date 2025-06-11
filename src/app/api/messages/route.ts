
import { NextRequest, NextResponse } from 'next/server';

interface BotActivity {
  type: string;
  id: string;
  timestamp: string;
  channelId: string;
  from: {
    id: string;
    name?: string;
  };
  conversation: {
    id: string;
  };
  recipient: {
    id: string;
    name?: string;
  };
  text?: string;
  attachments?: any[];
  channelData?: any;
}

interface BotResponse {
  type: string;
  text?: string;
  attachments?: any[];
}

// Endpoint POST - Azure Bot Framework enviará mensajes aquí
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('Mensaje recibido del Bot Framework');
    
    // Leer el cuerpo de la petición
    const activity: BotActivity = await request.json();
    
    console.log('Actividad recibida:', {
      type: activity.type,
      text: activity.text,
      from: activity.from?.id,
      conversation: activity.conversation?.id
    });
    
    // Solo procesar mensajes de texto
    if (activity.type === 'message' && activity.text) {

      console.log('Mensaje del usuario:', activity.text);
      
      // Respuesta básica temporal - reemplaza con tu lógica
      const response: BotResponse = {
        type: 'message',
        text: 'Mensaje recibido correctamente. Aquí integrarás tu lógica personalizada.'
      };
      
      console.log('Respuesta enviada:', response);
      
      return NextResponse.json(response);
    }
    
    // Para otros tipos de actividad (como "conversationUpdate"), responder con 200 OK
    if (activity.type === 'conversationUpdate') {
      console.log('Conversación actualizada');
      return NextResponse.json({
        type: 'message',
        text: '¡Conectado correctamente!'
      });
    }
    
    // Para cualquier otro tipo de actividad, solo responder OK
    return NextResponse.json({ status: 'ok' });
    
  } catch (error) {
    console.error('❌ [BOT] Error procesando mensaje:', error);
    
    return NextResponse.json({
      type: 'message',
      text: 'Error interno del servidor.'
    }, { status: 500 });
  }
}

// Endpoint GET - Para verificación
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ 
    status: 'Bot endpoint funcionando correctamente',
    timestamp: new Date().toISOString(),
    methods: ['GET', 'POST'],
    description: 'endpoint principal del Azure Bot Service'
  });
}