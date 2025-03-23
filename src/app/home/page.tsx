import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export default function Home() {
  // 홈페이지로 리디렉션
  redirect('/');
} 