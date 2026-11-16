import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  parseAmount,
  rawToText,
  type SourceRow,
} from "@/lib/domain";
import {
  type EditableRowValues,
  useWorkspace,
} from "@/lib/workspace-context";
import { toast } from "sonner";

const rowSchema = z.object({
  passportName: z.string().max(1000, "النص طويل جدًا"),
  receiptNumber: z.string().max(150, "رقم السند طويل جدًا"),
  paidRaw: z
    .string()
    .refine((value) => !value.trim() || parseAmount(value) !== null, {
      message: "اكتب مبلغًا رقميًا واضحًا أو اتركه فارغًا",
    }),
  remainingRaw: z
    .string()
    .refine((value) => !value.trim() || parseAmount(value) !== null, {
      message: "اكتب مبلغًا رقميًا واضحًا أو اتركه فارغًا",
    }),
  agentRaw: z.string().max(500, "الاسم طويل جدًا"),
  statusRaw: z.string().max(250, "الحالة طويلة جدًا"),
  dateRaw: z.string().max(100, "التاريخ طويل جدًا"),
  noteRaw: z.string().max(2000, "الملاحظة طويلة جدًا"),
});

type RowFormValues = z.infer<typeof rowSchema>;

function sourceValue(row: SourceRow, index: number): string {
  return rawToText(row.rawCells[index] ?? null);
}

export function RowEditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SourceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateSourceRow } = useWorkspace();
  const defaultValues = useMemo<RowFormValues>(
    () => ({
      passportName: row?.passportName ?? "",
      receiptNumber: row?.receiptNumber ?? "",
      paidRaw: rawToText(row?.paidRaw ?? null),
      remainingRaw: rawToText(row?.remainingRaw ?? null),
      agentRaw: row?.agentRaw ?? "",
      statusRaw: row?.statusRaw ?? "",
      dateRaw: rawToText(row?.dateRaw ?? null),
      noteRaw: row?.noteRaw ?? "",
    }),
    [row],
  );
  const form = useForm<RowFormValues>({
    resolver: zodResolver(rowSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  function onSubmit(values: RowFormValues) {
    if (!row) return;
    const updated = updateSourceRow(row.id, values as EditableRowValues);
    if (!updated) {
      toast.error("تعذر حفظ التصحيح.");
      return;
    }
    toast.success("حُفظ التصحيح، وبقيت القيم الأصلية محفوظة.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="row-editor-dialog">
        <DialogHeader className="text-right">
          <DialogTitle>مراجعة بيانات السجل</DialogTitle>
          <DialogDescription>
            صف المصدر {row?.sourceRowNumber ?? "—"} · عدّل القيم غير الصحيحة فقط.
            التعديل لا يغيّر ملفك الأصلي.
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="source-row-reference">
            <span>القيم المحفوظة من الملف</span>
            <div>
              <b>{sourceValue(row, 0) || "اسم فارغ"}</b>
              <span>السند {sourceValue(row, 1) || "غير محدد"}</span>
            </div>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="row-editor-form"
            data-testid="form-edit-row"
          >
            <div className="editor-grid">
              <FormField
                control={form.control}
                name="passportName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الجواز</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-passport" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="receiptNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم السند</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-receipt" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paidRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المبلغ المدفوع</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        dir="auto"
                        {...field}
                        data-testid="input-edit-paid"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remainingRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المبلغ المتبقي المكتوب</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        dir="auto"
                        {...field}
                        data-testid="input-edit-remaining"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agentRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الوكيل</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-agent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="statusRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>حالة الجواز</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-status" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التاريخ</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="noteRaw"
                render={({ field }) => (
                  <FormItem className="editor-note">
                    <FormLabel>الملاحظة</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        data-testid="input-edit-note"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="row-editor-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="button-save-row"
              >
                حفظ التصحيح
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

