"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();
  
  useEffect(() => {
    // 3초 후 홈페이지로 리디렉션
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="text-center space-y-6 max-w-md mx-auto">
        <h1 className="text-6xl font-bold text-blue-600 dark:text-blue-400">404</h1>
        <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-200">페이지를 찾을 수 없습니다</h2>
        <p className="text-gray-600 dark:text-gray-400">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          잠시 후 자동으로 홈페이지로 이동합니다.
        </p>
        <div className="mt-8">
          <Link href="/" passHref>
            <Button size="lg" className="px-8 py-6 text-base font-semibold shadow-lg transition-transform hover:scale-105">
              홈페이지로 이동
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 