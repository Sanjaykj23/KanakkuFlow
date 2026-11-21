import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("overflow-hidden border-slate-200 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          {title}
        </CardTitle>
        {icon && <div className="text-slate-500">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            {trend && (
              <span
                className={cn(
                  "font-medium inline-flex items-center",
                  trend.isPositive ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {trend.isPositive ? "↑ " : "↓ "}
                {trend.value}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
