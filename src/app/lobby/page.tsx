import { LobbyForm } from "@/components/lobby/LobbyForm";

export default function LobbyPage() {
  return (
    <div className="relative min-h-screen w-full">
      <div className="absolute inset-0 bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
        <LobbyForm />
      </main>
    </div>
  );
}
