"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/icons";
import { useAuth, useUser } from "@/firebase";
import { initiateAnonymousSignIn, initiateEmailSignUp, initiateEmailSignIn } from "@/firebase/non-blocking-login";
import { useToast } from "@/hooks/use-toast";
import { AuthError, getAuth, onAuthStateChanged } from "firebase/auth";

export function AuthForm() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user, error) => {
        setIsSubmitting(false);
        if (user) {
            router.push("/mode-select");
        } else if (error) {
             const authError = error as AuthError;
             let message = "Ha ocurrido un error inesperado.";
             switch (authError.code) {
                case "auth/invalid-email":
                    message = "El formato del correo electrónico no es válido.";
                    break;
                case "auth/user-not-found":
                    message = "No se encontró ningún usuario con ese correo electrónico.";
                    break;
                case "auth/wrong-password":
                    message = "La contraseña es incorrecta.";
                    break;
                case "auth/email-already-in-use":
                    message = "Este correo electrónico ya está registrado.";
                    break;
                 case "auth/weak-password":
                     message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
                     break;
                default:
                    message = authError.message;
                    break;
             }
             toast({
                title: "Error de autenticación",
                description: message,
                variant: "destructive",
             });
        }
    });

    return () => unsubscribe();
  }, [auth, router, toast]);

  if (isUserLoading || user) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Logo className="w-16 h-16 text-primary animate-pulse" />
            <p className="text-muted-foreground mt-4">Cargando...</p>
        </div>
    );
  }

  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    initiateEmailSignUp(auth, email, password);
  };
  
  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    initiateEmailSignIn(auth, email, password);
  };

  const handleAnonymousSignIn = () => {
    initiateAnonymousSignIn(auth);
  };

  return (
    <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-card/80">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center gap-3 mb-4">
          <Logo className="w-12 h-12 text-primary" />
          <CardTitle className="text-5xl font-headline tracking-tighter">
            La Pocha
          </CardTitle>
        </div>
        <CardDescription>
          El clásico juego de cartas de bazas. Inicia sesión para jugar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-6">
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="login-email">Correo Electrónico</Label>
                        <Input id="login-email" type="email" placeholder="tu@email.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isSubmitting}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="login-password">Contraseña</Label>
                        <Input id="login-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={isSubmitting}/>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                        {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </Button>
                </form>
            </TabsContent>
             <TabsContent value="register" className="pt-6">
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="register-email">Correo Electrónico</Label>
                        <Input id="register-email" type="email" placeholder="tu@email.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isSubmitting}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="register-password">Contraseña</Label>
                        <Input id="register-password" type="password" placeholder="Mínimo 6 caracteres" required value={password} onChange={e => setPassword(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                       {isSubmitting ? 'Registrando...' : 'Crear Cuenta'}
                    </Button>
                </form>
            </TabsContent>
        </Tabs>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              O continuar como
            </span>
          </div>
        </div>
        <Button onClick={handleAnonymousSignIn} variant="secondary" className="w-full" size="lg">
          Invitado
        </Button>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground text-center w-full">
          Al iniciar sesión, aceptas nuestros términos de servicio (que aún no hemos escrito).
        </p>
      </CardFooter>
    </Card>
  );
}
