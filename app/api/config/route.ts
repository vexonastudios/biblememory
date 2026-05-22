import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.ELEVENLABS_API_KEY,
  });
}
export const dynamic = 'force-dynamic';
