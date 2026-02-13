'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Backup } from '@/types/database';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toArabicNumerals } from '@/lib/utils/date';

import {
  Download,
  Upload,
  HardDrive,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewData {
  metadata: {
    version: string;
    timestamp: string;
    exported_by: string;
    counts: Record<string, number>;
  };
  counts: Record<string, number>;
  dateRanges: {
    attendance: { from: string; to: string } | null;
    permissions: { from: string; to: string } | null;
  };
  samples: Record<string, any[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TABLE_LABELS: Record<string, string> = {
  employees: 'الموظفين',
  settings: 'الإعدادات',
  attendance: 'الحضور',
  permissions: 'الاستئذانات',
  locks: 'الإقفالات',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupManager() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // Backup history
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);

  // Import
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  // ---- Fetch backup history ----
  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching backups:', error.message);
        return;
      }

      setBackups((data as Backup[]) || []);
    } catch (err) {
      console.error('Unexpected error fetching backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // ---- Export backup ----
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/admin/backup/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error || 'حدث خطأ أثناء التصدير');
        return;
      }

      // Download the JSON file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `school-attendance-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('تم تصدير النسخة الاحتياطية بنجاح');
      await fetchBackups();
    } catch (err) {
      console.error('Export error:', err);
      toast.error('حدث خطأ غير متوقع أثناء التصدير');
    } finally {
      setExporting(false);
    }
  };

  // ---- Handle file selection ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('يرجى اختيار ملف بصيغة JSON');
      return;
    }

    setSelectedFile(file);
    setPreviewData(null);
  };

  // ---- Preview import ----
  const handlePreview = async () => {
    if (!selectedFile) return;

    setPreviewing(true);
    try {
      const text = await selectedFile.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error('صيغة الملف غير صحيحة — يجب أن يكون JSON صالح');
        return;
      }

      const response = await fetch('/api/admin/backup/import?preview=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'حدث خطأ أثناء معاينة الملف');
        return;
      }

      setPreviewData(result.preview as PreviewData);
      toast.success('تمت معاينة الملف بنجاح');
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('حدث خطأ غير متوقع أثناء المعاينة');
    } finally {
      setPreviewing(false);
    }
  };

  // ---- Execute restore ----
  const handleRestore = async () => {
    if (!selectedFile) return;

    setImporting(true);
    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);

      const response = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'حدث خطأ أثناء الاستعادة');
        return;
      }

      toast.success(result.message || 'تمت الاستعادة بنجاح');

      // Reset state
      setSelectedFile(null);
      setPreviewData(null);
      setConfirmRestoreOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchBackups();
    } catch (err) {
      console.error('Restore error:', err);
      toast.error('حدث خطأ غير متوقع أثناء الاستعادة');
    } finally {
      setImporting(false);
    }
  };

  // ---- Clear file selection ----
  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            إنشاء نسخة احتياطية
          </CardTitle>
          <CardDescription>
            تصدير جميع بيانات النظام كملف JSON يمكن استعادته لاحقاً
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <LoadingSpinner size="sm" className="ml-2" />
                جارٍ التصدير...
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 ml-2" />
                تصدير نسخة احتياطية
              </>
            )}
          </Button>

          {/* Backup history */}
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              سجل النسخ الاحتياطية
            </h4>
            {loadingBackups ? (
              <LoadingSpinner className="py-4" />
            ) : backups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                لا توجد نسخ احتياطية مسجلة
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>النوع</TableHead>
                      <TableHead>تاريخ الإنشاء</TableHead>
                      <TableHead>ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell>
                          <Badge
                            variant={
                              backup.backup_type === 'manual'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {backup.backup_type === 'manual'
                              ? 'يدوي'
                              : 'تلقائي'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDateTime(backup.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {backup.note || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore from Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            استعادة من نسخة احتياطية
          </CardTitle>
          <CardDescription>
            تحميل ملف نسخة احتياطية سابقة لاستعادة البيانات
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-400">
              الاستعادة ستستبدل بيانات الحضور والاستئذانات الحالية بالبيانات
              الموجودة في النسخة الاحتياطية.
            </p>
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">ملف النسخة الاحتياطية</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground file:ml-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />
              {selectedFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFile}
                >
                  مسح
                </Button>
              )}
            </div>
          </div>

          {/* Selected file info */}
          {selectedFile && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-muted rounded-lg"
            >
              <FileJson className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  الحجم:{' '}
                  {toArabicNumerals(
                    (selectedFile.size / 1024).toFixed(1)
                  )}{' '}
                  كيلوبايت
                </p>
              </div>
              {!previewData && (
                <Button
                  size="sm"
                  onClick={handlePreview}
                  disabled={previewing}
                >
                  {previewing ? (
                    <LoadingSpinner size="sm" className="ml-2" />
                  ) : (
                    <Database className="h-4 w-4 ml-2" />
                  )}
                  معاينة
                </Button>
              )}
            </motion.div>
          )}

          {/* Preview results */}
          <AnimatePresence>
            {previewData && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4 p-4 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold">نتائج المعاينة</h4>
                </div>

                {/* Metadata */}
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>
                    إصدار النسخة: {previewData.metadata.version}
                  </p>
                  <p>
                    تاريخ التصدير:{' '}
                    {formatDateTime(previewData.metadata.timestamp)}
                  </p>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {Object.entries(previewData.counts).map(([key, count]) => (
                    <div
                      key={key}
                      className="text-center p-3 bg-muted rounded-md"
                    >
                      <p className="text-lg font-bold">
                        {toArabicNumerals(count)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TABLE_LABELS[key] || key}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Date ranges */}
                {(previewData.dateRanges.attendance ||
                  previewData.dateRanges.permissions) && (
                  <div className="text-sm space-y-1">
                    <p className="font-medium">نطاق التواريخ:</p>
                    {previewData.dateRanges.attendance && (
                      <p className="text-muted-foreground">
                        الحضور: من {previewData.dateRanges.attendance.from} إلى{' '}
                        {previewData.dateRanges.attendance.to}
                      </p>
                    )}
                    {previewData.dateRanges.permissions && (
                      <p className="text-muted-foreground">
                        الاستئذانات: من{' '}
                        {previewData.dateRanges.permissions.from} إلى{' '}
                        {previewData.dateRanges.permissions.to}
                      </p>
                    )}
                  </div>
                )}

                {/* Restore button */}
                <Button
                  variant="destructive"
                  onClick={() => setConfirmRestoreOpen(true)}
                  disabled={importing}
                  className="w-full sm:w-auto"
                >
                  {importing ? (
                    <>
                      <LoadingSpinner size="sm" className="ml-2" />
                      جارٍ الاستعادة...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 ml-2" />
                      استعادة البيانات
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Restore Confirmation */}
      <ConfirmDialog
        open={confirmRestoreOpen}
        onOpenChange={setConfirmRestoreOpen}
        title="تأكيد استعادة البيانات"
        description="سيتم حذف بيانات الحضور والاستئذانات الحالية واستبدالها بالبيانات الموجودة في النسخة الاحتياطية. لا يمكن التراجع عن هذا الإجراء."
        confirmText="استعادة"
        cancelText="إلغاء"
        onConfirm={handleRestore}
        variant="destructive"
      />
    </div>
  );
}
