import type { Metadata } from "next";
import HomePage from "./home-page";

export const metadata: Metadata = {
  title: {
    absolute: "Your playlists | Spotify Release Date sorter",
  },
};

export default function Page() {
  return <HomePage />;
}
