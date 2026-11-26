import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbStatus = "healthy";
  let dbLatencyMs = 0;
  let errorMessage: string | null = null;

  try {
    const admin = createAdminClient();
    const dbStart = Date.now();
    const { data, error } = await admin.from("companies").select("id").limit(1);
    dbLatencyMs = Date.now() - dbStart;

    if (error) {
      dbStatus = "unhealthy";
      errorMessage = error.message;
    }
  } catch (err: unknown) {
    dbStatus = "unreachable";
    errorMessage = err instanceof Error ? err.message : "Database connection exception";
  }

  const isHealthy = dbStatus === "healthy";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "UP" : "DOWN",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(errorMessage && { error: errorMessage }),
        },
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
      responseTimeMs: Date.now() - start,
    },
    { status: statusCode }
  );
}
