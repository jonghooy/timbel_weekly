import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/supabase';

export async function GET() {
  try {
    // Next.js 최신 버전에서는 cookies()를 직접 전달하는 대신 쿠키 객체를 생성하여 전달
    const cookieStore = cookies();
    
    // 서버 컴포넌트에서 supabase 클라이언트 생성
    const supabase = createServerComponentClient<Database>({ 
      cookies: () => cookieStore 
    });
    
    // 현재 세션 가져오기
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('세션 오류 또는 세션 없음:', sessionError);
      return NextResponse.json(
        { error: '인증된 세션이 없습니다.' }, 
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // users 테이블에서 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('사용자 정보 조회 오류:', userError);
      return NextResponse.json(
        { error: '사용자 정보를 조회할 수 없습니다.' }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(userData);
  } catch (error) {
    console.error('서버 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
} 