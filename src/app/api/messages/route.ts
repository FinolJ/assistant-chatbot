
import { NextRequest, NextResponse } from "next/server";
import {
  TurnContext,
  MessageFactory,
  ActivityTypes,
  ConfigurationBotFrameworkAuthentication,
} from "botbuilder";
import { NextJsCloudAdapter } from "@/lib/nextJsCloudAdapter";


const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: process.env.AZURE_BOT_APP_ID,
});

const adapter = new NextJsCloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
  console.error(`\n [onTurnError] Unhandled error: ${error}`);
  await context.sendActivity("El bot encontró un error.");
};

async function botLogic(context: TurnContext) {
  if (context.activity.type === ActivityTypes.Message && context.activity.text) {
    const userMessage = context.activity.text.toLowerCase().trim();
    let responseText: string;

    if (userMessage === "hola") {
      responseText = "¡Hola! Mi lógica funciona y la respuesta viaja correctamente.";
    } else {
      responseText = `Recibí tu mensaje: '${context.activity.text}'.`;
    }
    await context.sendActivity(MessageFactory.text(responseText));
  }
}

export async function POST(req: NextRequest) {
  try {
    await adapter.processNextRequest(req, botLogic);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
  
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}