"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updatePassword, signOut } from "@/lib/supabase";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasswordDialog({ open, onOpenChange }: PasswordDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // 비밀번호 유효성 검사
  const validatePasswords = () => {
    const newErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};
    let isValid = true;

    if (!currentPassword) {
      newErrors.currentPassword = "현재 비밀번호를 입력해주세요";
      isValid = false;
    }

    if (!newPassword) {
      newErrors.newPassword = "새 비밀번호를 입력해주세요";
      isValid = false;
    } else if (newPassword.length < 6) {
      newErrors.newPassword = "비밀번호는 6자 이상이어야 합니다";
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "비밀번호 확인을 입력해주세요";
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // 비밀번호 변경 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // 비밀번호 변경 API 호출
      await updatePassword(newPassword);

      // 성공 메시지
      toast({
        title: "비밀번호 변경 성공",
        description: "비밀번호가 변경되었습니다. 보안을 위해 다시 로그인해주세요.",
      });

      // 입력값 초기화
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});

      // 다이얼로그 닫기
      onOpenChange(false);
      
      // 리디렉션 상태 설정
      setIsRedirecting(true);
      
      // 약간의 딜레이 후에 로그아웃 및 로그인 페이지로 리디렉션
      setTimeout(async () => {
        try {
          // 사용자 로그아웃
          await signOut();
          
          // 로그인 페이지로 리디렉션 (완전한 페이지 새로고침을 위해 href 사용)
          window.location.href = '/login';
        } catch (logoutError) {
          console.error("로그아웃 중 오류:", logoutError);
          // 오류가 발생해도 로그인 페이지로 이동
          window.location.href = '/login';
        }
      }, 1500);
      
    } catch (error) {
      console.error("비밀번호 변경 중 오류:", error);
      
      // 오류 메시지
      toast({
        title: "비밀번호 변경 실패",
        description: error instanceof Error 
          ? error.message 
          : "비밀번호 변경 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">비밀번호 변경</DialogTitle>
          <DialogDescription>
            새 비밀번호를 설정하세요. 안전한 비밀번호를 사용하는 것이 좋습니다.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-sm font-medium">현재 비밀번호</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`w-full ${errors.currentPassword ? "border-red-500" : ""}`}
              disabled={isSubmitting}
            />
            {errors.currentPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.currentPassword}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium">새 비밀번호</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full ${errors.newPassword ? "border-red-500" : ""}`}
              disabled={isSubmitting}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">비밀번호 확인</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full ${errors.confirmPassword ? "border-red-500" : ""}`}
              disabled={isSubmitting}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
            )}
          </div>
          
          <DialogFooter className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 