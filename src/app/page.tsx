"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "~/lib/auth-client";

function Home() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) {
    return <p className="p-4">Loading...</p>;
  }

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold">Not signed in</h1>
        <Link
          href="/sign-in"
          className="rounded-full bg-[#1DB954] px-6 py-3 font-semibold text-black transition hover:bg-[#1ed760]"
        >
          Sign in with Spotify
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">
        You are signed in as {session.user.email}
      </h1>
      <button
        type="button"
        className="rounded-full border border-zinc-400 px-6 py-3 font-semibold transition hover:bg-zinc-800"
        onClick={async () => {
          await authClient.signOut();
          router.push("/sign-in");
        }}
      >
        Sign out
      </button>
    </main>
  );
}

export default Home;
