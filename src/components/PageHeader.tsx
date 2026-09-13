import type { ReactNode } from "react";
import { BrandDivider } from "./BrandDivider";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold">{title}</h1>
        {action}
      </div>
      <BrandDivider />
    </div>
  );
}
