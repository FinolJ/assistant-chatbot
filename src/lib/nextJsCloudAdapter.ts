
import {
  CloudAdapter,
  TurnContext,
  ConfigurationBotFrameworkAuthentication,
} from "botbuilder";
import { NextRequest } from "next/server";

export class NextJsCloudAdapter extends CloudAdapter {
  constructor(auth: ConfigurationBotFrameworkAuthentication) {
    super(auth);
  }

  public async processNextRequest(
    req: NextRequest,
    botLogic: (context: TurnContext) => Promise<any>
  ): Promise<void> {
    try {
      const activity = await req.json();
      const authHeader = req.headers.get("Authorization") || "";

      await this.processActivity(authHeader, activity, botLogic);
    } catch (error) {
      console.error("Error en NextJsCloudAdapter.processNextRequest:", error);
      throw error;
    }
  }
}