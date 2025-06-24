export const BotCredentials = {
    MicrosoftAppId: process.env.MicrosoftAppId || "",
    MicrosoftAppPassword: process.env.MicrosoftAppPassword || "",
    MicrosoftAppType: process.env.MicrosoftAppType || "MultiTenant",
    MicrosoftAppTenantId: process.env.MicrosoftAppTenantId || "",
}

export const QnACredentials = {
    host: process.env.QNA_HOST!,
    projectName: process.env.QNA_PROJECT_NAME!,
    apiKey: process.env.QNA_API_KEY!,
};