import Link from "next/link";

export default function MenuNotFound() {
  return (
    <main className="min-h-screen bg-[#120f0d] text-[#f5efe6] flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl mb-4">
        Menu not found
      </h1>
      <p className="text-[#9a8f82] mb-8">
        This restaurant menu is not published or does not exist.
      </p>
      <Link href="/" className="text-[#c9a962] hover:underline">
        Go home
      </Link>
    </main>
  );
}