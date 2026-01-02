"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, errorEmitter } from "@/firebase";
import { createLobby } from "@/lib/actions";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FirestorePermissionError } from "@/firebase/errors";


export function LobbyForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [accessCode, setAccessCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ title: "Debes iniciar sesión", description: "Inicia sesión para crear una partida.", variant: "destructive" });
        return;
    }
    setIsCreating(true);
    try {
        const newLobbyId = await createLobby(user.uid);
        // This navigation will be interrupted if the server action throws.
        router.push(`/play/${newLobbyId}`);
    } catch (error) {
        console.error("Error creating lobby:", error);

        // This is a server action, so we can't emit a client-side contextual error.
        // We'll show a generic toast but the real error is on the server console.
        toast({ title: "Error al crear la sala", description: "No se pudo crear la partida. Revisa la consola del servidor para más detalles.", variant: "destructive" });
        setIsCreating(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) {
        toast({ title: "Debes iniciar sesión", description: "Inicia sesión para unirte a una partida.", variant: "destructive" });
        return;
    }
    if (accessCode.trim().length === 0) {
      toast({
        title: "Código Inválido",
        description: "Por favor, introduce un código de acceso al juego.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    
    const lobbiesRef = collection(firestore, 'gameLobbies');
    const q = query(lobbiesRef, where("accessCode", "==", accessCode.trim()));

    getDocs(q)
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                toast({ title: "Sala no encontrada", description: "No se encontró ninguna partida con ese código.", variant: "destructive" });
                setIsJoining(false);
                return;
            }

            const lobbyDoc = querySnapshot.docs[0];
            // In a real app, you would add the user to the player list here
            // and then navigate. For now, we navigate directly.
            router.push(`/play/${lobbyDoc.id}`);
        })
        .catch((serverError) => {
            console.error("Error joining lobby:", serverError);
            
            const contextualError = new FirestorePermissionError({
                path: 'gameLobbies',
                operation: 'list', // getDocs is a 'list' operation
            });
            errorEmitter.emit('permission-error', contextualError);

            // Also show a toast to the user. The detailed error will be in the dev console.
            toast({ title: "Error al unirse a la sala", description: "No se pudo encontrar la partida. Verifica el código y los permisos.", variant: "destructive" });
            setIsJoining(false);
        });
  };
  
  if (isUserLoading) {
      return <p>Cargando...</p>;
  }

  return (
    <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-2xl font-headline">
          <Play /> Sala de Espera
        </CardTitle>
        <CardDescription className="text-center">Crea una nueva partida o únete a una existente.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" disabled={isCreating || isJoining}>Crear Partida</TabsTrigger>
            <TabsTrigger value="join" disabled={isCreating || isJoining}>Unirse a Partida</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="pt-6">
            <form onSubmit={handleCreateGame} className="space-y-6">
               <div>
                <p className="text-sm text-muted-foreground text-center">
                  Crea una partida y comparte el código de acceso con tus amigos para que puedan unirse.
                </p>
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg" disabled={isCreating}>
                {isCreating ? "Creando..." : "Crear y Jugar"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="join" className="pt-6">
            <form onSubmit={handleJoinGame} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="access-code">Código de Acceso</Label>
                <Input
                  id="access-code"
                  name="access-code"
                  placeholder="CÓDIGO"
                  maxLength={6}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="text-center tracking-widest text-lg h-12"
                  disabled={isJoining}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isJoining}>
                {isJoining ? "Uniéndose..." : "Unirse a Partida"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
