import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-white shadow hover:bg-slate-800",
        secondary:
          "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200",
        destructive:
          "border-transparent bg-rose-500 text-white shadow hover:bg-rose-600",
        outline: "text-slate-950 border-slate-300",
        // Specialized ERP Status Badges
        owner: "border-purple-200 bg-purple-50 text-purple-700",
        admin: "border-blue-200 bg-blue-50 text-blue-700",
        supervisor: "border-indigo-200 bg-indigo-50 text-indigo-700",
        salesman: "border-amber-200 bg-amber-50 text-amber-700",
        accountant: "border-emerald-200 bg-emerald-50 text-emerald-700",
        production: "border-orange-200 bg-orange-50 text-orange-700",
        warehouse: "border-teal-200 bg-teal-50 text-teal-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        danger: "border-rose-200 bg-rose-50 text-rose-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
