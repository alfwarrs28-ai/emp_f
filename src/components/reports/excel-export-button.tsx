'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExcelExportButtonProps {
  startDate: string;
  endDate: string;
  employeeIds?: number[];
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExcelExportButton({
  startDate,
  endDate,
  employeeIds,
  disabled = false,
}: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('يجب تحديد نطاق التاريخ أولاً');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
      };

      if (employeeIds && employeeIds.length > 0) {
        payload.employeeIds = employeeIds;
      }

      const response = await fetch('/api/reports/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `خطأ في الخادم: ${response.status}`
        );
      }

      // Read the response as a blob
      const blob = await response.blob();

      // Create a temporary URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header, or use a default
      const disposition = response.headers.get('Content-Disposition');
      let filename = `attendance-report-${startDate}-${endDate}.xlsx`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('تم تصدير التقرير بنجاح');
    } catch (error) {
      console.error('Excel export failed:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء تصدير التقرير'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={disabled || loading || !startDate || !endDate}
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          جاري التصدير...
        </>
      ) : (
        <>
          <FileSpreadsheet className="h-4 w-4" />
          تصدير Excel
        </>
      )}
    </Button>
  );
}
