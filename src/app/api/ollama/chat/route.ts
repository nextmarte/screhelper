import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_API_URL = 'http://127.0.0.1:8566';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${OLLAMA_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling Ollama chat API:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Ollama API' },
      { status: 500 }
    );
  }
}
