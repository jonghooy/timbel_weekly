"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase, getCurrentUser } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    name: "",
    department: "",
    team: "",
    avatar_url: ""
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 부서 목록 샘플
  const departments = [
    { id: "dev", name: "개발부" },
    { id: "sales", name: "영업부" },
    { id: "marketing", name: "마케팅부" },
    { id: "hr", name: "인사부" },
    { id: "finance", name: "재무부" }
  ];

  // 팀 목록 샘플 (부서에 따라 동적으로 변경됨)
  const teamsByDepartment: Record<string, { id: string, name: string }[]> = {
    dev: [
      { id: "frontend", name: "프론트엔드팀" },
      { id: "backend", name: "백엔드팀" },
      { id: "mobile", name: "모바일팀" },
      { id: "devops", name: "DevOps팀" }
    ],
    sales: [
      { id: "domestic", name: "국내영업팀" },
      { id: "overseas", name: "해외영업팀" }
    ],
    marketing: [
      { id: "digital", name: "디지털마케팅팀" },
      { id: "content", name: "콘텐츠팀" },
      { id: "brand", name: "브랜드전략팀" }
    ],
    hr: [
      { id: "recruitment", name: "채용팀" },
      { id: "training", name: "교육팀" },
      { id: "admin", name: "인사행정팀" }
    ],
    finance: [
      { id: "accounting", name: "회계팀" },
      { id: "investment", name: "투자팀" },
      { id: "tax", name: "세무팀" }
    ]
  };

  // 현재 부서에 해당하는 팀 목록 가져오기
  const getTeamsForDepartment = () => {
    return profile.department && teamsByDepartment[profile.department] 
      ? teamsByDepartment[profile.department] 
      : [];
  };

  // 사용자 정보 로드
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        
        // 현재 사용자 정보 가져오기
        const userData = await getCurrentUser();
        if (!userData) {
          // 사용자가 없으면 로그인 페이지로 리디렉션
          router.push('/login');
          return;
        }
        
        setUser(userData);
        
        // 사용자 프로필 정보 가져오기
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.id)
          .single();
        
        if (error) {
          throw error;
        }
        
        if (profileData) {
          setProfile({
            name: profileData.name || "",
            department: profileData.department || "",
            team: profileData.team || "",
            avatar_url: profileData.avatar_url || ""
          });
        }
      } catch (error) {
        console.error("프로필 로드 중 오류 발생:", error);
        toast({
          title: "오류 발생",
          description: "프로필 정보를 불러오는 중 문제가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserProfile();
  }, [router, toast]);

  // 이미지 파일 선택 핸들러
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImage(file);
      
      // 이미지 미리보기 설정
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImagePreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 프로필 업데이트 핸들러
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!user) return;
    
    try {
      setIsSaving(true);
      
      let avatarUrl = profile.avatar_url;
      
      // 이미지가 변경된 경우 업로드
      if (image) {
        const fileExt = image.name.split('.').pop();
        const filePath = `avatars/${user.id}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, image, { upsert: true });
        
        if (uploadError) {
          throw uploadError;
        }
        
        // 업로드된 이미지의 URL 가져오기
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = data.publicUrl;
      }
      
      // 프로필 정보 업데이트
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profile.name,
          department: profile.department,
          team: profile.team,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "저장 완료",
        description: "프로필이 성공적으로 업데이트되었습니다.",
      });
      
      // 프로필 업데이트 후 1초 뒤 새로고침
      setTimeout(() => {
        router.refresh();
      }, 1000);
      
    } catch (error) {
      console.error("프로필 저장 중 오류:", error);
      toast({
        title: "저장 실패",
        description: "프로필 정보를 저장하는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">프로필 정보 수정</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500">데이터를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 프로필 이미지 섹션 */}
              <div className="space-y-4">
                <Label htmlFor="avatar" className="text-base font-medium">프로필 이미지</Label>
                <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4">
                  <Avatar className="h-24 w-24">
                    {imagePreview ? (
                      <AvatarImage src={imagePreview} alt="프로필 미리보기" />
                    ) : profile.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="현재 프로필" />
                    ) : (
                      <AvatarFallback className="bg-blue-500 text-white text-xl">
                        {profile.name ? profile.name[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col gap-2 w-full max-w-sm">
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      권장: 정사각형 이미지, 최대 2MB
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 이름 필드 */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-medium">이름</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                />
              </div>
              
              {/* 사업부 선택 */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-base font-medium">사업부</Label>
                <Select
                  value={profile.department}
                  onValueChange={(value) => setProfile({ ...profile, department: value, team: "" })}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="사업부를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 팀 선택 */}
              <div className="space-y-2">
                <Label htmlFor="team" className="text-base font-medium">팀</Label>
                <Select
                  value={profile.team}
                  onValueChange={(value) => setProfile({ ...profile, team: value })}
                  disabled={!profile.department}
                >
                  <SelectTrigger id="team">
                    <SelectValue placeholder={profile.department ? "팀을 선택하세요" : "먼저 사업부를 선택하세요"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getTeamsForDepartment().map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 버튼 영역 */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/weekly-task')}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 