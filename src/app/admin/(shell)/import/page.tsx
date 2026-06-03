import { MenuImportWizard } from "@/components/admin/menu-import-wizard";

export default function ImportPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Import menu
      </h1>
      <p className="text-[#5c534a] mb-8">
        Upload a photo of your existing menu. Grok will extract categories,
        dishes, descriptions, and prices for you to review. Tune prompts in{" "}
        <code className="text-sm bg-[#f0ebe3] px-1.5 py-0.5 rounded">
          prompts/menu-extraction-*.txt
        </code>
        — each run is logged in <code className="text-sm bg-[#f0ebe3] px-1.5 py-0.5 rounded">llm.log</code> with the exact text used.
      </p>
      <MenuImportWizard />
    </div>
  );
}