import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  GitMerge,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EmptyState, PageHeader, SectionHeading } from "@/components/PageElements";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

const aliasSchema = z.object({
  canonicalName: z.string().trim().min(2, "اكتب الاسم المعتمد").max(200),
  aliases: z
    .string()
    .trim()
    .min(2, "أدخل صيغة بديلة واحدة على الأقل")
    .max(1000, "النص طويل جدًا"),
});

type AliasFormValues = z.infer<typeof aliasSchema>;

export default function AgentsPage() {
  const {
    rows,
    agentAliases,
    agentCandidates,
    approveAgentAlias,
    addManualAgentAlias,
    removeAgentAlias,
  } = useWorkspace();
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const form = useForm<AliasFormValues>({
    resolver: zodResolver(aliasSchema),
    defaultValues: { canonicalName: "", aliases: "" },
  });

  function approveCandidate(
    normalizedName: string,
    spellings: string[],
    rowIds: string[],
  ) {
    const candidate = { normalizedName, spellings, rowIds };
    const selected =
      selectedNames[normalizedName] ?? spellings[0] ?? "";
    if (!selected) return;
    approveAgentAlias(candidate, selected);
    toast.success("تم اعتماد صيغ الوكيل. نصوص المصدر لم تتغير.");
  }

  function addManualAlias(values: AliasFormValues) {
    const aliases = values.aliases
      .split(/[،,;\n]+/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!addManualAgentAlias(values.canonicalName, aliases)) {
      form.setError("aliases", {
        message: "أدخل اسمًا بديلًا مختلفًا عن الاسم المعتمد.",
      });
      return;
    }
    toast.success("تم حفظ ربط الأسماء يدويًا.");
    form.reset({ canonicalName: "", aliases: "" });
  }

  return (
    <>
      <PageHeader
        eyebrow="مراجعة يدوية"
        title="أسماء الوكلاء"
        description="اربط الصيغ المتشابهة بالاسم المعتمد. الربط يغيّر العرض والتصدير بعد موافقتك فقط."
      />

      <div className="notice notice-info">
        <ShieldCheck size={18} />
        <span>
          لا يتم دمج أي صيغة تلقائيًا. تبقى أسماء المصدر محفوظة، ويمكنك إلغاء
          اعتماد أي ربط لاحقًا.
        </span>
      </div>

      {!rows.length ? (
        <EmptyState
          title="لا يوجد ملف مستورد"
          detail="ارفع ملف Excel أولًا لتظهر صيغ أسماء الوكلاء التي يمكن مراجعتها."
          icon={UsersRound}
        />
      ) : (
        <>
          <section className="panel alias-candidate-panel">
            <SectionHeading
              title="اقتراحات من الملف"
              detail={`${agentCandidates.length.toLocaleString("ar")} مجموعات تحتاج قرارًا`}
            />
            {agentCandidates.length === 0 ? (
              <EmptyState
                title="لا توجد اقتراحات آلية"
                detail="إذا كانت صيغ الاسم مختلفة أكثر من اختلاف الكتابة، أضف ربطًا يدويًا أدناه."
                icon={BadgeCheck}
              />
            ) : (
              <div className="candidate-list">
                {agentCandidates.map((candidate) => {
                  const selected =
                    selectedNames[candidate.normalizedName] ??
                    candidate.spellings[0] ??
                    "";
                  return (
                    <article
                      className="candidate-card"
                      key={candidate.normalizedName}
                      data-testid={`agent-candidate-${candidate.normalizedName}`}
                    >
                      <div className="candidate-heading">
                        <span className="candidate-icon">
                          <GitMerge size={17} />
                        </span>
                        <div>
                          <b>صيغ قد تكون للاسم نفسه</b>
                          <small>
                            {candidate.rowIds.length.toLocaleString("ar")} سجلًا متأثرًا
                          </small>
                        </div>
                      </div>
                      <div className="candidate-spellings">
                        {candidate.spellings.map((spelling) => (
                          <span className="name-chip" key={spelling}>
                            {spelling}
                          </span>
                        ))}
                      </div>
                      <label className="canonical-select">
                        <span>الاسم الذي سيظهر في التصدير</span>
                        <span className="select-wrap">
                          <select
                            value={selected}
                            onChange={(event) =>
                              setSelectedNames((current) => ({
                                ...current,
                                [candidate.normalizedName]: event.target.value,
                              }))
                            }
                            data-testid={`select-agent-canonical-${candidate.normalizedName}`}
                          >
                            {candidate.spellings.map((spelling) => (
                              <option key={spelling} value={spelling}>
                                {spelling}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={15} />
                        </span>
                      </label>
                      <Button
                        size="sm"
                        onClick={() =>
                          approveCandidate(
                            candidate.normalizedName,
                            candidate.spellings,
                            candidate.rowIds,
                          )
                        }
                        data-testid={`button-approve-agent-${candidate.normalizedName}`}
                      >
                        <Check size={15} />
                        اعتماد الربط
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel manual-alias-panel">
            <SectionHeading
              title="إضافة ربط يدوي"
              detail="استخدمه عندما تختلف الصيغ أكثر من اختلاف المسافات أو اللقب."
            />
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(addManualAlias)}
                className="manual-alias-form"
                data-testid="form-add-agent-alias"
              >
                <FormField
                  control={form.control}
                  name="canonicalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الاسم المعتمد</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="الاسم الذي سيظهر في التقارير"
                          {...field}
                          data-testid="input-agent-canonical"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="aliases"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الصيغ البديلة</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="اكتب كل صيغة مفصولة بفاصلة أو في سطر مستقل"
                          rows={3}
                          {...field}
                          data-testid="input-agent-aliases"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" data-testid="button-add-agent-alias">
                  <Plus size={15} />
                  حفظ الربط المعتمد
                </Button>
              </form>
            </Form>
          </section>

          <section className="panel approved-alias-panel">
            <SectionHeading
              title="روابط الأسماء المعتمدة"
              detail="تُستخدم في العرض والتصدير، ولا تغيّر النص الأصلي داخل سجل العمل."
            />
            {agentAliases.length === 0 ? (
              <EmptyState
                title="لا توجد روابط معتمدة"
                detail="اعتمد اقتراحًا أو أضف ربطًا يدويًا ليظهر هنا."
                icon={UserRound}
              />
            ) : (
              <div className="approved-alias-list">
                {agentAliases.map((alias, index) => (
                  <article
                    className="approved-alias-row"
                    key={`${alias.normalizedName ?? alias.canonicalName}-${index}`}
                    data-testid={`approved-agent-alias-${index}`}
                  >
                    <span className="approved-agent-icon">
                      <BadgeCheck size={18} />
                    </span>
                    <div className="approved-agent-names">
                      <b>{alias.canonicalName}</b>
                      <span>{alias.aliases.join(" · ") || "لا توجد صيغ بديلة"}</span>
                    </div>
                    <span className="approved-tag">معتمد</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const approved = window.confirm(
                          "إلغاء الربط يعيد عرض الصيغ كما وردت في المصدر. هل تريد المتابعة؟",
                        );
                        if (approved) {
                          removeAgentAlias(alias.normalizedName);
                          toast.success("أُلغي ربط الصيغ.");
                        }
                      }}
                      data-testid={`button-remove-alias-${index}`}
                    >
                      <Trash2 size={15} />
                      إلغاء الربط
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

