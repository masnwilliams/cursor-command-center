export default function OfflinePage() {
  return (
    <div className="min-h-full bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold text-zinc-100">You're offline</h1>
        <p className="text-sm text-zinc-400">
          Check your connection and try again.
        </p>
      </div>
    </div>
  );
}
