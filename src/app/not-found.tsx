import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">
          الصفحة غير موجودة
        </h2>
        <p className="text-muted-foreground max-w-md">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى عنوان آخر.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
