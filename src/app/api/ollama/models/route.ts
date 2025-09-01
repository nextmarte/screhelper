import { NextResponse } from 'next/server';

const OLLAMA_API_URL = 'http://127.0.0.1:8566';

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/models`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Filtrar apenas modelos apropriados para classificação de texto
    const textModels = (data.models || []).filter((model: any) => {
      const isEmbedding = model.model.toLowerCase().includes('embed') || 
                         model.details?.family?.toLowerCase() === 'nomic-bert';
      return !isEmbedding;
    });

    return NextResponse.json({ models: textModels });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Ollama API' },
      { status: 500 }
    );
  }
}
