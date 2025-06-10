
import { FloatingAssistant } from '@/components/assistant/FloatingAssistant';
import { SwitchThemes } from '../components/SwitchThemes';

export default function HomePage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">PlantTalk Bot</h1>

      <SwitchThemes />
      
      {/* Tu contenido existente aquí */}
      <div className="space-y-4">
        <p></p>
        {/* Más contenido */}
      </div>
      
      {/* El chat flotante se renderiza automáticamente */}
      <FloatingAssistant />
    </div>
  );
}