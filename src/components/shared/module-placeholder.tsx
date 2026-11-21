import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Construction, Sparkles, ArrowRight, Layers } from "lucide-react";

interface ModulePlaceholderProps {
  moduleName: string;
  category: string;
  description: string;
  features: string[];
  sampleMetrics?: { label: string; value: string }[];
  actionLabel?: string;
}

export function ModulePlaceholder({
  moduleName,
  category,
  description,
  features,
  sampleMetrics,
  actionLabel = "Configure Module",
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {category}
            </span>
            <Badge variant="outline" className="text-slate-600 bg-white">
              <Layers className="w-3 h-3 mr-1 text-slate-500" />
              ERP Module
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {moduleName}
          </h1>
          <p className="text-xs text-slate-500">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            {actionLabel}
          </Button>
        </div>
      </div>

      {/* Sample Metrics If Provided */}
      {sampleMetrics && sampleMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sampleMetrics.map((metric, i) => (
            <Card key={i} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {metric.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold font-mono text-slate-900">
                  {metric.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Feature & Specs Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Construction className="w-4 h-4 text-amber-600" />
            Module Specification & Implementation Scope
          </CardTitle>
          <CardDescription className="text-xs">
            This module's UI layout and business operations are scheduled in the development roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200/80"
              >
                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <div className="text-xs text-slate-700">{feature}</div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-md bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
            <span>
              <strong>Phase 1 Shell Active:</strong> Database schema, RLS policies, and RBAC permissions are already defined in migration <code>20261121000001_initial_core_schema.sql</code>.
            </span>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline shrink-0 ml-4"
            >
              Return to Cockpit <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
