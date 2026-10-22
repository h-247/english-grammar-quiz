import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET() {
  const user = await getAuthenticatedUserOrLocal();
  return NextResponse.json(user);
}
