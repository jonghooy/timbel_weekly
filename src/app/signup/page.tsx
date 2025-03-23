"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, createUserIfNotExists, signUp } from "@/lib/supabase";

// 회원가입 폼 필드 타입
interface SignupForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

// 폼 오류 타입
interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
}

export default function SignupPage() {
  const router = useRouter();

  // 상태 관리
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 폼 데이터 관리
  const [formData, setFormData] = useState<SignupForm>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false
  });

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

    // 이름 검사
    if (!formData.fullName.trim()) {
      errors.fullName = "이름을 입력해주세요";
      isValid = false;
    }

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
    } else if (formData.password.length < 6) {
      errors.password = "비밀번호는 최소 6자 이상이어야 합니다";
      isValid = false;
    }

    // 비밀번호 확인 검사
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "비밀번호가 일치하지 않습니다";
      isValid = false;
    }

    // 이용약관 동의 검사
    if (!formData.acceptTerms) {
      errors.acceptTerms = "이용약관에 동의해주세요";
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

      // 사용자 정의 회원가입 함수 사용
      const { user: authUser, error: signUpError, success } = await signUp(
        formData.email,
        formData.password,
        formData.fullName
      );

      // 오류가 발생한 경우
      if (!success || signUpError) {
        throw new Error(signUpError || "회원가입 처리 중 오류가 발생했습니다.");
      }
      
      // 2. auth.users 테이블에 사용자가 생성될 시간을 확보하기 위한 지연
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. 추가 사용자 정보를 users 테이블에 저장
      if (authUser) {
        try {
          // createUserIfNotExists 함수를 사용하여 사용자 프로필 생성
          const profileCreated = await createUserIfNotExists({
            id: authUser.id,
            email: formData.email,
            user_metadata: {
              full_name: formData.fullName
            }
          });

          if (!profileCreated) {
            console.error('사용자 프로필 생성에 실패했습니다.');
            // 하지만 회원가입은 완료된 것으로 처리
          }
        } catch (profileErr) {
          console.error('프로필 생성 중 예외 발생:', profileErr);
          // 프로필 생성 실패해도 회원가입은 완료된 것으로 처리
        }
      }

      // 성공 시 로그인 페이지로 이동
      alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
      
      // 완전한 페이지 새로고침을 통해 이동
      window.location.href = '/login';
    } catch (error) {
      console.error('회원가입 오류:', error);
      // 오류 메시지 설정 - 이미 등록된 이메일인 경우 더 친절한 메시지 표시
      setSubmitError(error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.');
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
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">회원가입</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
              새로운 계정을 만들어 업무 관리를 시작하세요
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {submitError && (
                <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm">
                  {submitError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">이름</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="홍길동"
                  className={`w-full h-11 rounded-md border ${formErrors.fullName ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                />
                {formErrors.fullName && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.fullName}</p>
                )}
              </div>
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
                {formErrors.password ? (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.password}</p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    최소 6자 이상의 비밀번호를 입력하세요
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className={`w-full h-11 rounded-md border ${formErrors.confirmPassword ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
                {formErrors.confirmPassword && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.confirmPassword}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 ${formErrors.acceptTerms ? 'border-red-500' : ''}`}
                  checked={formData.acceptTerms}
                  onChange={handleInputChange}
                  required
                />
                <label
                  htmlFor="acceptTerms"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <span>
                    서비스 약관에 동의합니다
                  </span>
                </label>
              </div>
              {formErrors.acceptTerms && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.acceptTerms}</p>
              )}
              <Button 
                type="submit" 
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-transform hover:scale-[1.01]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "처리 중..." : "회원가입"}
              </Button>
            </CardContent>
          </form>
          <CardFooter className="flex justify-center">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              이미 계정이 있으신가요?{" "}
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                로그인
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 