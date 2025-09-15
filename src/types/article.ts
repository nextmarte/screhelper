import { ClassifyArticleOutput } from '@/ai/flows/classify-article';

export interface Article {
  title: string;
  abstract: string;
  doi?: string;
  source?: string;
}

export interface ClassifiedArticle extends Article {
  classification: ClassifyArticleOutput;
  originalData?: Record<string, any>; // Preserva dados originais do arquivo importado
}
