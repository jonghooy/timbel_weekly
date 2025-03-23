"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // 홈 페이지 접속 시 인증 상태 확인 후 적절한 페이지로 리디렉션
    const checkAuthAndRedirect = async () => {
      setIsLoading(true);
      
      try {
        // 현재 사용자 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // 인증된 사용자는 주간 업무 페이지로 리디렉션
          console.log('인증된 사용자 확인: 주간 업무 페이지로 이동합니다.');
          window.location.replace('/weekly-task');
        } else {
          // 인증되지 않은 사용자는 로그인 페이지로 리디렉션
          console.log('인증되지 않은 사용자: 로그인 페이지로 이동합니다.');
          window.location.replace('/login');
        }
      } catch (error) {
        console.error('인증 확인 중 오류:', error);
        // 오류 발생 시 로그인 페이지로 이동
        window.location.replace('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthAndRedirect();
  }, []);
  
  // 특징 데이터
  const features = [
    {
      title: "주간 업무 계획",
      description: "매주 업무 계획을 작성하고 관리하여 업무의 방향성을 설정합니다.",
      icon: "📝"
    },
    {
      title: "실행 결과 추적",
      description: "계획된 업무의 실행 결과를 추적하여 업무 완료율을 분석합니다.",
      icon: "📊"
    },
    {
      title: "데이터 시각화",
      description: "업무 데이터를 시각화하여 업무 패턴과 효율성을 파악합니다.",
      icon: "📈"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      {isLoading ? (
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">로딩 중...</p>
        </div>
      ) : (
        <p className="text-gray-500">페이지 이동 중...</p>
      )}
    </div>
  );
} 