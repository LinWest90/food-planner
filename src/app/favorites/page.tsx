import type { Metadata } from "next";
import Favorites from "./favorites";

export const metadata: Metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Favorites />
    </main>
  );
}
