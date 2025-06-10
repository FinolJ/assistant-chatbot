import { AssistantProvider } from "@/components/assistant";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AssistantProvider>
          <ThemeProvider>
            {children}
            {/* Los componentes del chat se renderizan aquí automáticamente */}
          </ThemeProvider>
        </AssistantProvider>
      </body>
    </html>
  );
}
