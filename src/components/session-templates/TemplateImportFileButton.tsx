import { useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TemplateImportFileButtonProps {
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onFileSelected: (file: File | undefined) => void;
}

export default function TemplateImportFileButton({
  disabled,
  className,
  children,
  onFileSelected,
}: TemplateImportFileButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onFileSelected(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className={cn(className)}
        disabled={disabled}
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        {children}
      </Button>
    </>
  );
}
