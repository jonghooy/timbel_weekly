"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">주간업무관리</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link 
              href="/weekly-task" 
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              주간 업무 계획
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
} 