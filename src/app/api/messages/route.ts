// app/api/messages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { BotFrameworkAdapter, TurnContext, MemoryStorage, ConversationState, UserState } from 'botbuilder';
// import { QuestionAnsweringClient, AzureKeyCredential } from "@azure/ai-language-question-answering"; // YA NO NECESITAS ESTA IMPORTACIÓN
import { ConversationAnalysisClient, AzureKeyCredential } from "@azure/ai-language-conversations"; // Para el reconocimiento de intenciones (CLU)

// --- Configuración del Adaptador del Bot ---
// MicrosoftAppId y MicrosoftAppPassword son las credenciales de tu REGISTRO DE BOT en Azure.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
});

// --- Configuración de Estado del Bot ---
// Necesitas un almacenamiento de estado. MemoryStorage es para desarrollo/prueba.
// Para producción, usar Azure Blob Storage o Cosmos DB para el estado.
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage); // Opcional, si necesitas estado por usuario

// --- Define la Lógica de tu Bot ---
class MyHelpBot {
    private conversationState: ConversationState;
    private userState: UserState; // Opcional
    // private qnaClient: QuestionAnsweringClient; // YA NO NECESITAS EL CLIENTE QNA SDK
    private qnaEndpoint: string; // Guardaremos el endpoint completo para la API REST
    private qnaKey: string; // Guardaremos la clave QnA

    private cluClient: ConversationAnalysisClient;
    private cluProjectName: string;
    private cluDeploymentName: string;

    constructor(conversationState: ConversationState, userState: UserState) { // Pasa userState si lo usas
        this.conversationState = conversationState;
        this.userState = userState;

        // --- Configuración para Llamadas Directas a QnA Maker API ---
        if (!process.env.QNA_ENDPOINT || !process.env.QNA_KEY || !process.env.QNA_PROJECT_NAME) {
            console.error("❌ ERROR: Variables de entorno para QnA Maker no configuradas.");
            throw new Error("QnA Maker environment variables are not set.");
        }
        // Construimos el endpoint completo para la API REST de Question Answering
        // La versión de la API (api-version) es importante. '2021-10-01' es común para QnA Maker.
        this.qnaEndpoint = `${process.env.QNA_ENDPOINT}language/query-knowledgebases/projects/${process.env.QNA_PROJECT_NAME}/qna?api-version=2021-10-01`;
        this.qnaKey = process.env.QNA_KEY;

        // --- Inicializar cliente de Conversational Language Understanding (CLU) ---
        if (!process.env.CLU_ENDPOINT || !process.env.CLU_KEY || !process.env.CLU_PROJECT_NAME || !process.env.CLU_DEPLOYMENT_NAME) {
            console.error("❌ ERROR: Variables de entorno para CLU no configuradas.");
            throw new Error("CLU environment variables are not set.");
        }
        this.cluClient = new ConversationAnalysisClient(
            process.env.CLU_ENDPOINT,
            new AzureKeyCredential(process.env.CLU_KEY)
        );
        this.cluProjectName = process.env.CLU_PROJECT_NAME;
        this.cluDeploymentName = process.env.CLU_DEPLOYMENT_NAME;
    }

    async onTurn(context: TurnContext) {
        // Guardar cambios de estado al inicio de cada turno.
        // Esto permite que el estado se cargue y esté disponible durante el turno.
        await this.conversationState.load(context);
        await this.userState.load(context);

        if (context.activity.type === 'message' && context.activity.text) {
            const userMessage = context.activity.text;
            console.log(`[BOT] Mensaje de usuario recibido: "${userMessage}"`);

            // 1. Reconocimiento de Intención con CLU
            let topIntent = 'None'; // Intención por defecto
            let confidence = 0;

            try {
                const cluResult = await this.cluClient.analyzeConversation({
                    kind: "Conversation",
                    analysisInput: {
                        conversationItem: {
                            id: context.activity.id || "1",
                            participantId: context.activity.from.id,
                            text: userMessage
                        }
                    },
                    parameters: {
                        projectName: this.cluProjectName,
                        deploymentName: this.cluDeploymentName,
                        verbose: true
                    }
                });

                topIntent = cluResult.result.prediction.topIntent || 'None';
                let detectedIntent: any = null;
                if (Array.isArray(cluResult.result.prediction.intents)) {
                    detectedIntent = cluResult.result.prediction.intents.find((i: any) => i.category === topIntent);
                }
                confidence = detectedIntent ? detectedIntent.confidenceScore : 0;

                console.log(`[BOT] Intención CLU detectada: ${topIntent} (Confianza: ${confidence})`);

            } catch (cluError) {
                console.error('❌ [BOT] Error al llamar a CLU:', cluError);
                // Si CLU falla, podríamos considerar una intención por defecto o un fallback
                topIntent = 'ErrorCLU'; // Una intención para manejar el error
            }

            // 2. Lógica de Dispatching basada en la Intención
            // Se recomienda un umbral de confianza mínimo para CLU (ej. 0.7)
            if (confidence < 0.7 && topIntent !== 'ErrorCLU') {
                topIntent = 'None'; // Si la confianza es baja, tratarla como ninguna intención clara
                console.log(`[BOT] Confianza CLU (${confidence}) por debajo del umbral, se considera 'None'.`);
            }

            switch (topIntent) {
                case 'Saludo':
                    await context.sendActivity('¡Hola! Soy PlantTalk Bot, tu asistente de ayuda para plantas. ¿En qué puedo ayudarte hoy?');
                    break;
                case 'Agradecimiento':
                    await context.sendActivity('De nada, ¡estoy para servirte!');
                    break;
                case 'Despedida':
                    await context.sendActivity('¡Adiós! Que tengas un excelente día.');
                    break;
                case 'PreguntaSobrePlanta': // Esta es la intención que dispara la base de conocimientos
                    console.log('[BOT] Intención: PreguntaSobrePlanta. Consultando Base de Conocimientos (QnA) via REST API.');
                    try {
                        const qnaApiResponse = await fetch(this.qnaEndpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Ocp-Apim-Subscription-Key': this.qnaKey // Tu clave de suscripción de QnA
                            },
                            body: JSON.stringify({
                                question: userMessage,
                                top: 1 // Queremos la mejor respuesta
                            })
                        });

                        if (!qnaApiResponse.ok) {
                            const errorText = await qnaApiResponse.text();
                            console.error(`❌ [BOT] Error en la API de QnA: ${qnaApiResponse.status} - ${errorText}`);
                            await context.sendActivity("Perdona, tuve un problema al consultar mi base de conocimientos. Por favor, intenta de nuevo más tarde.");
                            break;
                        }

                        const qnaResult = await qnaApiResponse.json();

                        // La API REST de QnA Maker devuelve un array de 'answers'.
                        // La confianza se llama 'confidenceScore' en la API directa.
                        if (qnaResult.answers && qnaResult.answers.length > 0 && qnaResult.answers[0].confidenceScore > 0.7) { // Umbral de confianza para QnA
                            await context.sendActivity(qnaResult.answers[0].answer);
                        } else {
                            await context.sendActivity("Lo siento, no encontré una respuesta específica sobre eso en mi base de conocimientos. ¿Podrías reformular la pregunta o intentar con algo diferente?");
                        }
                    } catch (qnaApiError) {
                        console.error('❌ [BOT] Error al llamar a la API REST de QnA:', qnaApiError);
                        await context.sendActivity("Perdona, hubo un error de conexión al buscar en mi base de conocimientos. Por favor, intenta de nuevo.");
                    }
                    break;
                case 'Ayuda': // Puedes tener una intención de ayuda general si no es una pregunta directa de la KB
                    await context.sendActivity('Claro, dime qué problema tienes con tus plantas o qué consejo necesitas. Estoy aquí para ayudarte.');
                    break;
                case 'ErrorCLU': // Manejo del error de CLU
                    await context.sendActivity("Lo siento, tuve un problema para entender tu mensaje. Por favor, intenta de nuevo.");
                    break;
                case 'None': // Intención por defecto o confianza baja
                default:
                    // Si no se reconoce ninguna intención clara o la confianza es baja.
                    await context.sendActivity(`Entiendo que dijiste: "${userMessage}". No estoy seguro de cómo ayudarte con eso. ¿Podrías intentar preguntar de otra manera o algo relacionado con plantas?`);
                    break;
            }

        } else if (context.activity.type === 'conversationUpdate') {
            // Maneja las actualizaciones de conversación (ej. cuando el bot se añade a la conversación)
            if (context.activity.membersAdded) {
                for (const member of context.activity.membersAdded) {
                    if (member.id !== context.activity.recipient.id) {
                        await context.sendActivity('¡Hola! Soy PlantTalk Bot, tu asistente de ayuda para plantas. ¿En qué puedo ayudarte?');
                    }
                }
            }
        }
        // Guarda los cambios de estado al final de cada turno.
        await this.conversationState.saveChanges(context);
        await this.userState.saveChanges(context); // Guarda userState si lo usas
    }
}

// Inicializa tu bot con los estados de conversación y usuario
const myBot = new MyHelpBot(conversationState, userState);

// --- Endpoint POST para Azure Bot Framework ---
// Este endpoint recibirá las actividades del Bot Framework Service
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        // Para que BotFrameworkAdapter funcione con NextRequest/NextResponse,
        // necesitamos crear objetos que simulen Node.js http.IncomingMessage y http.ServerResponse.
        // La clave es que el adapter necesita leer el cuerpo RAW y escribir en un objeto de respuesta.

        // 1. Crear un objeto mock para la respuesta del servidor (res)
        let responseBody: any;
        let responseStatus: number = 200; // Valor por defecto
        let responseHeaders: HeadersInit = {};

        const mockRes: any = {
            end: () => { /* El adapter llama a esto cuando termina */ },
            json: (data: any) => { responseBody = data; }, // Captura la respuesta JSON
            send: (data: any) => { responseBody = data; }, // Captura la respuesta en bruto
            status: (statusCode: number) => { responseStatus = statusCode; return mockRes; }, // Captura el estado HTTP
            setHeader: (name: string, value: string | string[]) => { // Captura los headers
                if (Array.isArray(value)) {
                    responseHeaders = { ...responseHeaders, [name.toLowerCase()]: value.join(', ') };
                } else {
                    responseHeaders = { ...responseHeaders, [name.toLowerCase()]: value };
                }
            },
            // Puedes añadir otros métodos si el adapter los requiere, como writeHead, write.
            // Para un webhook básico, estos suelen ser suficientes.
        };

        // 2. Leer el cuerpo de la petición de NextRequest como texto raw
        // Esto es necesario porque NextRequest.json() o .text() solo se pueden leer una vez.
        const rawBody = await req.text();
        //console.log("Raw incoming body:", rawBody); // Para depuración

        // 3. Crear un objeto mock para la petición (req)
        // Simula http.IncomingMessage para el adapter.
        const mockReq: any = {
            headers: Object.fromEntries(req.headers.entries()),
            method: req.method,
            url: req.url,
            // Proporciona el cuerpo raw como un Buffer para simular un stream
            body: Buffer.from(rawBody),
            // Mimic stream methods
            on: (event: string, handler: Function) => {
                if (event === 'data') {
                    handler(Buffer.from(rawBody));
                } else if (event === 'end') {
                    handler();
                }
            },
            once: (event: string, handler: Function) => {
                if (event === 'data') {
                    handler(Buffer.from(rawBody));
                } else if (event === 'end') {
                    handler();
                }
            },
        };

        // 4. Procesar la actividad con el Bot Framework Adapter
        // El adapter se encarga de:
        //  - Parsear el cuerpo de la petición (mockReq.body)
        //  - Pasar la actividad a la lógica de tu bot (myBot.onTurn)
        //  - Escribir la respuesta en el objeto mockRes, que luego usamos para NextResponse.
        await adapter.processActivity(mockReq, mockRes, async (context: TurnContext) => {
            await myBot.onTurn(context);
        });

        // 5. Devolver la respuesta capturada por mockRes usando NextResponse
        // console.log(`[BOT] Respondiendo con estado: ${responseStatus}, cuerpo:`, responseBody); // Para depuración
        return NextResponse.json(responseBody, { status: responseStatus, headers: responseHeaders });

    } catch (error) {
        console.error('❌ [BOT] Error en POST /api/messages (general):', error);
        // Devuelve un error 500 si algo sale mal al procesar la actividad.
        return NextResponse.json({ error: 'Internal server error: ' + (error as Error).message }, { status: 500 });
    }
}

// --- Endpoint GET para Verificación (Opcional) ---
// Útil para verificar que el endpoint del bot está accesible.
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        status: 'Endpoint de mensajería del BOT funcionando correctamente. Este endpoint recibe actividades de Azure Bot Service.',
        timestamp: new Date().toISOString(),
    });
}