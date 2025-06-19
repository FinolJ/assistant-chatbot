import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from "botbuilder";
import { BotCredentials } from "./../configs/bot.credentials";

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: BotCredentials.MicrosoftAppId,
  MicrosoftAppPassword: BotCredentials.MicrosoftAppPassword,
  MicrosoftAppType: BotCredentials.MicrosoftAppType,
  MicrosoftAppTenantId: BotCredentials.MicrosoftAppTenantId,
});

const botFrameworkAuthentication =
  createBotFrameworkAuthenticationFromConfiguration(
    {
      get: () => undefined,
      set: () => {},
    },
    credentialsFactory
  );

export const adapter = new CloudAdapter(botFrameworkAuthentication);
