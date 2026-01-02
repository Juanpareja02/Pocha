import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Gamepad, ArrowRight } from "lucide-react";
import { Logo } from "@/components/icons";

export default function ModeSelectPage() {
  return (
    <div className="relative min-h-screen w-full">
      <div className="absolute inset-0 bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-card/80">
          <CardHeader className="text-center">
             <div className="flex justify-center items-center gap-3 mb-4">
                <Logo className="w-12 h-12 text-primary" />
                <CardTitle className="text-5xl font-headline tracking-tighter">
                    La Pocha
                </CardTitle>
            </div>
            <CardDescription>
              Selecciona un modo de juego para empezar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Link href="/counter" passHref>
              <Button variant="outline" size="lg" className="w-full justify-between h-20 text-lg">
                <div className="flex items-center gap-4">
                    <Calculator className="w-8 h-8 text-primary" />
                    <span>Contador de Pocha</span>
                </div>
                <ArrowRight className="w-6 h-6" />
              </Button>
            </Link>
             <Link href="/lobby" passHref>
              <Button variant="outline" size="lg" className="w-full justify-between h-20 text-lg">
                <div className="flex items-center gap-4">
                    <Gamepad className="w-8 h-8 text-primary" />
                    <span>Partida Online</span>
                </div>
                <ArrowRight className="w-6 h-6" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
