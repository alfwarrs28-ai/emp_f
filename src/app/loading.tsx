export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-muted animate-spin border-t-primary" />
      </div>
      <p className="text-muted-foreground text-sm font-medium animate-pulse">
        جاري التحميل...
      </p>
    </div>
  );
}
