'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getCurrentUserDetails } from '@/lib/supabase';
import { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminPermission = async () => {
      try {
        // 1. 현재 로그인한 사용자 정보 확인
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('로그인된 사용자 정보를 찾을 수 없습니다');
        }
        
        // 2. 사용자 역할 정보를 직접 가져오기 (API 호출 대신)
        const userDetails = await getCurrentUserDetails();
        if (!userDetails) {
          throw new Error('사용자 상세 정보를 가져오지 못했습니다');
        }
        
        // 3. SUPER 권한이 없는 경우 리디렉션
        if (userDetails.role !== 'SUPER') {
          console.log('관리자 권한이 없습니다. 리디렉션합니다.');
          router.push('/weekly-task');
          return;
        }
        
        // 4. 권한이 있는 경우 로딩 완료
        setIsLoading(false);
      } catch (error) {
        console.error('관리자 권한 확인 중 오류:', error);
        router.push('/weekly-task');
      }
    };

    checkAdminPermission();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">관리자 대시보드</h1>
          <nav className="flex space-x-4">
            <Link href="/admin" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              멤버 관리
            </Link>
            <Link href="/weekly-task" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              주간 업무로 돌아가기
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <Toaster position="top-center" />
    </div>
  );
} 