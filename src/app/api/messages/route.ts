import { NextRequest } from "next/server";
import { KnowledgeBaseBot } from "@/app/modules/bot-module";
import { TurnContext, Activity, InvokeResponse } from "botbuilder";

import { adapter } from "@/app/modules/bot";
interface OnTurnErrorHandler {
  (context: TurnContext, error: Error): Promise<void>;
}

const onTurnErrorHandler: OnTurnErrorHandler = async (context, error) => {
  console.error(`\n [onTurnError] unhandled error: ${error}`);
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );
  await context.sendActivity("El bot encontró un error o bug.");
  await context.sendActivity(
    "Para continuar, por favor corrige el código fuente del bot."
  );
};
adapter.onTurnError = onTurnErrorHandler;

const myBot = new KnowledgeBaseBot();

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const activity: Activity = await req.json();
    const authHeader: string = req.headers.get('authorization') || '';

    const invokeResponse: InvokeResponse | undefined = await (adapter as any).processActivity(
      authHeader,
      activity,
      (context: TurnContext) => myBot.run(context)
    );
    
    if (invokeResponse) {
      return new Response(JSON.stringify(invokeResponse.body), {
        status: invokeResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(null, { status: 202 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
    console.error(`\n [POST /api/messages] Error: ${errorMessage}`);
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}