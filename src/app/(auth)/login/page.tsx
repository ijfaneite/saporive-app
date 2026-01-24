"use client";

import * as React from 'react';
import Image from 'next/image';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  username: z.string().min(1, { message: "El usuario es requerido." }),
  password: z.string().min(1, { message: "La clave es requerida." }),
});

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  
  const logo = PlaceHolderImages.find(img => img.id === 'logo');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoggingIn(true);
    try {
      await login(values.username, values.password);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: error instanceof Error ? error.message : "Ha ocurrido un error inesperado.",
      });
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
            {logo && (
                 <Image
                    src={logo.imageUrl}
                    alt={logo.description}
                    width={150}
                    height={150}
                    className="mx-auto rounded-full shadow-lg"
                    data-ai-hint={logo.imageHint}
                />
            )}
          <h1 className="mt-6 text-4xl font-headline font-bold text-primary">
            Sapori.ve
          </h1>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input placeholder="su-usuario" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clave</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full font-bold" disabled={isLoggingIn}>
              {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
