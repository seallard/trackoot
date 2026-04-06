import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-8">
      <h1 className="text-6xl font-black tracking-tight">🎵 Trackoot</h1>
      <p className="text-lg text-white/70">A real-time Spotify music quiz</p>
      <div className="flex gap-4">
        <Link
          href="/host"
          className="rounded-full bg-white px-8 py-3 font-bold text-game-bg transition hover:bg-white/90"
        >
          Host a Game
        </Link>
        <Link
          href="/join"
          className="rounded-full border-2 border-white px-8 py-3 font-bold text-white transition hover:bg-white/10"
        >
          Join a Game
        </Link>
      </div>
    </main>
  );
}
