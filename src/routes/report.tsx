import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Container, PageHeader } from "@/components/findit/page";
import { useFindIt } from "@/hooks/use-findit";
import { CATEGORIES, LOCATIONS, type Category, type ItemType, type Location } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a lost or found item — FindIt" },
      { name: "description", content: "Post a lost or found item on campus with details and a photo." },
      { property: "og:title", content: "Report a lost or found item — FindIt" },
      { property: "og:description", content: "Post a lost or found item on campus with details and a photo." },
    ],
  }),
  component: Report,
});

type Errors = Partial<Record<"title" | "description" | "category" | "location" | "date" | "image", string | undefined>>;
const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, error, children, hint }: { label: string; error?: string | undefined; hint?: string | undefined; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-xs font-medium text-destructive">{error}</span> : hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Report() {
  const { createItem, uploadImage } = useFindIt();
  const navigate = useNavigate();
  const [type, setType] = useState<ItemType>("LOST");
  const [form, setForm] = useState({ title: "", description: "", category: "", location: "", date: today() });
  // `image` is ONLY a preview for the screen. It is never sent to the server.
  const [image, setImage] = useState<string>();
  // `imageFile` is the real file that gets uploaded.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const upd = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const clearImage = () => {
    setImage(undefined);
    setImageFile(null);
  };

  const onFile = (f?: File) => {
    if (!f) return undefined;
    if (!f.type.startsWith("image/")) return setErrors((e) => ({ ...e, image: "Please choose an image file." }));
    if (f.size > 2 * 1024 * 1024) return setErrors((e) => ({ ...e, image: "Image must be under 2 MB." }));
    setImageFile(f);
    const r = new FileReader();
    r.onload = () => setImage(r.result as string);
    r.readAsDataURL(f);
    setErrors((e) => ({ ...e, image: undefined }));
    return undefined;
  };

  const validate = () => {
    const e: Errors = {};
    if (form.title.trim().length < 3) e.title = "Give the item a short title (at least 3 characters).";
    else if (form.title.length > 80) e.title = "Keep the title under 80 characters.";
    if (form.description.trim().length < 10) e.description = "Add a few details (at least 10 characters).";
    if (!form.category) e.category = "Choose a category.";
    if (!form.location) e.location = "Choose where it was lost or found.";
    if (!form.date) e.date = "Pick a date.";
    else if (form.date > today()) e.date = "Date can't be in the future.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    setBusy(true);
    try {
      // 1. Upload the real file (if any) and get back a short path like /uploads/abc.jpg
      const imageUrl = imageFile ? await uploadImage(imageFile) : undefined;

      // 2. Create the item using only that short path
      const item = await createItem({
        type,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category as Category,
        location: form.location as Location,
        date: form.date,
        imageUrl,
      });

      toast.success("Your report is live!");
      navigate({ to: "/items/$id", params: { id: item.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const err = (k: keyof Errors) => (errors[k] ? "border-destructive" : "");

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow="Report" title="Report an item" description="The more detail you add, the faster it gets matched." />
        <form onSubmit={submit} noValidate className="card-surface space-y-5 p-5 sm:p-8">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(["LOST", "FOUND"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={cn("rounded-lg py-2.5 text-sm font-semibold transition-all", type === t ? "bg-card shadow-card text-foreground" : "text-muted-foreground")}
              >
                I {t === "LOST" ? "lost" : "found"} something
              </button>
            ))}
          </div>

          <Field label="Title" error={errors.title}>
            <input className={cn("field", err("title"))} value={form.title} onChange={upd("title")} placeholder="e.g. Black leather wallet" maxLength={90} />
          </Field>
          <Field label="Description" error={errors.description} hint="Colour, brand, markings, contents…">
            <textarea className={cn("field h-28 py-3", err("description"))} value={form.description} onChange={upd("description")} placeholder="Describe the item" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" error={errors.category}>
              <select className={cn("field", err("category"))} value={form.category} onChange={upd("category")}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Location" error={errors.location}>
              <select className={cn("field", err("location"))} value={form.location} onChange={upd("location")}>
                <option value="">Select location</option>
                {LOCATIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label={type === "LOST" ? "Date lost" : "Date found"} error={errors.date}>
            <input type="date" max={today()} className={cn("field", err("date"))} value={form.date} onChange={upd("date")} />
          </Field>

          <div>
            <span className="text-sm font-semibold">Photo <span className="font-normal text-muted-foreground">(optional)</span></span>
            {image ? (
              <div className="relative mt-1.5 overflow-hidden rounded-xl border border-border">
                <img src={image} alt="Preview" className="h-56 w-full object-cover" />
                <button type="button" onClick={clearImage} className="absolute right-2 top-2 rounded-full bg-card p-1.5 shadow-card" aria-label="Remove photo">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="mt-1.5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-8 text-center transition-colors hover:border-primary hover:bg-primary-soft/50">
                <ImagePlus className="h-7 w-7 text-primary" />
                <span className="text-sm font-medium">Click to upload a photo</span>
                <span className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            )}
            {errors.image && <span className="mt-1 block text-xs font-medium text-destructive">{errors.image}</span>}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/" })}>Cancel</Button>
            <Button type="submit" disabled={busy} className="rounded-xl px-6">{busy ? "Submitting…" : "Submit report"}</Button>
          </div>
        </form>
      </div>
    </Container>
  );
}