'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LoaderCircle } from 'lucide-react';

/**
 * 이 페이지는 Supabase 인증 후 리디렉션을 처리합니다.
 * URL 파라미터에서 인증 정보를 추출하고 세션을 설정한 후
 * 사용자를 대시보드 또는 홈 페이지로 리디렉션합니다.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // 인증 상태 확인 및 처리
    const handleAuthCallback = async () => {
      try {
        // URL에서 인증 정보 추출
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('인증 콜백 처리 중 오류 발생:', error);
          router.push('/login?error=인증 처리 중 오류가 발생했습니다.');
          return;
        }
        
        if (data?.session) {
          // 세션이 있으면 사용자 대시보드 또는 홈으로 리디렉션
          console.log('인증 성공, 세션 설정됨');
          router.push('/weekly-task');
        } else {
          // 세션이 없으면 로그인 페이지로 리디렉션
          console.log('인증 실패, 세션 없음');
          router.push('/login');
        }
      } catch (error) {
        console.error('인증 콜백 처리 중 예외 발생:', error);
        router.push('/login?error=인증 처리 중 오류가 발생했습니다.');
      }
    };

    // 페이지 로드 시 인증 콜백 처리
    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <LoaderCircle size={32} className="animate-spin text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">인증 처리 중...</h2>
        <p className="text-gray-500">잠시만 기다려주세요.</p>
      </div>
    </div>
  );
} 