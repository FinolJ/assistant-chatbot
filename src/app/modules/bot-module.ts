import { ActivityHandler, MessageFactory, TurnContext } from "botbuilder";
import { QnACredentials } from "../configs/bot.credentials";

export class KnowledgeBaseBot extends ActivityHandler {
  // Ya no necesitamos un cliente de Azure aquí

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

    // Manejador para cuando se recibe un mensaje
    this.onMessage(async (context, next) => {
      try {
        const question = context.activity.text;

        // 1. Construir la URL completa para la API, igual que en la prueba curl
        const apiUrl = `${QnACredentials.host}language/:query-knowledgebases?projectName=${QnACredentials.projectName}&api-version=2021-10-01&deploymentName=production`;

        // 2. Definir los headers, incluyendo la clave de la API
        const headers = {
          "Ocp-Apim-Subscription-Key": QnACredentials.apiKey,
          "Content-Type": "application/json",
        };

        // 3. Definir el cuerpo de la petición con la pregunta
        const body = JSON.stringify({
          question: question,
        });

        // 4. Hacer la llamada a la API usando fetch
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: headers,
          body: body,
        });

        if (!response.ok) {
          // Si la respuesta no es exitosa, lanzar un error
          const errorData = await response.json();
          throw new Error(`Error de la API de Azure: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const qnaResponse = await response.json();
        console.log("Respuesta completa de Azure:", JSON.stringify(qnaResponse, null, 2));
        // 5. Procesar la respuesta
        if (qnaResponse.answers && qnaResponse.answers.length > 0) {
          const topAnswer = qnaResponse.answers[0];

          if (topAnswer && topAnswer.confidenceScore > 0.1) {
            await context.sendActivity(MessageFactory.text(topAnswer.answer));
          } else {
            await context.sendActivity(
              "Encontré algo, pero no estoy muy seguro. ¿Puedes reformular tu pregunta?"
            );
          }
        } else {
          await context.sendActivity(
            "No he encontrado ninguna respuesta para tu pregunta."
          );
        }
      } catch (error) {
        console.error("Error al consultar la base de conocimientos:", error);
        await context.sendActivity(
          "Lo siento, tuve un problema técnico al procesar tu pregunta."
        );
      }

      await next();
    });

    // Manejador para cuando un miembro se une (sin cambios)
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