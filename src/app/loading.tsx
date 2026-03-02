export default function Loading() {
  return (
    <div
      className="min-h-screen bg-canvas flex items-center justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-8 h-8 border-2 border-black/20 border-t-black/60 rounded-full animate-spin"
          role="status"
        >
          <span className="sr-only">Ładowanie...</span>
        </div>
        <p className="text-sm text-black/40">Ładowanie...</p>
      </div>
    </div>
  );
}
