"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Factory, Lock, Mail, ShieldAlert, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Phase 1 local UI simulation / Supabase auth integration
      if (!email || !password) {
        setErrorMessage("Please enter both email and password.");
        setIsLoading(false);
        return;
      }

      // Simulate successful credential validation and role-specific redirect
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials. Please try again.");
      setIsLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("KanakkuFlow@2026");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-100/80">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-amber-500 shadow-md mb-2">
            <Factory className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kanakku<span className="text-amber-600">Flow</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Food Manufacturing Enterprise Resource Planning (ERP)
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg">Sign in to your workplace</CardTitle>
            <CardDescription className="text-xs">
              Enter your corporate email and password to access your role dashboard.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Corporate Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@muruganfoods.com"
                    className="pl-9 text-xs"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <a
                    href="/update-password"
                    className="text-xs text-amber-600 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    className="pl-9 text-xs"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button
                type="submit"
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Access ERP Dashboard"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Quick Demo Access Bar */}
        <div className="p-3 border rounded-lg border-slate-200 bg-white/70 text-xs space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick Preview Access:
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleQuickFill("owner@kanakkuflow.internal")}
              className="px-2 py-1 text-[11px] rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
            >
              Owner
            </button>
            <button
              onClick={() => handleQuickFill("admin@muruganfoods.com")}
              className="px-2 py-1 text-[11px] rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickFill("sales@muruganfoods.com")}
              className="px-2 py-1 text-[11px] rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            >
              Salesman
            </button>
            <button
              onClick={() => handleQuickFill("accounts@muruganfoods.com")}
              className="px-2 py-1 text-[11px] rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            >
              Accountant
            </button>
            <button
              onClick={() => handleQuickFill("prod@muruganfoods.com")}
              className="px-2 py-1 text-[11px] rounded bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
            >
              Production
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
