"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { formSchema } from "../lib/schemas";
import { useRouter } from "next/navigation";
import { useToast } from "./ui/use-toast";

export function UrlForm() {
  const router = useRouter();
  const toast = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      shorthand: "",
    },
  });
  const submitUrl = async (data: z.infer<typeof formSchema>) => {
    const res = await fetch("/api/create", {
      body: JSON.stringify(data),
      method: "POST",
    });
    if (res.status !== 200) {
      return;
    }
    const { shorthand } = (await res.json()) as {
      url: string;
      shorthand: string;
    };
    router.refresh();
    toast.toast({ title: "Shortened Url Created", description: shorthand });
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitUrl)} className="space-y-8">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Url</FormLabel>
              <FormControl>
                <Input placeholder="https://kalski.xyz" {...field} />
              </FormControl>
              <FormDescription>
                This is the URL you want shortened
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="shorthand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Shorthand <span className="text-gray-500"> (optional)</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="example" {...field} />
              </FormControl>
              <FormDescription>
                This is the shortened suffix for the link (e.g.{" "}
                {process.env.NEXT_PUBLIC_SITE_URL}/example)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
