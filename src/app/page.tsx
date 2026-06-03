import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#120f0d] text-[#f5efe6] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[#c9a962] text-sm tracking-[0.3em] uppercase mb-4">
        SmartMenu
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl max-w-lg leading-tight mb-6">
        From paper menu to polished digital experience
      </h1>
      <p className="text-[#9a8f82] max-w-md mb-10">
        Import menus with AI, enhance dish photos, publish a mobile-first menu
        your guests will love.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/admin"
          className="px-8 py-3 bg-[#c9a962] text-[#120f0d] font-medium rounded-full hover:bg-[#d4b872] transition"
        >
          Admin dashboard
        </Link>
        <Link
          href="/bistro-luna"
          className="px-8 py-3 border border-[#3d3530] rounded-full hover:border-[#c9a962] transition"
        >
          View demo menu
        </Link>
      </div>
    </main>
  );
}