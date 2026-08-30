"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "~/lib/auth-client";

function SignIn() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) {
      router.replace("/");
    }
  }, [isPending, session, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Sign in to Playlist Sorter</h1>
      <button
        type="button"
        className="rounded-full bg-[#1DB954] px-6 py-3 font-semibold text-black transition hover:bg-[#1ed760]"
        onClick={() => {
          void authClient.signIn.social({
            provider: "spotify",
            callbackURL: "/",
          });
        }}
      >
        Sign in with Spotify
      </button>
    </main>
  );
}

export default SignIn;
