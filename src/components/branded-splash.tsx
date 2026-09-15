import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Wordmark } from "./logo";

export function BrandedSplash({ message = "Preparing today’s Sabha…" }: { message?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center px-5 py-10">
      <Wordmark />
      <h1 className="sr-only">{APP_NAME}</h1>
      <p className="mt-3 text-muted-foreground">{APP_TAGLINE}</p>
      <p className="mt-6 text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
