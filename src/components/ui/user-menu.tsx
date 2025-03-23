"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ProfileDialog } from "@/components/ui/profile-dialog";
import { PasswordDialog } from "@/components/ui/password-dialog";

interface UserMenuProps {
  user: {
    id: string;
    email?: string;
    name?: string;
    avatar_url?: string;
    full_name?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">로그인</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link href="/signup">회원가입</Link>
        </Button>
      </div>
    );
  }

  const displayName = user.full_name || user.name || user.user_metadata?.full_name || user.email?.split('@')[0] || "사용자";
  const avatarUrl = user.avatar_url || user.user_metadata?.avatar_url || "";

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("로그아웃 중 오류 발생:", error);
    }
  };

  const handleOpenProfile = () => {
    setIsMenuOpen(false);
    setProfileOpen(true);
  };

  const handleOpenPasswordChange = () => {
    setIsMenuOpen(false);
    setPasswordOpen(true);
  };

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="relative h-10 w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Avatar className="h-9 w-9 border-2 border-white dark:border-gray-800 shadow-sm">
              {avatarUrl ? (
                <AvatarImage 
                  src={avatarUrl} 
                  alt={displayName} 
                  className="object-cover"
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <div className="flex items-center space-x-3 p-3">
            <Avatar className="h-10 w-10 border border-gray-200 dark:border-gray-700">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium line-clamp-1">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenProfile} className="cursor-pointer">
            사용자 정보 수정
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOpenPasswordChange} className="cursor-pointer">
            비밀번호 변경
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-red-500 dark:text-red-400" onClick={handleLogout}>
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
} 