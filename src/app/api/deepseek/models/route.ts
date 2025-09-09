import { NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

interface DeepSeekModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// Lista de modelos DeepSeek disponíveis (atualizada com os modelos mais recentes)
const DEEPSEEK_MODELS = [
  {
    id: 'deepseek-chat',
    object: 'model',
    created: 1677610602,
    owned_by: 'deepseek',
    name: 'DeepSeek Chat',
    description: 'DeepSeek\'s most capable model for general conversations and reasoning',
    max_tokens: 32768,
    input_cost_per_million: 0.14,
    output_cost_per_million: 0.28
  },
  {
    id: 'deepseek-coder',
    object: 'model',
    created: 1677610602,
    owned_by: 'deepseek',
    name: 'DeepSeek Coder',
    description: 'Specialized model for code generation and programming tasks',
    max_tokens: 16384,
    input_cost_per_million: 0.14,
    output_cost_per_million: 0.28
  },
  {
    id: 'deepseek-reasoner',
    object: 'model',
    created: 1677610602,
    owned_by: 'deepseek',
    name: 'DeepSeek Reasoner',
    description: 'Advanced reasoning model with chain-of-thought capabilities',
    max_tokens: 32768,
    input_cost_per_million: 2.19,
    output_cost_per_million: 8.76
  }
];

export async function GET() {
  try {
    // Verificar se a API key está configurada
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'DeepSeek API key not configured', 
          message: 'Please set DEEPSEEK_API_KEY environment variable',
          models: [] 
        },
        { status: 200 } // Retornar 200 mas com lista vazia para não quebrar o frontend
      );
    }

    try {
      // Tentar buscar modelos da API real
      const response = await fetch(`${DEEPSEEK_API_URL}/models`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ 
          models: data.data || DEEPSEEK_MODELS,
          source: 'api'
        });
      }
    } catch (apiError) {
      console.log('API fetch failed, using fallback models:', apiError);
    }

    // Fallback para lista estática de modelos
    return NextResponse.json({ 
      models: DEEPSEEK_MODELS,
      source: 'static',
      message: 'Using static model list. API connection may be limited.'
    });

  } catch (error) {
    console.error('Error fetching DeepSeek models:', error);
    
    // Mesmo em caso de erro, retornar a lista estática
    return NextResponse.json({ 
      models: DEEPSEEK_MODELS,
      source: 'fallback',
      error: 'API unavailable, using fallback models'
    });
  }
}
