"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { supabase } from "@/lib/supabase";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface FormErrors {
  password?: string;
  confirmPassword?: string;
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [showExpiredMessage, setShowExpiredMessage] = useState(false);
  
  // 현재 URL에서 해시 파라미터 확인 (이메일 인증 확인)
  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();
      
      // 세션이 없고 URL에 해시 파라미터가 없는 경우 만료 메시지 표시
      if (!data.session && !window.location.hash.includes('type=recovery')) {
        setShowExpiredMessage(true);
      }
    }
    
    checkSession();
  }, []);
  
  // 입력 필드 변경 핸들러
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // 비밀번호 변경할 때마다 오류 확인
    if (confirmPassword && e.target.value !== confirmPassword) {
      setFormErrors(prev => ({ ...prev, confirmPassword: "비밀번호가 일치하지 않습니다" }));
    } else if (confirmPassword) {
      setFormErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (e.target.value !== password) {
      setFormErrors(prev => ({ ...prev, confirmPassword: "비밀번호가 일치하지 않습니다" }));
    } else {
      setFormErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
  };
  
  // 폼 유효성 검사
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;
    
    // 비밀번호 검사
    if (!password) {
      errors.password = "비밀번호를 입력해주세요";
      isValid = false;
    } else if (password.length < 6) {
      errors.password = "비밀번호는 최소 6자 이상이어야 합니다";
      isValid = false;
    }
    
    // 비밀번호 확인 검사
    if (!confirmPassword) {
      errors.confirmPassword = "비밀번호 확인을 입력해주세요";
      isValid = false;
    } else if (confirmPassword !== password) {
      errors.confirmPassword = "비밀번호가 일치하지 않습니다";
      isValid = false;
    }
    
    setFormErrors(errors);
    return isValid;
  };
  
  // 비밀번호 업데이트 핸들러
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 폼 유효성 검사
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setGeneralError("");
      
      // Supabase Auth로 비밀번호 업데이트
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // 성공 메시지 표시
      setIsSuccess(true);
      
      // 3초 후 로그인 페이지로 리디렉션
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (error) {
      console.error('비밀번호 업데이트 오류:', error);
      setGeneralError(error instanceof Error ? error.message : '비밀번호 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 링크 만료 메시지
  if (showExpiredMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md">
          <Card className="border-none shadow-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold tracking-tight">링크가 만료되었습니다</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 dark:text-amber-400 mb-2" />
                <h3 className="text-lg font-medium text-amber-800 dark:text-amber-300 mb-1">
                  비밀번호 재설정 링크가 만료되었습니다
                </h3>
                <p className="text-amber-700 dark:text-amber-400 text-sm mb-4">
                  비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.<br />
                  새로운 비밀번호 재설정 링크를 요청해주세요.
                </p>
                <Button 
                  asChild
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Link href="/reset-password">새 링크 요청하기</Link>
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                <Link
                  href="/login"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  로그인 페이지로 돌아가기
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 md:p-8">
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
      </div>
      
      <div className="w-full max-w-md">
        <Card className="border-none shadow-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">새 비밀번호 설정</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
              사용할 새 비밀번호를 입력해주세요
            </CardDescription>
          </CardHeader>
          
          {isSuccess ? (
            <CardContent className="space-y-4 pt-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 dark:text-green-400 mb-2" />
                <h3 className="text-lg font-medium text-green-800 dark:text-green-300 mb-1">비밀번호 변경 완료</h3>
                <p className="text-green-700 dark:text-green-400 text-sm mb-4">
                  비밀번호가 성공적으로 변경되었습니다.<br />
                  새 비밀번호로 로그인할 수 있습니다.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  잠시 후 로그인 페이지로 이동합니다...
                </p>
                <Button 
                  asChild
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Link href="/login">로그인 페이지로</Link>
                </Button>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleUpdatePassword}>
              <CardContent className="space-y-4">
                {generalError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm">
                    {generalError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">새 비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className={`w-full h-11 rounded-md border ${formErrors.password ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                    value={password}
                    onChange={handlePasswordChange}
                    required
                  />
                  {formErrors.password && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.password}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className={`w-full h-11 rounded-md border ${formErrors.confirmPassword ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    required
                  />
                  {formErrors.confirmPassword && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">{formErrors.confirmPassword}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-transform hover:scale-[1.01]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "비밀번호 변경"}
                </Button>
              </CardContent>
            </form>
          )}
          
          <CardFooter className="flex justify-center">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                로그인 페이지로 돌아가기
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 