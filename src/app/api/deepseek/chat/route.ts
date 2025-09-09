import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, message } = body;

    // Verificar se a API key está configurada
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DeepSeek API key not configured. Please set DEEPSEEK_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Preparar a mensagem para a API do DeepSeek
    const deepSeekRequest: DeepSeekRequest = {
      model: model,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.1, // Baixa temperatura para respostas mais consistentes
      max_tokens: 1000,
      top_p: 0.95
    };

    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(deepSeekRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: `DeepSeek API error: ${response.status} ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data: DeepSeekResponse = await response.json();
    
    // Adaptar a resposta para o formato esperado pelo frontend
    const adaptedResponse = {
      role: 'assistant',
      content: data.choices[0]?.message?.content || '',
      thinking: null,
      images: null,
      tool_name: null,
      tool_calls: null,
      usage: data.usage
    };

    return NextResponse.json(adaptedResponse);
  } catch (error) {
    console.error('Error calling DeepSeek chat API:', error);
    return NextResponse.json(
      { error: 'Failed to connect to DeepSeek API' },
      { status: 500 }
    );
  }
}
