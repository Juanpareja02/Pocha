
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calculator, Gamepad, ArrowRight, LogOut } from 'lucide-react';
import { Logo } from '@/components/icons';
import { useAuth, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useEffect } from 'react';

export function ModeSelectClientPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Logo className="w-16 h-16 text-primary animate-pulse" />
        <p className="text-muted-foreground mt-4">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full">
      <div className="absolute top-4 right-4 z-20">
        <Button variant="outline" size="icon" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          <span className="sr-only">Cerrar sesión</span>
        </Button>
      </div>
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
              Hola, {user.isAnonymous ? 'Invitado' : user.displayName || 'Jugador'}.<br/>
              Selecciona un modo de juego para empezar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Link href="/counter" passHref>
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-between h-20 text-lg"
              >
                <div className="flex items-center gap-4">
                  <Calculator className="w-8 h-8 text-primary" />
                  <span>Contador de Pocha</span>
                </div>
                <ArrowRight className="w-6 h-6" />
              </Button>
            </Link>
            <Link href="/lobby" passHref>
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-between h-20 text-lg"
              >
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
