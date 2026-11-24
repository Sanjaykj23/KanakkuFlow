"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertOctagon,
  Calendar,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { getExpiryAlerts } from "@/modules/inventory/actions";

export default function ExpiryAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [thresholdDays, setThresholdDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    setLoading(true);
    const res = await getExpiryAlerts(thresholdDays);
    if (res.success && res.alerts) {
      setAlerts(res.alerts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAlerts();
  }, [thresholdDays]);

  const expiredCount = alerts.filter((a) => a.alertType === "EXPIRED").length;
  const criticalCount = alerts.filter((a) => a.alertType === "CRITICAL").length;
  const upcomingCount = alerts.filter((a) => a.alertType === "UPCOMING").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            Batch Shelf-Life & Expiry Watchlist
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Detect near-expiry food raw materials and packaged batches before spoil threshold.
          </p>
        </div>

        {/* Configurable Threshold Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md text-xs">
          {[7, 15, 30, 60].map((days) => (
            <button
              key={days}
              onClick={() => setThresholdDays(days)}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                thresholdDays === days
                  ? "bg-white dark:bg-zinc-900 text-primary shadow-xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Within {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Alert Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50/20">
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Expired Batches (Past Shelf Life)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {expiredCount}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Blocked from dispatch; write-off required</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/20">
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Critical Expiry (&le; 7 Days)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {criticalCount}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Prioritize immediate FEFO consumption</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Upcoming Expiry (&le; {thresholdDays} Days)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {upcomingCount}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Monitored for sales order picking</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Tracked At-Risk Batches</CardTitle>
          <CardDescription className="text-xs">
            Showing physical batches with shelf-life expiring within {thresholdDays} days
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Batch #</TableHead>
                <TableHead className="text-xs font-semibold">Material / Item</TableHead>
                <TableHead className="text-xs font-semibold">Warehouse</TableHead>
                <TableHead className="text-xs font-semibold">Expiry Date</TableHead>
                <TableHead className="text-xs font-semibold">Time Remaining</TableHead>
                <TableHead className="text-xs font-semibold text-right">Current On-Hand</TableHead>
                <TableHead className="text-xs font-semibold">Recommended Action</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs">Scanning batch expiry dates...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                    <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-emerald-600">All Batches Healthy</p>
                    <p className="text-xs text-zinc-400">No materials expiring within {thresholdDays} days.</p>
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => {
                  const b = alert.batch;
                  const days = alert.daysUntilExpiry;

                  return (
                    <TableRow key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {b.batch_number}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{b.item?.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{b.item?.code}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {b.warehouse?.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {b.expiry_date}
                      </TableCell>
                      <TableCell>
                        {alert.alertType === "EXPIRED" ? (
                          <Badge variant="destructive" className="text-xs font-mono">
                            Expired ({Math.abs(days)}d ago)
                          </Badge>
                        ) : alert.alertType === "CRITICAL" ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono text-xs">
                            {days} Days Remaining
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-xs">
                            {days} Days Remaining
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">
                        {b.current_qty} {b.base_unit?.symbol}
                      </TableCell>
                      <TableCell className="text-xs">
                        {alert.alertType === "EXPIRED" ? (
                          <span className="text-red-600 font-semibold">Write-off / Disposal Adjustment</span>
                        ) : alert.alertType === "CRITICAL" ? (
                          <span className="text-amber-600 font-semibold">Immediate Priority FEFO Pick</span>
                        ) : (
                          <span className="text-zinc-500">Monitor in regular dispatch</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/inventory/batches/${b.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs flex items-center gap-1">
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
