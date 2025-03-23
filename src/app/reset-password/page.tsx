"use client";

import React, { useState } from "react";
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
import { CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [generalError, setGeneralError] = useState("");
  
  // 이메일 입력 핸들러
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError("");
    setGeneralError("");
  };
  
  // 폼 유효성 검사
  const validateForm = (): boolean => {
    let isValid = true;
    
    // 이메일 검사
    if (!email.trim()) {
      setEmailError("이메일을 입력해주세요");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("올바른 이메일 형식이 아닙니다");
      isValid = false;
    }
    
    return isValid;
  };
  
  // 비밀번호 재설정 메일 전송 핸들러
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 폼 유효성 검사
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setGeneralError("");
      
      // Supabase Auth로 비밀번호 재설정 이메일 전송
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // 성공 메시지 표시
      setIsSuccess(true);
      
    } catch (error) {
      console.error('비밀번호 재설정 오류:', error);
      setGeneralError(error instanceof Error ? error.message : '비밀번호 재설정 요청 중 오류가 발생했습니다.');
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
            <CardTitle className="text-2xl font-bold tracking-tight">비밀번호 찾기</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
              등록된 이메일로 비밀번호 재설정 링크를 보내드립니다
            </CardDescription>
          </CardHeader>
          
          {isSuccess ? (
            <CardContent className="space-y-4 pt-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 dark:text-green-400 mb-2" />
                <h3 className="text-lg font-medium text-green-800 dark:text-green-300 mb-1">이메일이 전송되었습니다</h3>
                <p className="text-green-700 dark:text-green-400 text-sm mb-4">
                  {email}로 비밀번호 재설정 링크를 발송했습니다.<br />
                  이메일을 확인하여 비밀번호를 재설정해주세요.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  이메일이 보이지 않는 경우 스팸함을 확인하거나<br />
                  다시 시도해주세요.
                </p>
                <Button 
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                  }}
                  variant="outline" 
                  className="mr-2"
                >
                  다시 시도
                </Button>
                <Button 
                  asChild
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Link href="/login">로그인 페이지로</Link>
                </Button>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                {generalError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm">
                    {generalError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className={`w-full h-11 rounded-md border ${emailError ? 'border-red-500 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                    value={email}
                    onChange={handleEmailChange}
                    required
                  />
                  {emailError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">{emailError}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-transform hover:scale-[1.01]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "비밀번호 재설정 링크 전송"}
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