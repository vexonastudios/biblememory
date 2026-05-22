import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');
  const apiKeyToUse = apiKey || process.env.ELEVENLABS_API_KEY;

  if (!apiKeyToUse) {
    return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKeyToUse },
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) {
      return NextResponse.json({ error: `ElevenLabs voices error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    // Return a simplified list
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.labels?.description || '',
      gender: v.labels?.gender || '',
      accent: v.labels?.accent || '',
      age: v.labels?.age || '',
      use_case: v.labels?.use_case || '',
    }));

    return NextResponse.json({ voices });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
