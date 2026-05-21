import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, voiceId, apiKey } = body;

  if (!text || !voiceId || !apiKey) {
    return NextResponse.json({ error: 'Missing text, voiceId, or apiKey' }, { status: 400 });
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.60,
          similarity_boost: 0.85,
          style: 0.20,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('ElevenLabs error:', res.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs error ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    console.error('TTS fetch error:', e);
    return NextResponse.json({ error: e.message || 'TTS request failed' }, { status: 500 });
  }
}
