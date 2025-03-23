"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, createUserIfNotExists } from "@/lib/supabase";

// 로그인 폼 필드 타입
interface LoginForm {
  email: string;
  password: string;
}

// 폼 오류 타입
interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  
  // 상태 관리
  const [formData, setFormData] = useState<LoginForm>({
    email: "",
    password: ""
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  // 페이지 로드 시 문서 클릭 이벤트 한 번 강제 발생 (포커스 문제 해결)
  useEffect(() => {
    // 페이지 로드 후 짧은 시간 후에 document 클릭 강제 발생
    const timer = setTimeout(() => {
      document.body.click();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // 입력 필드 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    // 이메일 검사
    if (!formData.email.trim()) {
      errors.email = "이메일을 입력해주세요";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "올바른 이메일 형식이 아닙니다";
      isValid = false;
    }

    // 비밀번호 검사
    if (!formData.password) {
      errors.password = "비밀번호를 입력해주세요";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // 폼 유효성 검사
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Supabase Auth로 로그인 시도
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // 로그인 성공 처리
      
      // users 테이블에 사용자 정보가 없는 경우 자동으로 생성
      if (data.user) {
        try {
          await createUserIfNotExists(data.user);
        } catch (userCreateError) {
          console.error('사용자 정보 자동 생성 중 오류:', userCreateError);
          // 계속 진행 (오류가 발생해도 기존 로직은 계속)
        }
      }
      
      // 리디렉션 상태 설정
      setIsRedirecting(true);
      
      // 세션이 완전히 설정될 시간을 주기 위해 추가 작업 수행
      try {
        // 세션이 제대로 설정되었는지 확인하기 위해 현재 세션 가져오기
        const { data: sessionData } = await supabase.auth.getSession();
        
        // 세션 확인 후 페이지 이동
        setTimeout(() => {
          // 명시적으로 페이지 이동 (force refresh)
          window.location.href = '/weekly-task';
        }, 500); // 0.5초 대기
      } catch (sessionError) {
        console.error('세션 확인 중 오류:', sessionError);
        // 오류가 발생해도 페이지 이동 시도
        setTimeout(() => {
          window.location.href = '/weekly-task';
        }, 500);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setSubmitError(error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.');
      setIsRedirecting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 md:p-8">
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
      </div>
      
      <div className="w-full max-w-md">
        <Card className="border-none shadow-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex justify-end mb-2">
              <div className="w-16 h-16">
                <Image 
                  src="/timbel_logo.png" 
                  alt="Timbel Logo" 
                  width={64} 
                  height={64}
                  priority
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 text-center mb-2">
              Timbel Weekly
            </h1>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {submitError && (
                <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm">
                  {submitError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className={`w-full h-11 rounded-md border ${formErrors.email ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                {formErrors.email && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={`w-full h-11 rounded-md border ${formErrors.password ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                {formErrors.password && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.password}</p>
                )}
                <div className="flex justify-end">
                  <Link
                    href="/reset-password"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    비밀번호 찾기
                  </Link>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-transform hover:scale-[1.01]"
                disabled={isSubmitting || isRedirecting}
              >
                {isSubmitting ? "로그인 중..." : isRedirecting ? "페이지 이동 중..." : "로그인"}
              </Button>

              {isRedirecting && (
                <div className="mt-3 text-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">인증 확인 후 페이지로 이동 중입니다...</p>
                </div>
              )}
            </CardContent>
          </form>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              계정이 없으신가요?{" "}
              <Link
                href="/signup"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                회원가입
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 