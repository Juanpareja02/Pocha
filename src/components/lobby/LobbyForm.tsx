"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function LobbyForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [accessCode, setAccessCode] = useState("");

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would create a game in Firestore and get an ID
    const mockGameId = "mock-game-" + Math.random().toString(36).substring(2, 8);
    router.push(`/play/${mockGameId}`);
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.trim().length === 0) {
      toast({
        title: "Invalid Code",
        description: "Please enter a game access code.",
        variant: "destructive",
      });
      return;
    }
    // In a real app, this would find the game by code and navigate
    router.push(`/play/${accessCode}`);
  };

  return (
    <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-2xl font-headline">
          <Play /> Game Lobby
        </CardTitle>
        <CardDescription className="text-center">Create a new game or join an existing one.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create Game</TabsTrigger>
            <TabsTrigger value="join">Join Game</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="pt-6">
            <form onSubmit={handleCreateGame} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="ai-players" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  AI Opponents
                </Label>
                <Select defaultValue="3">
                  <SelectTrigger id="ai-players" className="w-full">
                    <SelectValue placeholder="Select number of AI opponents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 AI Player</SelectItem>
                    <SelectItem value="2">2 AI Players</SelectItem>
                    <SelectItem value="3">3 AI Players</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">You will play with up to 3 other AI opponents.</p>
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
                Create & Play
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="join" className="pt-6">
            <form onSubmit={handleJoinGame} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="access-code">Game Access Code</Label>
                <Input
                  id="access-code"
                  name="access-code"
                  placeholder="e.g. POCHA1"
                  maxLength={6}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="text-center tracking-widest text-lg h-12"
                />
              </div>
              <Button type="submit" className="w-full" size="lg">
                Join Game
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
