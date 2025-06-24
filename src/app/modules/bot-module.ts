import { ActivityHandler, MessageFactory } from "botbuilder";
import { QnAMaker, QnAMakerEndpoint, QnAMakerOptions } from "botbuilder-ai";
import { QnACredentials } from "../configs/bot.credentials";

export class KnowledgeBaseBot extends ActivityHandler {
  private readonly qnaMaker: QnAMaker;

  constructor() {
    super();

    // Validar que las credenciales están presentes
    if (
      !QnACredentials.host ||
      !QnACredentials.projectName ||
      !QnACredentials.apiKey
    ) {
      throw new Error(
        "Las credenciales de Question Answering (QNA_HOST, QNA_PROJECT_NAME, QNA_API_KEY) no están configuradas en el archivo .env"
      );
    }

    // Configurar el endpoint para QnAMaker
    const qnaEndpoint: QnAMakerEndpoint = {
      knowledgeBaseId: QnACredentials.projectName, // El Project Name actúa como el Knowledge Base ID
      endpointKey: QnACredentials.apiKey,
      host: QnACredentials.host,
    };

    const qnaOptions: QnAMakerOptions = {
      top: 1,
    };

    this.qnaMaker = new QnAMaker(qnaEndpoint, qnaOptions);

    // Manejador para cuando se recibe un mensaje
    this.onMessage(async (context, next) => {
      try {
        const qnaResults = await this.qnaMaker.getAnswers(context);

        // Si se encontraron respuestas, tomar la primera
        if (qnaResults && qnaResults.length > 0) {
          await context.sendActivity(MessageFactory.text(qnaResults[0].answer));
        } else {
    
          await context.sendActivity(
            "No he encontrado una respuesta para tu pregunta. Por favor, intenta reformularla."
          );
        }
      } catch (error) {
        console.error("Error al consultar la base de conocimientos:", error);
        await context.sendActivity(
          "Lo siento, tuve un problema al procesar tu pregunta."
        );
      }

      await next();
    });

    // Manejador para cuando un miembro se une
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded ?? [];
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(
            MessageFactory.text("¡Hola! ¿En qué puedo ayudarte hoy?")
          );
        }
      }
      await next();
    });
  }
}
