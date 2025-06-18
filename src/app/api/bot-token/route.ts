import { NextRequest, NextResponse } from 'next/server';

export async function POST(): Promise<Response> {
  try {
    const directLineSecret = process.env.AZURE_BOT_DIRECT_LINE_SECRET;

    if (!directLineSecret) {
      console.error('❌ [TOKEN API] Direct Line Secret no configurado');
      return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 });
    }

    const response = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${directLineSecret}`,
      }
    });

    if (!response.ok) {
      throw new Error('La respuesta de la API de Direct Line no fue exitosa');
    }

    const tokenData = await response.json();
    console.log('✅ [TOKEN API] Token de Direct Line generado.');
    
    return NextResponse.json(tokenData);

  } catch (error) {
    console.error('❌ [TOKEN API] Error en la generación de token:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}