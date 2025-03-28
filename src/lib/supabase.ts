import { createClient } from '@supabase/supabase-js';

// Supabase URL과 API Key를 환경 변수에서 가져옵니다.
// 실제 환경에서는 .env.local 파일에 아래 값들이 설정되어 있어야 합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
const redirectUrl = process.env.NEXT_PUBLIC_REDIRECT_URL || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anonymous Key');
}

// Database 타입 정의
export type Database = any;

/**
 * 파일 업로드 결과를 위한 인터페이스
 */
export interface UploadResult {
  path: string;
  fullPath: string;
  success: boolean;
  error?: string;
}

// 내부 사용을 위한 간단한 업로드 결과 인터페이스
interface InternalUploadResult {
  path: string;
  success: boolean;
  error?: string;
}

// Supabase 클라이언트 생성
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 서비스 롤 키가 있을 경우 관리자용 클라이언트 생성 (RLS 우회용)
// 주의: 이 클라이언트는 RLS를 우회하기 때문에 조심해서 사용해야 함
export const adminSupabase = supabaseServiceKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// 사이트 URL 정보
export const getRedirectUrl = () => {
  return redirectUrl || 'http://localhost:3000/auth/callback';
};

// 부서 목록을 가져오는 함수
export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');

  if (error) {
    console.error('부서 목록을 가져오는 중 오류 발생:', error);
    return [];
  }

  return data || [];
}

// 특정 부서의 팀 목록을 가져오는 함수
export async function getTeamsByDepartment(departmentId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('department_id', departmentId)
    .order('name');

  if (error) {
    console.error('팀 목록을 가져오는 중 오류 발생:', error);
    return [];
  }

  return data || [];
}

// 현재 로그인한 사용자 정보 가져오기
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('사용자 정보 가져오기 오류:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('getCurrentUser 오류:', error);
    return null;
  }
}

// 특정 사용자의 주간 업무 데이터를 가져오는 함수 (권한 체크 추가)
export const getWeeklyTasksByUser = async (
  userId: string, 
  year: number,
  currentUserId?: string
): Promise<any[]> => {
  try {
    // 쿼리 타임아웃을 위한 프로미스 생성
    const timeoutPromise = new Promise<any[]>((resolve) => {
      setTimeout(() => {
        resolve([]); // 조용히 빈 배열 반환
      }, 5000); // 5초 타임아웃
    });

    // 데이터를 가져오는 프로미스
    const fetchDataPromise = (async () => {
      try {
        // 1. 본인 데이터인 경우 바로 조회
        if (!currentUserId || currentUserId === userId) {
          // 본인 데이터는 권한 체크 없이 즉시 반환
          try {
            const { data, error } = await supabase
              .from('weekly_tasks')
              .select('*')
              .eq('user_id', userId)
              .eq('year', year)
              .order('week_number', { ascending: true });

            if (error) {
              return [];
            }

            return data || [];
          } catch (err) {
            return [];
          }
        }

        // 2. 다른 사용자 데이터인 경우 권한 체크
        try {
          const hasPermission = await checkPermission(currentUserId, userId);
          if (!hasPermission) {
            return [];
          }

          try {
            const { data, error } = await supabase
              .from('weekly_tasks')
              .select('*')
              .eq('user_id', userId)
              .eq('year', year)
              .order('week_number', { ascending: true });

            if (error) {
              return [];
            }

            return data || [];
          } catch (queryErr) {
            return [];
          }
        } catch (permissionError) {
          // 권한 체크에 실패한 경우 빈 배열 반환
          return [];
        }
      } catch (generalError) {
        return [];
      }
    })();

    // 타임아웃과 데이터 로드 경쟁 - 예외 처리 강화
    try {
      return await Promise.race([fetchDataPromise, timeoutPromise]);
    } catch (raceError) {
      return []; // 어떤 오류가 발생하더라도 빈 배열 반환
    }
  } catch (error) {
    return [];
  }
};

// 모든 사용자의 주간 업무 데이터를 가져오는 함수 (권한에 따라 필터링)
export const getAllWeeklyTasks = async (
  currentUserId: string,
  year: number,
  weekNumber?: number
): Promise<any[]> => {
  try {
    // 현재 사용자 정보 조회
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error('사용자 정보를 가져오는 중 오류 발생:', currentUserError);
      return [];
    }

    // 권한에 따라 사용자 목록 필터링
    const users = await getUsersWithWeeklyTasks(currentUserId);
    if (users.length === 0) {
      return [];
    }

    // 볼 수 있는 사용자 ID 목록
    const userIds = users.map((user: any) => user.id);

    // 주간 업무 쿼리 빌드
    let query = supabase
      .from('weekly_tasks')
      .select(`
        *,
        users:user_id (
          id,
          email,
          full_name,
          department_id,
          team_id,
          role
        )
      `)
      .eq('year', year)
      .in('user_id', userIds);

    // 특정 주차만 필터링 (주차 번호가 제공된 경우)
    if (weekNumber) {
      query = query.eq('week_number', weekNumber);
    }

    // 주차 번호 오름차순, 사용자 이름 오름차순 정렬
    query = query.order('week_number', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('주간 업무 데이터를 가져오는 중 오류 발생:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('모든 주간 업무 데이터를 가져오는 중 오류 발생:', error);
    return [];
  }
};

// 특정 주차의 업무를 가져오는 함수
export const getWeeklyTask = async (
  userId: string, 
  year: number, 
  weekNumber: number, 
  currentUserId?: string
): Promise<any> => {
  try {
    // 권한 확인 (현재 사용자 ID가 제공된 경우)
    if (currentUserId && currentUserId !== userId) {
      const hasPermission = await checkPermission(currentUserId, userId);
      if (!hasPermission) {
        console.error('권한이 없습니다.');
        return null;
      }
    }

    const { data, error } = await supabase
      .from('weekly_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('week_number', weekNumber)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: 결과가 없는 경우
      console.error('주간 업무를 가져오는 중 오류 발생:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('주간 업무를 가져오는 중 오류 발생:', error);
    return null;
  }
};

// 주간 업무를 저장하거나 업데이트하는 함수
export async function saveWeeklyTask(
  userId: string,
  year: number,
  weekNumber: number,
  thisWeekTasks: string,
  nextWeekPlan: string,
  notes: string = '',
  currentUserId?: string
): Promise<boolean> {
  try {
    // 본인 데이터만 수정 가능
    if (currentUserId && currentUserId !== userId) {
      console.error('본인 데이터만 수정할 수 있습니다.');
      return false;
    }

    // 먼저 해당 주차의 업무가 이미 존재하는지 확인
    const existingTask = await getWeeklyTask(userId, year, weekNumber);
    
    const submissionDate = new Date().toISOString();
    
    if (existingTask) {
      // 업데이트
      const { data, error } = await supabase
        .from('weekly_tasks')
        .update({
          this_week_tasks: thisWeekTasks,
          next_week_plan: nextWeekPlan,
          note: notes,
          submission_date: submissionDate
        })
        .eq('id', existingTask.id)
        .select();
        
      if (error) {
        console.error('주간 업무 업데이트 중 오류 발생:', error);
        return false;
      }
      
      return true;
    } else {
      // 새로 생성
      const { data, error } = await supabase
        .from('weekly_tasks')
        .insert([{
          user_id: userId,
          year: year,
          week_number: weekNumber,
          this_week_tasks: thisWeekTasks,
          next_week_plan: nextWeekPlan,
          note: notes,
          submission_date: submissionDate
        }])
        .select();
        
      if (error) {
        console.error('주간 업무 저장 중 오류 발생:', error);
        return false;
      }
      
      return true;
    }
  } catch (error) {
    console.error('주간 업무 저장 중 오류 발생:', error);
    return false;
  }
}

// 사용자 로그인
export async function signIn(email: string, password: string) {
  try {
    // 환경 변수에서 사이트 URL을 가져옵니다
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const redirectUrl = process.env.NEXT_PUBLIC_REDIRECT_URL || '';
    
    const finalRedirectUrl = redirectUrl || `${siteUrl}/auth/callback` || 'http://localhost:3000/auth/callback';
    
    console.log('로그인 리디렉션 URL:', finalRedirectUrl);
    
    // 타입스크립트 오류 방지를 위해 options 제거
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('로그인 오류 세부정보:', error);
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    console.error('로그인 오류:', error);
    return { success: false, error };
  }
}

// 사용자 로그아웃
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
  
  return true;
}

// 비밀번호 변경
export async function updatePassword(newPassword: string) {
  try {
    // 현재 로그인된 사용자의 비밀번호를 업데이트
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('비밀번호 변경 중 오류 발생:', error);
    throw error;
  }
}

// 특정 사용자의 세부 정보를 가져오는 함수
export async function getUserDetails(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('사용자 세부 정보 조회 중 오류:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getUserDetails 오류:', error);
    return null;
  }
}

// 현재 사용자의 세부 정보 가져오기
export async function getCurrentUserDetails() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    let userDetails = await getUserDetails(user.id);
    
    // 사용자 정보가 없으면 자동으로 생성
    if (!userDetails) {
      await createUserIfNotExists(user);
      userDetails = await getUserDetails(user.id);
    }
    
    return userDetails;
  } catch (error) {
    console.error('현재 사용자 세부 정보를 가져오는 중 오류:', error);
    return null;
  }
}

// 사용자 정보가 없으면 자동으로 생성
export async function createUserIfNotExists(user: any) {
  // 사용자 존재 여부 확인
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();
  
  // 오류가 있거나 데이터가 없으면 (사용자가 존재하지 않으면)
  if (error || !data) {
    console.log('사용자 정보가 존재하지 않습니다. 새 사용자 정보 생성...');
    
    // 재시도 최대 횟수 설정
    let maxRetries = 3;
    let success = false;
    let retryCount = 0;
    
    while (!success && retryCount < maxRetries) {
      try {
        // 새 사용자 정보 삽입 시도
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '사용자',
            department_id: null,
            team_id: null,
            role: 'MEMBER',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            avatar_url: null
          });
        
        if (insertError) {
          console.error(`사용자 정보 생성 시도 ${retryCount + 1}/${maxRetries} 중 오류:`, insertError);
          
          // 외래 키 제약 조건 위반 또는 동시성 문제인 경우 재시도
          if (insertError.message && (
              insertError.message.includes('violates foreign key constraint') ||
              insertError.message.includes('duplicate key value') ||
              insertError.message.includes('conflict')
          )) {
            retryCount++;
            // 지수 백오프 (점점 대기 시간 증가)
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            console.log(`${retryCount}번째 재시도 중...`);
            continue;
          } else {
            // 다른 종류의 오류인 경우 재시도하지 않고 실패로 처리
            return false;
          }
        }
        
        console.log('새 사용자 정보가 성공적으로 생성되었습니다.');
        success = true;
        return true;
      } catch (e) {
        console.error('예상치 못한 오류 발생:', e);
        retryCount++;
        // 예외 발생 시에도 지수 백오프
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (!success) {
      console.error(`최대 재시도 횟수(${maxRetries})를 초과했습니다. 사용자 생성에 실패했습니다.`);
      return false;
    }
  }
  
  return true; // 이미 사용자가 존재하는 경우에도 성공으로 처리
}

/**
 * 사용자 프로필 정보를 업데이트하는 함수
 * @param userId 사용자 ID
 * @param updateData 업데이트할 데이터
 * @returns 업데이트 결과
 */
export async function updateUserProfile(userId: string, updateData: any) {
  try {
    // 현재 사용자 정보 조회
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (currentUserError) {
      console.error('현재 사용자 정보 조회 오류:', currentUserError);
      return { success: false, error: currentUserError };
    }

    // 이미지 URL이 있는 경우 타임스탬프 추가
    if (updateData.avatar_url) {
      const timestamp = new Date().getTime();
      const url = new URL(updateData.avatar_url);
      url.searchParams.set('t', timestamp.toString());
      updateData.avatar_url = url.toString();
    }

    // 업데이트할 데이터에 타임스탬프 추가
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    // 사용자 정보 업데이트
    const { data, error } = await supabase
      .from('users')
      .update(dataToUpdate)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('사용자 정보 업데이트 오류:', error);
      return { success: false, error };
    }

    // Supabase 세션 새로고침
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (session) {
      await supabase.auth.refreshSession();
    }

    return { success: true, data };
  } catch (error) {
    console.error('updateUserProfile 오류:', error);
    return { success: false, error };
  }
}

// 버킷이 존재하는지 확인하고 없으면 생성하는 함수
export async function ensureBucketExists(bucketName: string) {
  try {
    // 일반 클라이언트로 버킷 목록 가져오기 시도
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('버킷 목록 가져오기 오류:', bucketError);
      if (!bucketError.message.includes('does not exist') && !bucketError.message.includes('not found')) {
        throw bucketError;
      }
    }
    
    // 버킷이 있는지 확인
    const bucketExists = buckets?.some(b => b.name === bucketName) ?? false;
    
    if (!bucketExists) {
      // 관리자 클라이언트가 있으면 사용, 없으면 일반 클라이언트로 시도
      if (adminSupabase) {
        console.log(`관리자 권한으로 버킷 "${bucketName}" 생성 시도...`);
        try {
          const { data, error } = await adminSupabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
          });
          
          if (error) {
            console.error(`관리자 권한으로 버킷 생성 오류:`, error);
            return { error: `관리자 권한으로 버킷 생성 실패: ${error.message}` };
          }
          
          console.log(`버킷 "${bucketName}" 생성 완료!`, data);
          return { success: true, data };
        } catch (createError) {
          console.error(`버킷 "${bucketName}" 생성 중 예외 발생:`, createError);
          return { error: `버킷 생성 중 예외: ${createError}` };
        }
      } else {
        console.warn('관리자 클라이언트가 없어 버킷 생성이 불가능합니다. 서비스 롤 키를 환경 변수에 설정하세요.');
        
        // 개발 환경에서는 일반 클라이언트로 시도해볼 수 있음
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData.session;
          
          if (!session) {
            console.error('인증되지 않은 상태입니다.');
            return { error: '인증 필요' };
          }
          
          // API를 직접 호출하여 버킷 생성
          const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: bucketName,
              public: true,
              file_size_limit: 10485760
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`버킷 "${bucketName}" 생성 API 응답 오류:`, response.status, errorText);
            return { error: `버킷 생성 실패: ${response.status} - ${errorText}` };
          }
          
          const result = await response.json();
          return { success: true, data: result };
        } catch (createError) {
          console.error(`버킷 "${bucketName}" 생성 중 예외 발생:`, createError);
          return { error: `버킷 생성 중 예외: ${createError}` };
        }
      }
    }
    
    return { success: true, message: `버킷 "${bucketName}"이 이미 존재합니다.` };
  } catch (error) {
    console.error('버킷 확인/생성 중 오류:', error);
    return { error: `버킷 확인/생성 중 오류: ${error}` };
  }
}

/**
 * 버킷 생성을 시도하는 함수 (관리자 권한 필요)
 * 일반 권한으로는 생성이 안되므로 관리자가 대시보드에서 생성해야 함
 */
export async function createBucket(name: string) {
  try {
    // 버킷 목록 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('버킷 목록 가져오기 오류:', listError);
      return { success: false, error: listError };
    }
    
    // 이미 버킷이 존재하는지 확인
    const bucketExists = buckets.some(bucket => bucket.name === name);
    if (bucketExists) {
      return { success: true, message: '이미 존재하는 버킷' };
    }
    
    // 버킷 생성 시도
    const { data, error } = await supabase.storage.createBucket(name, {
      public: true,
      fileSizeLimit: 5242880, // 5MB
    });
    
    if (error) {
      console.error('버킷 생성 오류:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('버킷 생성 중 예외 발생:', error);
    return { success: false, error };
  }
}

/**
 * Supabase Storage에 파일을 업로드하는 함수
 * @param bucket 업로드할 버킷 이름
 * @param userId 사용자 ID (RLS 정책에 맞게 경로를 구성하기 위해 필요)
 * @param file 업로드할 파일 객체
 * @returns 업로드 결과 (path, fullPath, success 등의 정보 포함)
 */
export async function uploadFile(bucket: string, userId: string, file: File): Promise<UploadResult> {
  try {
    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop() || 'jpg';
    
    // 고정된 파일명 사용 (사용자별로 하나의 프로필 이미지만 유지)
    const safeFileName = `profile.${fileExt}`;
    
    // 사용자 ID를 폴더명으로 사용 (RLS 정책 준수)
    const filePath = `${userId}/${safeFileName}`;
    
    // 파일을 Blob 객체로 변환 (타입 호환성 문제 방지)
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    
    // 먼저 일반 클라이언트로 시도
    let uploadResult = await normalUpload(bucket, filePath, blob, file.type);
    
    // 일반 클라이언트로 실패했고, 관리자 클라이언트가 사용 가능하면 다시 시도
    if (!uploadResult.success && adminSupabase && (uploadResult.error || '').includes('permission')) {
      console.log('일반 권한으로 업로드 실패, 관리자 권한으로 시도합니다...');
      uploadResult = await adminUpload(bucket, filePath, blob, file.type);
    }
    
    // 성공 여부 확인
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || '알 수 없는 업로드 오류');
    }
    
    // 성공한 경우 fullPath를 추가하여 반환
    return {
      ...uploadResult,
      fullPath: `${supabaseUrl}/storage/v1/object/public/${bucket}/${uploadResult.path}`
    };
    
  } catch (error: any) {
    console.error('업로드 중 예외 발생:', error);
    
    // 개발 환경에서만 더미 URL 반환
    if (process.env.NODE_ENV !== 'production') {
      return { 
        path: 'dummy/path/image.jpg', 
        fullPath: `https://placehold.co/400x400?text=Avatar`,
        success: false,
        error: error.message
      };
    }
    throw error;
  }
}

/**
 * 일반 사용자 권한으로 파일 업로드를 시도하는 함수
 * @private
 */
async function normalUpload(bucket: string, filePath: string, blob: Blob, contentType: string): Promise<InternalUploadResult> {
  try {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('일반 권한 파일 업로드 오류:', error.message);
      return {
        path: '',
        success: false,
        error: error.message
      };
    }
    
    return {
      path: data.path,
      success: true
    };
  } catch (error: any) {
    console.error('일반 권한 업로드 중 예외:', error);
    return {
      path: '',
      success: false,
      error: error.message
    };
  }
}

/**
 * 관리자 권한으로 파일 업로드를 시도하는 함수
 * @private
 */
async function adminUpload(bucket: string, filePath: string, blob: Blob, contentType: string): Promise<InternalUploadResult> {
  if (!adminSupabase) {
    return {
      path: '',
      success: false,
      error: '관리자 클라이언트가 없습니다. 서비스 롤 키를 환경 변수에 설정하세요.'
    };
  }
  
  try {
    const { data, error } = await adminSupabase
      .storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('관리자 권한 파일 업로드 오류:', error.message);
      return {
        path: '',
        success: false,
        error: error.message
      };
    }
    
    console.log('관리자 권한으로 업로드 성공:', data.path);
    return {
      path: data.path,
      success: true
    };
  } catch (error: any) {
    console.error('관리자 권한 업로드 중 예외:', error);
    return {
      path: '',
      success: false,
      error: error.message
    };
  }
}

/**
 * Supabase Storage 버킷에서 파일의 공개 URL을 생성합니다.
 * @param bucket 파일이 저장된 버킷 이름
 * @param path 버킷 내 파일 경로
 * @returns 파일의 공개 액세스 URL
 */
export function getPublicUrl(bucket: string, path: string): string {
  if (!bucket || !path) {
    console.warn('getPublicUrl: 버킷 또는 경로가 제공되지 않았습니다', { bucket, path });
    return '';
  }
  
  try {
    // 더미 경로인 경우 대체 URL 반환
    if (path.includes('dummy/path')) {
      return 'https://placehold.co/400x400?text=Avatar';
    }
    
    // Supabase 클라이언트를 통해 공개 URL 가져오기
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    
    if (data?.publicUrl) {
      return data.publicUrl;
    }
    
    // 백업: URL 수동 구성
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    
    return publicUrl;
  } catch (error) {
    console.error('공개 URL 생성 중 오류 발생:', error);
    // 실패시 수동 URL 생성
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }
}

// 사용자 역할 정의
export enum UserRole {
  SUPER = 'SUPER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEAM_LEADER = 'TEAM_LEADER',
  MEMBER = 'MEMBER'
}

// 역할에 따른 권한 체크 함수
export const checkPermission = async (
  currentUserId: string, 
  targetUserId: string
): Promise<boolean> => {
  try {
    // 자기 자신의 데이터는 항상 볼 수 있음
    if (currentUserId === targetUserId) {
      return true;
    }

    // 현재 사용자 정보 가져오기
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error('현재 사용자 정보를 가져오는 중 오류 발생:', currentUserError);
      return false;
    }

    // SUPER와 ADMIN은 모든 데이터에 접근 가능
    if (currentUser.role === UserRole.SUPER || currentUser.role === UserRole.ADMIN) {
      return true;
    }

    // 대상 사용자 정보 가져오기
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      console.error('대상 사용자 정보를 가져오는 중 오류 발생:', targetUserError);
      return false;
    }

    // MANAGER인 경우 같은 부서에 속한 모든 사용자(팀장, 팀원)에 접근 가능
    if (currentUser.role === UserRole.MANAGER) {
      return currentUser.department_id === targetUser.department_id;
    }

    // TEAM_LEADER인 경우 같은 팀에 속한 사용자만 접근 가능
    if (currentUser.role === UserRole.TEAM_LEADER) {
      return currentUser.team_id === targetUser.team_id;
    }

    // MEMBER는 자신의 데이터만 볼 수 있음(이미 위에서 체크됨)
    return false;
  } catch (error) {
    console.error('권한 체크 중 오류 발생:', error);
    return false;
  }
};

// 특정 사용자의 주간 업무 리스트를 가져오는 함수
export const getUsersWithWeeklyTasks = async (currentUserId: string): Promise<any[]> => {
  try {
    // 현재 사용자 정보 조회
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error('사용자 정보를 가져오는 중 오류 발생:', currentUserError);
      return [];
    }

    let query = supabase.from('users').select('*');

    // 권한에 따른 필터링
    if (currentUser.role === UserRole.SUPER || currentUser.role === UserRole.ADMIN) {
      // 모든 사용자 조회 (필터링 없음)
    } else if (currentUser.role === UserRole.MANAGER) {
      // 같은 부서에 속한 모든 사용자(팀장, 팀원) 조회
      query = query.eq('department_id', currentUser.department_id);
    } else if (currentUser.role === UserRole.TEAM_LEADER) {
      // 같은 팀에 속한 사용자만 조회
      query = query.eq('team_id', currentUser.team_id);
    } else {
      // MEMBER는 자신만 조회
      query = query.eq('id', currentUserId);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('사용자 목록을 가져오는 중 오류 발생:', usersError);
      return [];
    }

    return users || [];
  } catch (error) {
    console.error('사용자 정보 조회 중 오류 발생:', error);
    return [];
  }
};

/**
 * 사용자가 새 이미지를 업로드하기 전에 호출하여 스토리지 정리 용도로 사용
 * @param bucket 버킷 이름
 * @param userId 사용자 ID
 * @returns 삭제 성공 여부
 */
export async function deleteOldProfileImages(bucket: string, userId: string): Promise<boolean> {
  try {
    // 먼저 일반 클라이언트로 시도
    let result = await tryDeleteImages(supabase, bucket, userId);
    
    // 실패했고 관리자 클라이언트가 있으면 관리자 권한으로 시도
    if (!result.success && adminSupabase) {
      console.log('일반 권한으로 이미지 삭제 실패, 관리자 권한으로 시도합니다...');
      result = await tryDeleteImages(adminSupabase, bucket, userId);
    }
    
    return result.success;
  } catch (error) {
    console.error('이전 프로필 이미지 삭제 중 오류:', error);
    return false;
  }
}

/**
 * 지정된 클라이언트로 이미지 삭제를 시도하는 내부 함수
 * @private
 */
async function tryDeleteImages(client: any, bucket: string, userId: string): Promise<{success: boolean; error?: any}> {
  try {
    // 사용자 폴더 내 파일 목록 가져오기
    const { data, error } = await client
      .storage
      .from(bucket)
      .list(`${userId}`, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      console.error('사용자 이미지 목록 조회 실패:', error);
      return { success: false, error };
    }
    
    if (!data || data.length === 0) {
      return { success: true };
    }
    
    // 현재 profile.* 파일을 제외한 이전 파일들 찾기
    const oldImages = data.filter((file: any) => 
      !file.name.startsWith('profile.') && 
      (file.name.includes('profile_') || file.name.startsWith('profile_image_'))
    );
    
    if (oldImages.length === 0) {
      return { success: true };
    }
    
    // 이전 이미지 삭제
    const filePaths = oldImages.map((file: any) => `${userId}/${file.name}`);
    
    const { error: deleteError } = await client
      .storage
      .from(bucket)
      .remove(filePaths);
    
    if (deleteError) {
      console.error(`이미지 삭제 실패:`, deleteError);
      return { success: false, error: deleteError };
    }
    
    return { success: true };
  } catch (error) {
    console.error('이미지 삭제 중 예외 발생:', error);
    return { success: false, error };
  }
}

// 특정 팀의 세부 정보를 가져오는 함수
export async function getTeamDetails(teamId: string) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) {
      console.error('팀 세부 정보 조회 중 오류:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getTeamDetails 오류:', error);
    return null;
  }
}

// 모든 팀 정보 가져오기
export async function getAllTeams() {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) {
      console.error('팀 목록 조회 중 오류:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('getAllTeams 오류:', error);
    return [];
  }
}

/**
 * 사용자 회원가입 함수 - 이미 등록된 이메일인 경우 에러를 반환
 * @param email 이메일
 * @param password 비밀번호
 * @param fullName 사용자 이름
 * @returns 회원가입 결과
 */
export async function signUp(email: string, password: string, fullName: string) {
  try {
    // Supabase 대시보드에서 설정한 URL 사용
    console.log('회원가입 시작:', { email });
    
    // 이메일 도메인 검증 (timbel.net만 허용)
    if (!email.toLowerCase().endsWith('@timbel.net')) {
      console.error('허용되지 않은 이메일 도메인:', email);
      return { 
        success: false, 
        error: new Error('timbel.net 도메인의 이메일만 가입할 수 있습니다.')
      };
    }
    
    // 환경 변수에서 URL 가져오기
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const redirectUrl = process.env.NEXT_PUBLIC_REDIRECT_URL || '';
    
    const finalRedirectUrl = redirectUrl || `${siteUrl}/auth/callback` || 'http://localhost:3000/auth/callback';
    
    console.log('회원가입 리디렉션 URL:', finalRedirectUrl);
    
    // 사이트 URL 설정
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        },
        emailRedirectTo: finalRedirectUrl
      }
    });
    
    console.log('회원가입 응답:', { 
      success: !error, 
      hasUser: !!data?.user,
      emailConfirmed: data?.user?.email_confirmed_at,
      identities: data?.user?.identities
    });
    
    if (error) {
      console.error('회원가입 오류 세부정보:', error);
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    console.error('회원가입 오류:', error);
    return { success: false, error };
  }
}

// 비밀번호 재설정 이메일 발송 함수 수정
export async function resetPassword(email: string) {
  try {
    console.log('비밀번호 재설정 요청:', { email });
    
    // 타입 호환성 문제로 인해 옵션 제거
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    
    console.log('비밀번호 재설정 응답:', { success: !error });
    
    if (error) {
      console.error('비밀번호 재설정 오류 세부정보:', error);
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    return { success: false, error };
  }
}

/**
 * 특정 주간 업무에 대한 메모 작성
 */
export async function createTaskNote(
  weeklyTaskId: string,
  recipientId: string,
  content: string,
  parentNoteId?: string
): Promise<any> {
  try {
    // 현재 사용자 가져오기
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('인증된 사용자만 메모를 작성할 수 있습니다.');
    }

    // 디버깅 로그 추가
    console.log('메모 작성 요청 데이터:', {
      weeklyTaskId,
      recipientId,
      userId: user.id,
      hasParentNote: !!parentNoteId,
      parentNoteId: parentNoteId || '없음'
    });
    
    // 현재 사용자의 세부 정보 가져오기
    let userDetails = null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, department_id, team_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('사용자 세부 정보 조회 실패:', error);
      } else {
        userDetails = data;
      }
    } catch (err) {
      console.error('사용자 세부 정보 조회 중 오류:', err);
    }
    
    // 자기 자신에게 메모를 보내는 것 방지 (단, 답변 중일 때는 예외 처리)
    // 또는 권한이 있는 사용자(팀장 이상)일 경우에도 예외 처리
    const isManager = userDetails?.role === 'MANAGER' || 
                      userDetails?.role === 'TEAM_LEADER' || 
                      userDetails?.role === 'ADMIN' || 
                      userDetails?.role === 'SUPER';
                      
    if (user.id === recipientId && !parentNoteId && !isManager) {
      throw new Error('자기 자신에게 메모를 보낼 수 없습니다.');
    }

    // 그 외 로직은 그대로 유지
    // 답변인 경우 (parentNoteId가 있는 경우) 추가 검증
    if (parentNoteId) {
      try {
        // 부모 메모의 정보 가져오기
        const { data: parentNote, error: parentError } = await supabase
          .from('weekly_task_notes')
          .select('recipient_id, sender_id')
          .eq('id', parentNoteId)
          .single();

        if (parentError || !parentNote) {
          console.error('부모 메모 조회 실패:', parentError);
          throw new Error('상위 메모를 찾을 수 없습니다.');
        }

        console.log('부모 메모 정보:', {
          parentSenderId: parentNote.sender_id,
          parentRecipientId: parentNote.recipient_id,
          currentUserId: user.id
        });

        // 상위 메모의 수신자가 현재 사용자인지 확인
        if (parentNote.recipient_id !== user.id) {
          throw new Error('본인에게 온 메모에만 답변할 수 있습니다.');
        }
        
        // 원래 메모의 발신자를 수신자로 설정 (recipientId 무시)
        recipientId = parentNote.sender_id;
        console.log('답변 메모의 수신자 재설정:', recipientId);
      } catch (err) {
        console.error('부모 메모 확인 중 오류:', err);
        throw err;
      }
    }
    // MEMBER 역할 검증 로직은 유지하되, 이미 위에서 처리한 답변 로직은 중복 실행 방지
    else if (userDetails?.role === 'MEMBER') {
      try {
        // 팀원이 새 메모를 작성하려는 경우, 주간 업무의 소유자를 확인
        // 주간 업무 데이터 조회
        const { data: weeklyTask, error: weeklyTaskError } = await supabase
          .from('weekly_tasks')
          .select('*')  // 모든 필드 조회로 변경
          .eq('id', weeklyTaskId)
          .single();

        if (weeklyTaskError) {
          console.error('주간 업무 조회 실패:', weeklyTaskError);
          throw new Error('주간 업무 정보를 찾을 수 없습니다.');
        }

        if (!weeklyTask) {
          throw new Error('주간 업무 데이터가 없습니다.');
        }

        console.log('주간 업무 데이터:', weeklyTask);
        
        // 소유자 ID를 결정하는 필드 찾기
        let ownerId: string | null = null;
        
        // 가능한 필드명들을 순서대로 확인
        if (weeklyTask.hasOwnProperty('user_id') && weeklyTask.user_id) {
          ownerId = weeklyTask.user_id;
        } else if (weeklyTask.hasOwnProperty('owner_id') && weeklyTask.owner_id) {
          ownerId = weeklyTask.owner_id;
        } else {
          // 사용 가능한 필드 출력
          console.error('사용 가능한 필드:', Object.keys(weeklyTask));
          throw new Error('주간 업무의 소유자 정보를 찾을 수 없습니다.');
        }
        
        // 팀원은 자신의 주간 업무에 대한 메모만 작성 가능
        if (ownerId !== user.id) {
          throw new Error('자신의 주간 업무에 대한 메모만 작성할 수 있습니다.');
        }
      } catch (err) {
        console.error('주간 업무 확인 중 오류:', err);
        throw err;
      }
    }

    // 메모 생성
    try {
      const { data, error } = await supabase
        .from('weekly_task_notes')
        .insert({
          weekly_task_id: weeklyTaskId,
          sender_id: user.id,
          recipient_id: recipientId,
          content,
          parent_note_id: parentNoteId || null,
          status: 'pending'
        })
        .select('*');

      if (error) {
        console.error('메모 작성 중 DB 오류 발생:', error);
        throw error;
      }

      console.log('메모 작성 성공:', data[0]?.id);
      return data[0];
    } catch (insertError) {
      console.error('메모 삽입 중 예외 발생:', insertError);
      throw insertError;
    }
  } catch (error) {
    console.error('메모 작성 중 예외 발생:', error);
    throw error;
  }
}

/**
 * 특정 주간 업무의 메모 목록 가져오기
 * @param weeklyTaskId 주간 업무 ID
 * @param taskOwnerId (옵션) 주간 업무 소유자 ID
 * @returns 메모 목록
 */
export async function getTaskNotes(weeklyTaskId: string, taskOwnerId?: string): Promise<any[]> {
  try {
    // 현재 로그인한 사용자를 가져옵니다.
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('사용자 정보를 가져올 수 없습니다.');
      return [];
    }
    
    console.log('메모 조회 시작:', { 
      weeklyTaskId, 
      currentUserId: currentUser.id,
      taskOwnerId: taskOwnerId || '미지정'
    });

    // 기본 쿼리
    let query = supabase
      .from('weekly_task_notes')
      .select(`
        *,
        sender:sender_id(id, full_name, avatar_url, role),
        recipient:recipient_id(id, full_name, avatar_url, role),
        parent_note:parent_note_id(id, content)
      `)
      .eq('weekly_task_id', weeklyTaskId)
      .order('created_at', { ascending: true });

    // 검색 결과 가져오기
    const { data, error } = await query;

    if (error) {
      console.error('메모 목록 조회 중 오류 발생:', error);
      console.log('에러 상세 정보:', JSON.stringify(error));
      return [];
    }

    console.log(`메모 조회 결과: ${data?.length || 0}개 메모 찾음`, {
      weeklyTaskId, 
      userId: currentUser.id,
      senderIds: data?.map(item => item.sender_id) || [],
      recipientIds: data?.map(item => item.recipient_id) || []
    });
    
    return data || [];
  } catch (error) {
    console.error('메모 목록 조회 중 예외 발생:', error);
    return [];
  }
}

/**
 * 사용자에게 온 모든 메모 가져오기
 */
export async function getUserNotes(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('weekly_task_notes')
      .select(`
        *,
        sender:sender_id(id, full_name, avatar_url, role),
        weekly_task:weekly_task_id(*)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('사용자 메모 목록 조회 중 오류 발생:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('사용자 메모 목록 조회 중 예외 발생:', error);
    return [];
  }
}

/**
 * 메모 읽음 상태 업데이트
 */
export async function markNoteAsRead(noteId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('weekly_task_notes')
      .update({ 
        is_read: true,
        status: 'read',
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (error) {
      console.error('메모 읽음 상태 업데이트 중 오류 발생:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('메모 읽음 상태 업데이트 중 예외 발생:', error);
    return false;
  }
}

/**
 * 메모 상태 업데이트 (예: 해결됨 표시)
 */
export async function updateNoteStatus(noteId: string, status: 'pending' | 'read' | 'replied' | 'resolved'): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('weekly_task_notes')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (error) {
      console.error('메모 상태 업데이트 중 오류 발생:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('메모 상태 업데이트 중 예외 발생:', error);
    return false;
  }
}

/**
 * 사용자의 주간 업무별 메모 개수 가져오기
 * @param userId 사용자 ID
 * @param year 연도
 * @returns 주차별 메모 개수 {weekNum: {total, unread}}
 */
export async function getWeeklyTaskNoteCounts(userId: string, year: number): Promise<Record<number, {total: number, unread: number, hasUnresolved: boolean}>> {
  try {
    console.log('주간 메모 개수 로드 시작:', { userId, year });
    
    // 사용자의 주간 업무 목록 가져오기
    const { data: weeklyTasks, error: tasksError } = await supabase
      .from('weekly_tasks')
      .select('id, week_number')
      .eq('user_id', userId)
      .eq('year', year);
    
    if (tasksError) {
      console.error('주간 업무 조회 오류:', tasksError);
      return {};
    }
    
    console.log(`사용자 주간 업무 ${weeklyTasks?.length || 0}개 로드됨`);
    
    // 로그인한 사용자 정보 가져오기
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('사용자 정보를 가져올 수 없습니다.');
      return {};
    }
    
    const results: Record<number, {total: number, unread: number, hasUnresolved: boolean}> = {};
    
    // 각 주간 업무별로 메모 개수 계산
    await Promise.all(weeklyTasks?.map(async (task) => {
      try {
        // 전체 메모 개수
        const { count: totalCount, error: totalError } = await supabase
          .from('weekly_task_notes')
          .select('id', { count: 'exact', head: true })
          .eq('weekly_task_id', task.id);
        
        // 읽지 않은 메모 개수 (수신자가 현재 사용자인 경우만)
        const { count: unreadCount, error: unreadError } = await supabase
          .from('weekly_task_notes')
          .select('id', { count: 'exact', head: true })
          .eq('weekly_task_id', task.id)
          .eq('recipient_id', currentUser.id)
          .eq('is_read', false);
        
        // 미해결 메모 개수 (status가 'pending'인 메모)
        const { count: unresolvedCount, error: unresolvedError } = await supabase
          .from('weekly_task_notes')
          .select('id', { count: 'exact', head: true })
          .eq('weekly_task_id', task.id)
          .eq('status', 'pending');
        
        if (totalError) {
          console.error(`주차 ${task.week_number}의 메모 개수 조회 오류:`, totalError);
        } else if (totalCount && totalCount > 0) {
          // 결과 저장 (메모가 있는 경우만)
          results[task.week_number] = {
            total: totalCount || 0,
            unread: unreadError ? 0 : (unreadCount || 0),
            hasUnresolved: unresolvedError ? false : (unresolvedCount || 0) > 0
          };
          
          console.log(`주차 ${task.week_number} 메모 개수:`, results[task.week_number]);
        }
      } catch (error) {
        console.error(`주차 ${task.week_number}의 메모 개수 계산 중 오류 발생:`, error);
      }
    }) || []);
    
    return results;
  } catch (error) {
    console.error('주간 업무 메모 개수 조회 중 오류 발생:', error);
    return {};
  }
}

/**
 * 주간 업무 메모에 대한 실시간 구독 설정
 * @param weeklyTaskId 주간 업무 ID
 * @param callbackFn 변경 사항 발생 시 호출할 콜백 함수
 * @returns 구독 취소 함수
 */
export function subscribeToTaskNotes(
  weeklyTaskId: string,
  callbackFn: (payload: any) => void
) {
  console.log('메모 실시간 구독 시작:', weeklyTaskId);
  
  try {
    // 실시간 구독 설정 - 간소화된 버전
    const channel = supabase
      .channel(`task-notes-${weeklyTaskId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모든 이벤트 수신
          schema: 'public',
          table: 'weekly_task_notes',
          filter: `weekly_task_id=eq.${weeklyTaskId}`
        },
        (payload) => {
          try {
            console.log('메모 변경 감지:', payload);
            callbackFn(payload);
          } catch (error) {
            console.error('메모 변경 콜백 중 오류:', error);
          }
        }
      )
      .subscribe();
    
    // 구독 취소 함수 반환
    return () => {
      console.log('메모 실시간 구독 취소:', weeklyTaskId);
      try {
        channel.unsubscribe();
      } catch (error) {
        console.error('메모 구독 취소 중 오류:', error);
      }
    };
  } catch (error) {
    console.error('메모 구독 설정 중 오류:', error);
    return () => {}; // 빈 함수 반환
  }
}

/**
 * 사용자의 모든 주간 업무 메모에 대한 실시간 구독 설정
 * @param userId 사용자 ID
 * @param callbackFn 변경 사항 발생 시 호출할 콜백 함수
 * @returns 구독 취소 함수
 */
export function subscribeToUserNotes(
  userId: string,
  callbackFn: (payload: any) => void
) {
  console.log('사용자 메모 실시간 구독 시작:', userId);
  
  try {
    // 수신자 기준 구독 설정
    const recipientChannel = supabase
      .channel(`user-notes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_task_notes',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          try {
            console.log('사용자 메모 변경 감지(수신자):', payload);
            callbackFn(payload);
          } catch (error) {
            console.error('사용자 메모 변경 콜백 중 오류:', error);
          }
        }
      )
      .subscribe();
    
    // 발신자 기준 구독 설정
    const senderChannel = supabase
      .channel(`sender-notes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_task_notes',
          filter: `sender_id=eq.${userId}`
        },
        (payload) => {
          try {
            console.log('사용자 메모 변경 감지(발신자):', payload);
            callbackFn(payload);
          } catch (error) {
            console.error('사용자 메모 변경 콜백 중 오류:', error);
          }
        }
      )
      .subscribe();
    
    // 구독 취소 함수 반환
    return () => {
      console.log('사용자 메모 실시간 구독 취소:', userId);
      try {
        recipientChannel.unsubscribe();
        senderChannel.unsubscribe();
      } catch (error) {
        console.error('사용자 메모 구독 취소 중 오류:', error);
      }
    };
  } catch (error) {
    console.error('사용자 메모 구독 설정 중 오류:', error);
    return () => {}; // 빈 함수 반환
  }
}

// 모든 사용자의 정보를 가져오는 함수 (관리자용)
export async function getAllUsers() {
  try {
    console.log('getAllUsers 함수 호출됨');
    
    // 현재 사용자 권한 체크
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('사용자 정보를 찾을 수 없습니다.');
      return { success: false, error: '로그인이 필요합니다.' };
    }
    
    console.log('현재 로그인된 사용자:', currentUser);
    
    // 현재 사용자의 상세 정보 가져오기
    const { data: currentUserDetails, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();
      
    if (userError || !currentUserDetails) {
      console.error('사용자 권한 확인 중 오류:', userError);
      return { success: false, error: '사용자 정보를 확인할 수 없습니다.' };
    }
    
    console.log('현재 사용자 권한:', currentUserDetails.role);
    
    // SUPER 유저인지 확인
    if (currentUserDetails.role !== 'SUPER') {
      console.error('권한 부족:', currentUserDetails.role);
      return { success: false, error: '이 기능을 사용할 권한이 없습니다.' };
    }
    
    console.log('관리자 권한 확인 완료. 사용자 목록 조회 시작...');
    
    // 모든 사용자 정보 가져오기 - foreign key 관계를 정확하게 가져오기
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        *,
        departments:department_id(id, name),
        teams:team_id(id, name, department_id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('사용자 목록 조회 중 오류:', error);
      return { success: false, error: '사용자 목록을 가져오는 중 오류가 발생했습니다.' };
    }
    
    console.log(`${users.length}명의 사용자 정보 조회 완료`);
    
    // 추가 정보 로깅
    for (const user of users) {
      console.log(`사용자 ${user.id} - 부서: ${user.department_id || '없음'}, 팀: ${user.team_id || '없음'}, 권한: ${user.role}`);
    }
    
    return { success: true, data: users };
  } catch (error) {
    console.error('getAllUsers 오류:', error);
    return { success: false, error: '사용자 목록 조회 중 예외가 발생했습니다.' };
  }
}

// 사용자 정보 업데이트 함수 (관리자용) - 단순화 버전
export async function updateUserBySuperAdmin(
  userId: string,
  data: {
    department_id?: string | null;
    team_id?: string | null;
    role?: UserRole;
  }
) {
  try {
    console.log(`사용자 ${userId} 정보 업데이트 시작:`, data);
    
    // 업데이트 데이터에 타임스탬프 추가
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };
    
    // 1. 현재 사용자 확인 (SUPER 권한 체크)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { 
        success: false, 
        error: '로그인이 필요합니다.' 
      };
    }
    
    // 현재 사용자의 권한 확인
    const { data: currentUserDetails, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();
      
    if (userError || !currentUserDetails) {
      console.error('사용자 권한 확인 중 오류:', userError);
      return { 
        success: false, 
        error: '사용자 정보를 확인할 수 없습니다.' 
      };
    }
    
    // SUPER 권한이 없는 경우 실패 처리
    if (currentUserDetails.role !== 'SUPER') {
      console.error('권한 부족:', currentUserDetails.role);
      return { 
        success: false, 
        error: '이 기능을 사용할 권한이 없습니다.' 
      };
    }
    
    // 2. 업데이트 전 현재 사용자 상태 확인
    const { data: beforeUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (!beforeUser) {
      return {
        success: false,
        error: '업데이트할 사용자를 찾을 수 없습니다.'
      };
    }
    
    console.log('업데이트 전 사용자 상태:', beforeUser);
    
    // 3. 서비스 롤 키를 사용하는 관리자 클라이언트가 있는 경우 사용 (RLS 우회)
    if (adminSupabase) {
      console.log('관리자 클라이언트로 업데이트 시도 (RLS 우회)');
      const { data: updatedData, error: updateError } = await adminSupabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select();
      
      if (updateError) {
        console.error('관리자 권한 업데이트 오류:', updateError);
        return { 
          success: false, 
          error: `업데이트 실패: ${updateError.message}` 
        };
      }
      
      const updatedUser = updatedData?.[0];
      
      if (!updatedUser) {
        return {
          success: false,
          error: '업데이트 후 사용자 정보를 찾을 수 없습니다.'
        };
      }
      
      console.log('업데이트 후 사용자 상태 (관리자 클라이언트):', updatedUser);
      
      // 실제로 데이터가 변경되었는지 확인
      let changed = false;
      if (data.department_id !== undefined && beforeUser.department_id !== updatedUser.department_id) changed = true;
      if (data.team_id !== undefined && beforeUser.team_id !== updatedUser.team_id) changed = true;
      if (data.role !== undefined && beforeUser.role !== updatedUser.role) changed = true;
      
      return { 
        success: true, 
        data: updatedUser,
        changed: changed
      };
    } else {
      // 서비스 롤 키가 없는 경우 일반 클라이언트 사용 (RLS 제약 받음)
      console.warn('서비스 롤 키가 없어 일반 클라이언트로 업데이트를 시도합니다 (RLS 제약 있음)');
      
      // 직접 업데이트 실행
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);
      
      if (updateError) {
        console.error('업데이트 오류:', updateError);
        
        // RLS 정책 오류 감지
        if (updateError.message.includes('permission denied') || 
            updateError.message.includes('row level security') ||
            updateError.message.includes('new row violates')) {
          return { 
            success: false, 
            error: 'RLS 정책으로 인해 업데이트가 거부되었습니다. 서비스 롤 키를 설정하거나 RLS 정책을 수정하세요.' 
          };
        }
        
        return { 
          success: false, 
          error: `업데이트 실패: ${updateError.message}` 
        };
      }
      
      // 업데이트 후 최종 사용자 상태 확인
      const { data: updatedUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (fetchError || !updatedUser) {
        console.error('업데이트 후 사용자 조회 오류:', fetchError);
        return { 
          success: false, 
          error: '업데이트는 됐을 수 있으나 결과를 확인할 수 없습니다.' 
        };
      }
      
      console.log('업데이트 후 사용자 상태:', updatedUser);
      
      // 실제로 데이터가 변경되었는지 확인
      let changed = false;
      if (data.department_id !== undefined && beforeUser.department_id !== updatedUser.department_id) changed = true;
      if (data.team_id !== undefined && beforeUser.team_id !== updatedUser.team_id) changed = true;
      if (data.role !== undefined && beforeUser.role !== updatedUser.role) changed = true;
      
      return { 
        success: true, 
        data: updatedUser,
        changed: changed
      };
    }
  } catch (error: any) {
    console.error('updateUserBySuperAdmin 예외 발생:', error);
    return { success: false, error: error.message || '알 수 없는 오류' };
  }
} 