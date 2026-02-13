'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12 text-center space-y-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <WifiOff className="h-10 w-10 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">لا يوجد اتصال بالإنترنت</h1>
            <p className="text-muted-foreground">
              يمكنك الاستمرار في إدخال بيانات الحضور والاستئذانات.
              سيتم مزامنة البيانات تلقائياً عند عودة الاتصال.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => window.location.href = '/attendance'}
              variant="default"
            >
              صفحة الحضور
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 me-2" />
              إعادة المحاولة
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
