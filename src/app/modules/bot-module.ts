import { ActivityHandler, MessageFactory, TurnContext } from "botbuilder";

export class EchoBot extends ActivityHandler {
  constructor() {
    super();
    // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
    this.onMessage(
      async (
        context: TurnContext,
        next: () => Promise<void>
      ): Promise<void> => {
        const replyText: string = `Echo: ${context.activity.text}`;
        await context.sendActivity(MessageFactory.text(replyText, replyText));
        // By calling next() you ensure that the next BotHandler is run.
        await next();
      }
    );

    this.onMembersAdded(
      async (
        context: TurnContext,
        next: () => Promise<void>
      ): Promise<void> => {
        interface Member {
          id: string;
          [key: string]: any;
        }
        const membersAdded: Member[] = context.activity.membersAdded ?? [];
        const welcomeText: string = "Hello and welcome!";
        for (let cnt: number = 0; cnt < membersAdded.length; ++cnt) {
          if (membersAdded[cnt].id !== context.activity.recipient.id) {
            await context.sendActivity(
              MessageFactory.text(welcomeText, welcomeText)
            );
          }
        }
        // By calling next() you ensure that the next BotHandler is run.
        await next();
      }
    );
  }
}