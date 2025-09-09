'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';

import { classifyArticle, ClassifyArticleOutput } from '@/ai/flows/classify-article';
import { sampleArticles, type Article } from '@/lib/data';
import { exportToXlsx } from '@/lib/csv';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, XCircle, FlaskConical, FileDown, TestTube2, BrainCircuit, Upload, Ban, RotateCcw, Settings, ChevronDown, ChevronUp, Filter, RefreshCw, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const criteriaSchema = z.object({
  inclusionCriteria: z.array(z.object({ value: z.string().min(1, 'Criterion cannot be empty.') })).min(1, 'At least one inclusion criterion is required.'),
  exclusionCriteria: z.array(z.object({ value: z.string().min(1, 'Criterion cannot be empty.') })).min(1, 'At least one exclusion criterion is required.'),
});

type CriteriaFormValues = z.infer<typeof criteriaSchema>;

interface ClassifiedArticle extends Article {
  classification: ClassifyArticleOutput;
  originalData?: Record<string, any>; // Adicionar para preservar dados originais
}

type AIProvider = 'gemini' | 'ollama' | 'deepseek';

const GEMINI_MODELS = [
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
] as const;

const DEEPSEEK_MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat', description: 'Modelo principal para conversas e raciocínio' },
  { value: 'deepseek-coder', label: 'DeepSeek Coder', description: 'Especializado em geração de código' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Modelo avançado com capacidades de raciocínio' },
] as const;

type GeminiModel = typeof GEMINI_MODELS[number]['value'];
type DeepSeekModel = typeof DEEPSEEK_MODELS[number]['value'];

interface OllamaModel {
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

interface DeepSeekModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  name?: string;
  description?: string;
  max_tokens?: number;
  input_cost_per_million?: number;
  output_cost_per_million?: number;
}

interface OllamaResponse {
  role: string;
  content: string;
  thinking: string | null;
  images: any[] | null;
  tool_name: string | null;
  tool_calls: any[] | null;
}

interface DeepSeekResponse {
  role: string;
  content: string;
  thinking: string | null;
  images: any[] | null;
  tool_name: string | null;
  tool_calls: any[] | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const CONCURRENT_REQUESTS = 2; // Reduzindo requisições simultâneas para evitar sobrecarga
const OLLAMA_PROXY_URL = '/api/ollama'; // Mudando para usar o proxy
const DEEPSEEK_PROXY_URL = '/api/deepseek'; // URL do proxy para DeepSeek

async function classifyWithOllama(
  article: { title: string; abstract: string },
  criteria: { inclusion: string[]; exclusion: string[] },
  model: string
): Promise<ClassifyArticleOutput> {
  const prompt = `
Você é um assistente especializado em revisão sistemática de literatura científica. Sua tarefa é classificar artigos científicos com base em critérios de inclusão e exclusão específicos.

REGRAS IMPORTANTES:
- INCLUIR artigos apenas quando atendem aos CRITÉRIOS DE INCLUSÃO
- EXCLUIR artigos quando violam qualquer CRITÉRIO DE EXCLUSÃO
- Um artigo deve atender algum dos critérios de inclusão E NÃO violar NENHUM critério de exclusão para ser incluído

CRITÉRIOS DE INCLUSÃO :
${criteria.inclusion.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CRITÉRIOS DE EXCLUSÃO (o artigo será excluído se atender a qualquer um):
${criteria.exclusion.map((c, i) => `${i + 1}. ${c}`).join('\n')}

ARTIGO PARA ANÁLISE:
Título: ${article.title}
Resumo: ${article.abstract}

PROCESSO DE DECISÃO:
1. Verifique se o artigo atende a algum dos critérios de inclusão
2. Verifique se o artigo viola ALGUM critério de exclusão
3. INCLUA apenas se atende a um dos critérios de inclusão E não viola nenhum critério de exclusão
4. EXCLUA se não atende algum critério de inclusão OU viola algum critério de exclusão

IMPORTANTE: Se include=true, cite um critério de INCLUSÃO. Se include=false, cite o critério de EXCLUSÃO violado.

Responda APENAS no seguinte formato JSON válido:
{
  "include": true/false,
  "reason": "Explicação clara da decisão baseada nos critérios",
  "criterion": "Texto do critério específico que determinou a decisão"
}
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // Aumentando para 2 minutos
    
    console.log(`Starting classification for article: ${article.title.substring(0, 50)}...`);
    const startTime = Date.now();
    
    const response = await fetch(`${OLLAMA_PROXY_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        message: prompt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    console.log(`Response received in ${responseTime}ms`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: OllamaResponse = await response.json();
    console.log(`Classification completed in ${Date.now() - startTime}ms`);
    
    // Extrair JSON da resposta
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Ollama');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      include: Boolean(parsed.include),
      reason: String(parsed.reason || 'No reason provided'),
      criterion: String(parsed.criterion || 'No criterion specified'),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout: Classificação demorou mais de 2 minutos. Tente usar um modelo menor ou reduzir o texto.');
    }
    console.error('Error calling Ollama API:', error);
    throw new Error(`Failed to classify article with Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function classifyWithDeepSeek(
  article: { title: string; abstract: string },
  criteria: { inclusion: string[]; exclusion: string[] },
  model: string
): Promise<ClassifyArticleOutput> {
  const prompt = `
Você é um assistente especializado em revisão sistemática de literatura científica. Sua tarefa é classificar artigos científicos com base em critérios de inclusão e exclusão específicos.

REGRAS IMPORTANTES:
- INCLUIR artigos apenas quando atendem aos CRITÉRIOS DE INCLUSÃO
- EXCLUIR artigos quando violam qualquer CRITÉRIO DE EXCLUSÃO
- Um artigo deve atender algum dos critérios de inclusão E NÃO violar NENHUM critério de exclusão para ser incluído

CRITÉRIOS DE INCLUSÃO :
${criteria.inclusion.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CRITÉRIOS DE EXCLUSÃO (o artigo será excluído se atender a qualquer um):
${criteria.exclusion.map((c, i) => `${i + 1}. ${c}`).join('\n')}

ARTIGO PARA ANÁLISE:
Título: ${article.title}
Resumo: ${article.abstract}

PROCESSO DE DECISÃO:
1. Verifique se o artigo atende a algum dos critérios de inclusão
2. Verifique se o artigo viola ALGUM critério de exclusão
3. INCLUA apenas se atende a um dos critérios de inclusão E não viola nenhum critério de exclusão
4. EXCLUA se não atende algum critério de inclusão OU viola algum critério de exclusão

IMPORTANTE: Se include=true, cite um critério de INCLUSÃO. Se include=false, cite o critério de EXCLUSÃO violado.

Responda APENAS no seguinte formato JSON válido:
{
  "include": true/false,
  "reason": "Explicação clara da decisão baseada nos critérios",
  "criterion": "Texto do critério específico que determinou a decisão"
}
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minuto para DeepSeek
    
    console.log(`Starting DeepSeek classification for article: ${article.title.substring(0, 50)}...`);
    const startTime = Date.now();
    
    const response = await fetch(`${DEEPSEEK_PROXY_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        message: prompt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    console.log(`DeepSeek response received in ${responseTime}ms`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: DeepSeekResponse = await response.json();
    console.log(`DeepSeek classification completed in ${Date.now() - startTime}ms`);
    
    // Extrair JSON da resposta
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from DeepSeek');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      include: Boolean(parsed.include),
      reason: String(parsed.reason || 'No reason provided'),
      criterion: String(parsed.criterion || 'No criterion specified'),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout: Classificação demorou mais de 1 minuto.');
    }
    console.error('Error calling DeepSeek API:', error);
    throw new Error(`Failed to classify article with DeepSeek: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fetchOllamaModels(): Promise<OllamaModel[]> {
  try {
    console.log('Attempting to fetch models via proxy:', `${OLLAMA_PROXY_URL}/models`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${OLLAMA_PROXY_URL}/models`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Received data:', data);
    
    const models = data.models || [];
    console.log('Filtered text models:', models);
    return models;
  } catch (error) {
    console.error('Detailed error:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: Ollama API não respondeu em 10 segundos');
      }
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se o Ollama está rodando em 127.0.0.1:8566');
      }
    }
    
    throw error;
  }
}

async function fetchDeepSeekModels(): Promise<DeepSeekModelInfo[]> {
  try {
    console.log('Attempting to fetch DeepSeek models via proxy:', `${DEEPSEEK_PROXY_URL}/models`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${DEEPSEEK_PROXY_URL}/models`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('DeepSeek models response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('DeepSeek models received:', data);
    
    const models = data.models || [];
    console.log('DeepSeek models available:', models.length);
    return models;
  } catch (error) {
    console.error('Detailed error fetching DeepSeek models:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: Não foi possível conectar à API do DeepSeek em 10 segundos.');
      }
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Erro de rede: Verifique sua conexão com a internet e se a API key do DeepSeek está configurada.');
      }
    }
    
    throw error;
  }
}

export default function ScreenerPage() {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<{ inclusion: string[], exclusion: string[] } | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [classifiedArticles, setClassifiedArticles] = useState<ClassifiedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState("setup");
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<GeminiModel>('gemini-1.5-flash');
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('');
  const [selectedDeepSeekModel, setSelectedDeepSeekModel] = useState<DeepSeekModel>('deepseek-chat');
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [deepSeekModels, setDeepSeekModels] = useState<DeepSeekModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef(false);
  const [originalArticleData, setOriginalArticleData] = useState<Record<string, any>[]>([]); // Novo estado para dados originais
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Novos estados para filtros
  const [filterClassification, setFilterClassification] = useState<'all' | 'include' | 'exclude'>('all');
  const [filterCriterion, setFilterCriterion] = useState<string>('all');

  const form = useForm<CriteriaFormValues>({
    resolver: zodResolver(criteriaSchema),
    defaultValues: {
      inclusionCriteria: [{ value: '' }],
      exclusionCriteria: [{ value: '' }],
    },
  });

  const { fields: inclusionFields, append: appendInclusion, remove: removeInclusion } = useFieldArray({
    control: form.control,
    name: 'inclusionCriteria',
  });

  const { fields: exclusionFields, append: appendExclusion, remove: removeExclusion } = useFieldArray({
    control: form.control,
    name: 'exclusionCriteria',
  });

  useEffect(() => {
    try {
      const savedCriteria = localStorage.getItem('screenerCriteria');
      const savedProvider = localStorage.getItem('aiProvider') as AIProvider;
      const savedGeminiModel = localStorage.getItem('selectedGeminiModel') as GeminiModel;
      const savedOllamaModel = localStorage.getItem('selectedOllamaModel');
      const savedDeepSeekModel = localStorage.getItem('selectedDeepSeekModel') as DeepSeekModel;
      
      if (savedCriteria) {
        const parsedCriteria: { inclusion: string[], exclusion: string[] } = JSON.parse(savedCriteria);
        if (parsedCriteria.inclusion && parsedCriteria.exclusion) {
          form.reset({
            inclusionCriteria: parsedCriteria.inclusion.map(value => ({ value })),
            exclusionCriteria: parsedCriteria.exclusion.map(value => ({ value })),
          });
          setCriteria(parsedCriteria);
          toast({ title: "Loaded saved criteria." });
        }
      }

      if (savedProvider) {
        setAiProvider(savedProvider);
      }

      if (savedGeminiModel) {
        setSelectedGeminiModel(savedGeminiModel);
      }

      if (savedOllamaModel) {
        setSelectedOllamaModel(savedOllamaModel);
      }

      if (savedDeepSeekModel) {
        setSelectedDeepSeekModel(savedDeepSeekModel);
      }
    } catch (error) {
      console.error("Failed to parse saved data from localStorage", error);
    }
  }, [form, toast]);

  useEffect(() => {
    if (aiProvider === 'ollama') {
      loadOllamaModels();
    } else if (aiProvider === 'deepseek') {
      loadDeepSeekModels();
    }
  }, [aiProvider]);

  async function loadOllamaModels() {
    setIsLoadingModels(true);
    try {
      console.log('Loading Ollama models via proxy...');
      
      const models = await fetchOllamaModels();
      console.log('Models loaded successfully:', models);
      setOllamaModels(models);
      
      if (models.length > 0 && !selectedOllamaModel) {
        setSelectedOllamaModel(models[0].model);
        localStorage.setItem('selectedOllamaModel', models[0].model);
        console.log('Auto-selected model:', models[0].model);
        
        toast({
          title: 'Modelos carregados com sucesso',
          description: `${models.length} modelos encontrados. Selecionado: ${models[0].model}`,
        });
      }
      
      if (models.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum modelo encontrado',
          description: 'Baixe um modelo no Ollama usando: ollama pull llama3',
        });
      }
    } catch (error) {
      console.error('Error in loadOllamaModels:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar modelos do Ollama',
        description: errorMessage,
      });
      
      // Reset para Gemini se Ollama falhar
      setAiProvider('gemini');
      localStorage.setItem('aiProvider', 'gemini');
    } finally {
      setIsLoadingModels(false);
    }
  }

  async function loadDeepSeekModels() {
    setIsLoadingModels(true);
    try {
      console.log('Loading DeepSeek models via proxy...');
      
      const models = await fetchDeepSeekModels();
      console.log('DeepSeek models loaded successfully:', models);
      setDeepSeekModels(models);
      
      if (models.length > 0 && !selectedDeepSeekModel) {
        const firstModel = models[0].id as DeepSeekModel;
        setSelectedDeepSeekModel(firstModel);
        localStorage.setItem('selectedDeepSeekModel', firstModel);
      }
      
      if (models.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum modelo DeepSeek encontrado',
          description: 'Verifique se a API key do DeepSeek está configurada corretamente.',
        });
      }
    } catch (error) {
      console.error('Error in loadDeepSeekModels:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar modelos do DeepSeek',
        description: errorMessage,
      });
      
      // Reset para Gemini se DeepSeek falhar
      setAiProvider('gemini');
      localStorage.setItem('aiProvider', 'gemini');
    } finally {
      setIsLoadingModels(false);
    }
  }

  function handleProviderChange(provider: AIProvider) {
    setAiProvider(provider);
    localStorage.setItem('aiProvider', provider);
    if (provider === 'ollama') {
      loadOllamaModels();
    } else if (provider === 'deepseek') {
      loadDeepSeekModels();
    }
  }

  function handleGeminiModelChange(model: GeminiModel) {
    setSelectedGeminiModel(model);
    localStorage.setItem('selectedGeminiModel', model);
  }

  function handleOllamaModelChange(model: string) {
    setSelectedOllamaModel(model);
    localStorage.setItem('selectedOllamaModel', model);
  }

  function handleDeepSeekModelChange(model: DeepSeekModel) {
    setSelectedDeepSeekModel(model);
    localStorage.setItem('selectedDeepSeekModel', model);
  }

  function onCriteriaSubmit(data: CriteriaFormValues) {
    const formattedCriteria = {
      inclusion: data.inclusionCriteria.map(c => c.value),
      exclusion: data.exclusionCriteria.map(c => c.value),
    };
    setCriteria(formattedCriteria);
    setClassifiedArticles([]);
    
    try {
      localStorage.setItem('screenerCriteria', JSON.stringify(formattedCriteria));
      toast({
        title: "Criteria Set & Saved",
        description: "Your criteria have been saved in this browser.",
      });
    } catch (error) {
      console.error("Failed to save criteria to localStorage", error);
      toast({
        title: "Criteria Set",
        description: "You can now load your articles for screening.",
      });
    }
  }

  function handleResetCriteria() {
    form.reset({
      inclusionCriteria: [{ value: '' }],
      exclusionCriteria: [{ value: '' }],
    });
    setCriteria(null);
    setClassifiedArticles([]);
    localStorage.removeItem('screenerCriteria');
    toast({
      title: "Criteria Reset",
      description: "Saved criteria have been cleared.",
    });
  }

  function handleLoadSampleData() {
    setArticles(sampleArticles);
    setFileName('Sample Data');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({ title: "Sample data loaded."});
  }
  
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
        toast({ variant: 'destructive', title: 'Error', description: 'No file selected.' });
        return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to read file.' });
          return;
        }
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const lowercasedJson = json.map(row => 
            Object.keys(row).reduce((acc, key) => {
                acc[key.toLowerCase()] = row[key];
                return acc;
            }, {} as {[key: string]: any})
        );
        
        console.log('File columns detected:', Object.keys(lowercasedJson[0] || {}));
        
        // Verificar se é um arquivo de resultados anteriores
        // Procurar pelas colunas que realmente exportamos: classification, reason, criterion
        const hasClassificationData = lowercasedJson.length > 0 && 
            (lowercasedJson[0].hasOwnProperty('classification') || 
             lowercasedJson[0].hasOwnProperty('reason') || 
             lowercasedJson[0].hasOwnProperty('criterion') ||
             // Manter as verificações antigas para compatibilidade
             lowercasedJson[0].hasOwnProperty('ai_include') || 
             lowercasedJson[0].hasOwnProperty('ai_reason') || 
             lowercasedJson[0].hasOwnProperty('ai_criterion') ||
             lowercasedJson[0].hasOwnProperty('manual_include') ||
             lowercasedJson[0].hasOwnProperty('manual_reason') ||
             lowercasedJson[0].hasOwnProperty('manual_criterion') ||
             lowercasedJson[0].hasOwnProperty('final_include') ||
             lowercasedJson[0].hasOwnProperty('final_reason') ||
             lowercasedJson[0].hasOwnProperty('final_criterion'));

        console.log('Has classification data:', hasClassificationData);

        if (hasClassificationData) {
            // Carregar resultados anteriores
            handleLoadPreviousResults(lowercasedJson);
        } else {
            // Carregar novos artigos para análise
            handleLoadNewArticles(lowercasedJson);
        }
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to read file.' });
    }
    reader.readAsBinaryString(file);
  }

  function handleLoadNewArticles(lowercasedJson: any[]) {
    if (lowercasedJson.length > 0 && (!lowercasedJson[0].hasOwnProperty('title') || !lowercasedJson[0].hasOwnProperty('abstract'))) {
        toast({ variant: 'destructive', title: 'Error', description: 'File must contain "title" and "abstract" columns.' });
        setArticles([]);
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    // Preservar dados originais completos
    setOriginalArticleData(lowercasedJson);

    const parsedArticles = lowercasedJson.map(row => ({
        title: row.title || '',
        abstract: row.abstract || '',
        doi: row.doi || row.DOI || '',
        source: row.source || row.journal || row.publication || row.venue || '', // Capturar source/journal dos dados
    })).filter(a => a.title && a.abstract);
    
    setArticles(parsedArticles);
    setClassifiedArticles([]);
    toast({ title: "File parsed successfully.", description: `${parsedArticles.length} articles loaded.`});
  }

  function handleLoadPreviousResults(lowercasedJson: any[]) {
    try {
        console.log('Loading previous results...');
        
        // Verificar se tem as colunas necessárias
        if (lowercasedJson.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Empty file.' });
            return;
        }

        const requiredColumns = ['title', 'abstract'];
        const missingColumns = requiredColumns.filter(col => !lowercasedJson[0].hasOwnProperty(col));
        
        if (missingColumns.length > 0) {
            toast({ 
                variant: 'destructive', 
                title: 'Error', 
                description: `Missing required columns: ${missingColumns.join(', ')}` 
            });
            return;
        }

        // Extrair critérios do arquivo se disponíveis
        let loadedCriteria: { inclusion: string[], exclusion: string[] } | null = null;
        
        if (lowercasedJson[0].hasOwnProperty('inclusion_criteria') && lowercasedJson[0].hasOwnProperty('exclusion_criteria')) {
            const inclusionCriteria = lowercasedJson[0].inclusion_criteria;
            const exclusionCriteria = lowercasedJson[0].exclusion_criteria;
            
            if (inclusionCriteria && exclusionCriteria) {
                loadedCriteria = {
                    inclusion: inclusionCriteria.split('|').filter((c: string) => c.trim()),
                    exclusion: exclusionCriteria.split('|').filter((c: string) => c.trim())
                };
            }
        }

        // Criar artigos com classificações existentes
        const articlesWithClassification: ClassifiedArticle[] = lowercasedJson.map(row => {
            const article: Article = {
                title: row.title || '',
                abstract: row.abstract || '',
                doi: row.doi || row.DOI || '',
                source: row.source || row.journal || row.publication || row.venue || '', // Capturar source/journal dos dados
            };

            // Determinar classificação - priorizar na ordem: classification (novo formato) > final > manual > ai
            let include = false;
            let reason = 'Loaded from previous results';
            let criterion = 'Loaded from previous results';

            // Primeiro verificar o novo formato de exportação
            if (row.hasOwnProperty('classification') && row.classification !== null && row.classification !== '') {
                include = row.classification === 'Include' || row.classification === true || row.classification === 'true';
                reason = row.reason || reason;
                criterion = row.criterion || criterion;
            }
            // Depois verificar se tem classificação final (formato antigo)
            else if (row.hasOwnProperty('final_include') && row.final_include !== null && row.final_include !== '') {
                include = row.final_include === true || row.final_include === 'true' || row.final_include === 'Include';
                reason = row.final_reason || reason;
                criterion = row.final_criterion || criterion;
            }
            // Depois verificar manual (formato antigo)
            else if (row.hasOwnProperty('manual_include') && row.manual_include !== null && row.manual_include !== '') {
                include = row.manual_include === true || row.manual_include === 'true' || row.manual_include === 'Include';
                reason = row.manual_reason || reason;
                criterion = row.manual_criterion || criterion;
            }
            // Por último verificar AI (formato antigo)
            else if (row.hasOwnProperty('ai_include') && row.ai_include !== null && row.ai_include !== '') {
                include = row.ai_include === true || row.ai_include === 'true' || row.ai_include === 'Include';
                reason = row.ai_reason || reason;
                criterion = row.ai_criterion || criterion;
            }

            const classification: ClassifyArticleOutput = {
                include: include,
                reason: reason,
                criterion: criterion
            };

            return {
                ...article,
                classification,
                originalData: row
            };
        }).filter(a => a.title && a.abstract);

        console.log('Articles with classification:', articlesWithClassification.length);

        // Extrair artigos básicos para o estado articles
        const basicArticles = articlesWithClassification.map(a => ({
            title: a.title,
            abstract: a.abstract
        }));

        setArticles(basicArticles);
        setClassifiedArticles(articlesWithClassification);

        // Carregar critérios se disponíveis
        if (loadedCriteria) {
            setCriteria(loadedCriteria);
            form.reset({
                inclusionCriteria: loadedCriteria.inclusion.map(value => ({ value })),
                exclusionCriteria: loadedCriteria.exclusion.map(value => ({ value })),
            });
            localStorage.setItem('screenerCriteria', JSON.stringify(loadedCriteria));
        }

        // Usar setTimeout para garantir que o estado seja atualizado primeiro
        setTimeout(() => {
            console.log('Switching to results tab...');
            setActiveTab("results");
        }, 100);

        toast({ 
            title: "Previous results loaded successfully!", 
            description: `${articlesWithClassification.length} classified articles loaded. ${loadedCriteria ? 'Criteria also restored.' : 'Set criteria if needed.'}`,
            duration: 5000
        });

    } catch (error) {
        console.error('Error loading previous results:', error);
        toast({ 
            variant: 'destructive', 
            title: 'Error loading previous results', 
            description: 'Failed to parse the results file. Please check the file format.' 
        });
        setArticles([]);
        setClassifiedArticles([]);
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleContinueAnalysis() {
    if (!criteria || articles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please set criteria before continuing analysis.',
      });
      return;
    }

    // Encontrar artigos que ainda não foram classificados
    const unclassifiedArticles = articles.filter(article => 
      !classifiedArticles.some(classified => 
        classified.title === article.title && classified.abstract === article.abstract
      )
    );

    if (unclassifiedArticles.length === 0) {
      toast({
        title: 'Analysis already complete',
        description: 'All articles have been classified. You can export the results or modify classifications manually.',
      });
      return;
    }

    toast({
      title: 'Continuing analysis',
      description: `${unclassifiedArticles.length} articles remaining to classify.`,
    });

    // Executar análise apenas nos artigos não classificados
    runAnalysisForArticles(unclassifiedArticles);
  }

  async function runAnalysisForArticles(articlesToAnalyze: Article[]) {
    if (aiProvider === 'ollama' && !selectedOllamaModel) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select an Ollama model.',
      });
      return;
    }

    if (aiProvider === 'deepseek' && !selectedDeepSeekModel) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a DeepSeek model.',
      });
      return;
    }

    // Aviso sobre tempo de processamento
    if (aiProvider === 'ollama') {
      toast({
        title: 'Análise iniciada com Ollama',
        description: `Processamento local pode ser mais lento. Timeout: 2 minutos por artigo.`,
      });
    } else if (aiProvider === 'deepseek') {
      toast({
        title: 'Análise iniciada com DeepSeek',
        description: `Usando modelo: ${selectedDeepSeekModel}. Processamento via API.`,
      });
    } else {
      toast({
        title: 'Análise iniciada com Gemini',
        description: `Usando modelo: ${selectedGeminiModel}`,
      });
    }
    
    setActiveTab("results");
    isCancelledRef.current = false;
    setIsLoading(true);
    setProgress(0);

    const results: ClassifiedArticle[] = [...classifiedArticles]; // Manter resultados existentes
    let articlesProcessed = 0;
    const totalArticles = articlesToAnalyze.length;
    
    const articlesToProcess = [...articlesToAnalyze];

    const processBatch = async () => {
      const batch = articlesToProcess.splice(0, CONCURRENT_REQUESTS);
      if (batch.length === 0) return;

      await Promise.all(batch.map(async (article) => {
        if (isCancelledRef.current) return;

        try {
          let classification: ClassifyArticleOutput;
          
          if (aiProvider === 'gemini') {
            classification = await classifyArticle({
              title: article.title,
              abstract: article.abstract,
              inclusionCriteria: criteria!.inclusion,
              exclusionCriteria: criteria!.exclusion,
              model: selectedGeminiModel,
            });
          } else if (aiProvider === 'deepseek') {
            classification = await classifyWithDeepSeek(
              { title: article.title, abstract: article.abstract },
              criteria!,
              selectedDeepSeekModel
            );
          } else {
            classification = await classifyWithOllama(
              { title: article.title, abstract: article.abstract },
              criteria!,
              selectedOllamaModel
            );
          }

          if (!isCancelledRef.current) {
            const classifiedArticle = { 
              ...article, 
              classification,
              originalData: originalArticleData.find(original => 
                original.title === article.title && original.abstract === article.abstract
              )
            };
            setClassifiedArticles(prev => [...prev, classifiedArticle]);
            results.push(classifiedArticle);
          }
        } catch (error) {
          console.error('Error classifying article:', error);
          if (!isCancelledRef.current) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            toast({
              variant: 'destructive',
              title: 'Erro na análise',
              description: `Erro ao classificar artigo: ${errorMessage}`,
            });
          }
        } finally {
          if (!isCancelledRef.current) {
            articlesProcessed++;
            setProgress((articlesProcessed / totalArticles) * 100);
          }
        }
      }));

      if (!isCancelledRef.current && articlesToProcess.length > 0) {
        await processBatch();
      }
    };

    await processBatch();

    if (isCancelledRef.current && !isLoading) {
       return;
    }

    if (isCancelledRef.current) {
      toast({
        variant: 'destructive',
        title: 'Analysis Interrupted',
        description: 'The analysis process was cancelled or an error occurred.',
      });
    } else {
      toast({
        title: 'Analysis Complete',
        description: `Classificação concluída. ${articlesProcessed} novos artigos processados.`,
      });
    }

    setIsLoading(false);
  }

  async function handleRunAnalysis() {
    if (!criteria || articles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please set criteria and load articles before running analysis.',
      });
      return;
    }

    // Resetar classificações existentes e analisar todos os artigos
    setClassifiedArticles([]);
    await runAnalysisForArticles(articles);
  }

  function handleClassificationChange(index: number, newInclude: boolean) {
    setClassifiedArticles(prev => 
      prev.map((article, i) => 
        i === index 
          ? {
              ...article,
              classification: {
                ...article.classification,
                include: newInclude,
                reason: newInclude 
                  ? 'Manually changed to Include by user' 
                  : 'Manually changed to Exclude by user'
              }
            }
          : article
      )
    );
    
    toast({
      title: 'Classification Updated',
      description: `Article ${newInclude ? 'included' : 'excluded'} manually.`,
    });
  }

  // Nova função para alterar o critério manualmente
  function handleCriterionChange(index: number, newCriterion: string) {
    setClassifiedArticles(prev => 
      prev.map((article, i) => 
        i === index 
          ? {
              ...article,
              classification: {
                ...article.classification,
                criterion: newCriterion,
                reason: `Criterion manually changed by user to: ${newCriterion}`
              }
            }
          : article
      )
    );
    
    toast({
      title: 'Criterion Updated',
      description: 'Article criterion changed manually.',
    });
  }

  function handleRowExpand(index: number) {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  function handleInterrupt() {
    isCancelledRef.current = true;
    setIsLoading(false);
  }
  
  const filteredArticles = useMemo(() => {
    return classifiedArticles.filter(article => {
      // Filtro por classificação
      const matchesClassification = filterClassification === 'all' || 
        (filterClassification === 'include' && article.classification.include) ||
        (filterClassification === 'exclude' && !article.classification.include);

      // Filtro por critério
      const matchesCriterion = filterCriterion === 'all' || 
        article.classification.criterion.toLowerCase().includes(filterCriterion.toLowerCase());

      return matchesClassification && matchesCriterion;
    });
  }, [classifiedArticles, filterClassification, filterCriterion]);

  // Obter critérios únicos para o filtro
  const uniqueCriteria = useMemo(() => {
    const criteriaSet = new Set<string>();
    classifiedArticles.forEach(article => {
      if (article.classification.criterion && article.classification.criterion.trim()) {
        // Normalizar o texto para comparação (remover espaços extras e converter para lowercase)
        const normalizedCriterion = article.classification.criterion.trim().toLowerCase();
        criteriaSet.add(normalizedCriterion);
      }
    });
    
    // Converter de volta para array e ordenar, mantendo a capitalização original
    const uniqueArray = Array.from(criteriaSet).map(normalized => {
      // Encontrar o critério original que corresponde ao normalizado
      const originalCriterion = classifiedArticles.find(article => 
        article.classification.criterion && 
        article.classification.criterion.trim().toLowerCase() === normalized
      )?.classification.criterion.trim();
      
      return originalCriterion || normalized;
    }).sort();
    
    return uniqueArray;
  }, [classifiedArticles]);

  // Função para limpar filtros
  function clearFilters() {
    setFilterClassification('all');
    setFilterCriterion('all');
    setExpandedRows(new Set());
  }

  // Contar artigos por classificação
  const classificationCounts = useMemo(() => {
    const included = classifiedArticles.filter(a => a.classification.include).length;
    const excluded = classifiedArticles.filter(a => !a.classification.include).length;
    return { included, excluded, total: classifiedArticles.length };
  }, [classifiedArticles]);

  // Adicionar este useMemo para calcular estatísticas por critério
  const criteriaStatistics = useMemo(() => {
    const stats = new Map<string, { included: number; excluded: number; total: number }>();
    
    classifiedArticles.forEach(article => {
      const criterion = article.classification.criterion;
      if (!criterion || criterion.trim() === '') return;
      
      const normalizedCriterion = criterion.trim();
      const existing = stats.get(normalizedCriterion) || { included: 0, excluded: 0, total: 0 };
      
      if (article.classification.include) {
        existing.included++;
      } else {
        existing.excluded++;
      }
      existing.total++;
      
      stats.set(normalizedCriterion, existing);
    });
    
    // Converter para array e ordenar por total decrescente
    return Array.from(stats.entries())
      .map(([criterion, counts]) => ({ criterion, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [classifiedArticles]);

  const showDataCard = !!criteria;
  const showAnalysisButton = showDataCard && articles.length > 0 && !isLoading;
  const showResults = classifiedArticles.length > 0 && !isLoading;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8 font-body">
      <header className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">ScreHelper</h1>
        <p className="text-lg text-muted-foreground mt-2">AI-Powered Screening for Scientific Literature Reviews</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="results" disabled={classifiedArticles.length === 0}>Results</TabsTrigger>
        </TabsList>
        <TabsContent value="setup" className="space-y-8 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TestTube2 className="text-primary" />Define Criteria</CardTitle>
                <CardDescription>Set your inclusion and exclusion criteria. The AI will use these to classify articles. Your criteria are saved in your browser.</CardDescription>
              </CardHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCriteriaSubmit)}>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-2 text-primary">Inclusion Criteria</h3>
                      <div className="space-y-2">
                        {inclusionFields.map((field, index) => (
                          <FormField
                            key={field.id}
                            control={form.control}
                            name={`inclusionCriteria.${index}.value`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Input placeholder="e.g., must be a clinical trial" {...field} />
                                </FormControl>
                                {inclusionFields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeInclusion(index)}><XCircle className="h-4 w-4 text-destructive" /></Button>}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendInclusion({ value: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Inclusion Criterion
                      </Button>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-2 text-primary">Exclusion Criteria</h3>
                      <div className="space-y-2">
                        {exclusionFields.map((field, index) => (
                          <FormField
                            key={field.id}
                            control={form.control}
                            name={`exclusionCriteria.${index}.value`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Input placeholder="e.g., studies on animals" {...field} />
                                </FormControl>
                                {exclusionFields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeExclusion(index)}><XCircle className="h-4 w-4 text-destructive" /></Button>}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendExclusion({ value: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Exclusion Criterion
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Set & Save Criteria</Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={handleResetCriteria}>
                      <RotateCcw className="mr-2 h-4 w-4"/>
                      Reset Criteria
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>
            
            <div className="space-y-8">
                {/* AI Provider Selection Card */}
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="text-secondary" />
                            AI Provider
                        </CardTitle>
                        <CardDescription>Choose your AI provider for article classification.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Provider</label>
                            <Select value={aiProvider} onValueChange={handleProviderChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini">Google Gemini (Cloud)</SelectItem>
                                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                    <SelectItem value="deepseek">DeepSeek (Cloud)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {aiProvider === 'gemini' && (
                            <div>
                                <label className="text-sm font-medium mb-2 block">Gemini Model</label>
                                <Select 
                                    value={selectedGeminiModel} 
                                    onValueChange={handleGeminiModelChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GEMINI_MODELS.map((model) => (
                                            <SelectItem key={model.value} value={model.value}>
                                                {model.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        
                        {aiProvider === 'ollama' && (
                            <div>
                                <label className="text-sm font-medium mb-2 block">Ollama Model</label>
                                <Select 
                                    value={selectedOllamaModel} 
                                    onValueChange={handleOllamaModelChange}
                                    disabled={isLoadingModels}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select a model"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ollamaModels.map((model) => (
                                            <SelectItem key={model.model} value={model.model}>
                                                <div className="flex flex-col">
                                                    <span>{model.model}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {model.details?.parameter_size} • {model.details?.quantization_level}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {ollamaModels.length === 0 && !isLoadingModels && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        No models found. Make sure Ollama is running with downloaded models.
                                    </p>
                                )}
                            </div>
                        )}

                        {aiProvider === 'deepseek' && (
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    DeepSeek Model
                                    {isLoadingModels && <span className="ml-2 text-xs text-muted-foreground">(Loading...)</span>}
                                </label>
                                <Select 
                                    value={selectedDeepSeekModel} 
                                    onValueChange={handleDeepSeekModelChange}
                                    disabled={isLoadingModels}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a DeepSeek model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deepSeekModels.length > 0 ? (
                                            // Se temos modelos da API, usar apenas esses
                                            deepSeekModels.map((model) => (
                                                <SelectItem key={model.id} value={model.id}>
                                                    <div className="flex flex-col">
                                                        <span>{model.name || model.id}</span>
                                                        {model.description && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {model.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        ) : (
                                            // Se não temos modelos da API, usar os modelos constantes
                                            DEEPSEEK_MODELS.map((model) => (
                                                <SelectItem key={model.value} value={model.value}>
                                                    <div className="flex flex-col">
                                                        <span>{model.label}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {model.description}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {deepSeekModels.length === 0 && !isLoadingModels && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Using default models. API key may not be configured.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                            {aiProvider === 'gemini' 
                                ? `Using Google's ${GEMINI_MODELS.find(m => m.value === selectedGeminiModel)?.label} API (requires internet connection)`
                                : aiProvider === 'deepseek'
                                ? `Using DeepSeek ${DEEPSEEK_MODELS.find(m => m.value === selectedDeepSeekModel)?.label} API (requires internet connection & API key)`
                                : `Using local Ollama API via proxy (offline, timeout: 2min per article)`
                            }
                        </div>
                    </CardContent>
                </Card>

                <Card className={`w-full transition-opacity duration-500 ${showDataCard ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FlaskConical className="text-accent" />Load Articles</CardTitle>
                        <CardDescription>
                          Upload an XLSX/XLS file with articles or load previous results to continue analysis. 
                          New files need 'title' and 'abstract' columns. Previous results will be automatically detected.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center w-full">
                            <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-2 text-muted-foreground"/>
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">XLSX or XLS file (new articles or previous results)</p>
                                </div>
                                <Input id="file-upload" ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                            </label>
                            {fileName && (
                              <div className="mt-2 text-center">
                                <p className="text-sm text-muted-foreground">Loaded file: {fileName}</p>
                                {classifiedArticles.length > 0 && (
                                  <p className="text-xs text-green-600 mt-1">
                                    ✓ Previous results detected and loaded
                                  </p>
                                )}
                              </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={() => fileInputRef.current?.click()} className="w-full" variant="secondary">Upload File</Button>
                        <Button onClick={handleLoadSampleData} className="w-full" variant="outline">Use Sample Data</Button>
                    </CardFooter>
                </Card>

                {showAnalysisButton && (
                    <div className="text-center transition-opacity duration-500 space-y-4">
                        <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleRunAnalysis}>
                            <BrainCircuit className="mr-2 h-5 w-5" /> 
                            Run AI Analysis ({articles.length} Articles)
                            {aiProvider === 'gemini' && (
                                <span className="ml-2 text-xs opacity-75">with {selectedGeminiModel}</span>
                            )}
                            {aiProvider === 'ollama' && selectedOllamaModel && (
                                <span className="ml-2 text-xs opacity-75">with {selectedOllamaModel}</span>
                            )}
                        </Button>
                        
                        {classifiedArticles.length > 0 && classifiedArticles.length < articles.length && (
                            <Button 
                                size="lg" 
                                variant="outline" 
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200" 
                                onClick={handleContinueAnalysis}
                            >
                                <RefreshCw className="mr-2 h-5 w-5" /> 
                                Continue Analysis ({articles.length - classifiedArticles.length} Remaining)
                            </Button>
                        )}
                    </div>
                )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="results" className="mt-8">
          {isLoading && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis in Progress...</CardTitle>
                <CardDescription>The AI is classifying your articles. Please wait.</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="w-full" />
                <p className="text-center text-muted-foreground mt-2">{Math.round(progress)}% complete</p>
              </CardContent>
              <CardFooter className="justify-center">
                <Button variant="destructive" onClick={handleInterrupt}>
                    <Ban className="mr-2 h-4 w-4" /> Interrupt Analysis
                </Button>
              </CardFooter>
            </Card>
          )}

          {showResults && (
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BrainCircuit className="text-green-600" />
                      Classification Results
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex gap-4">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Included: {classificationCounts.included}
                        </Badge>
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          Excluded: {classificationCounts.excluded}
                        </Badge>
                        <Badge variant="outline">
                          Total: {classificationCounts.total}
                        </Badge>
                      </div>
                    </CardDescription>
                  </div>
                  <Button onClick={() => exportToXlsx(classifiedArticles, criteria!, originalArticleData)} className="mt-4 md:mt-0">
                    <FileDown className="mr-2 h-4 w-4" /> Export to XLSX
                  </Button>
                </div>
              </CardHeader>

              {/* Nova Seção: Tabela de Estatísticas por Critério */}
              {criteriaStatistics.length > 0 && (
                <CardContent className="border-b">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <TestTube2 className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Classification Summary by Criterion</h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm">
                              Criterion
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-sm min-w-[100px]">
                              Included
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-sm min-w-[100px]">
                              Excluded
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-sm min-w-[100px]">
                              Total
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-sm min-w-[120px]">
                              Inclusion Rate (%)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {criteriaStatistics.map((stat, index) => {
                            const inclusionRate = ((stat.included / stat.total) * 100).toFixed(1);
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-3 text-sm">
                                  {stat.criterion}
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                    {stat.included}
                                  </span>
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                    {stat.excluded}
                                  </span>
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium">
                                  {stat.total}
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="font-medium">{inclusionRate}%</span>
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-green-500 transition-all duration-300"
                                        style={{ width: `${inclusionRate}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-medium">
                            <td className="border border-gray-300 px-4 py-3 text-sm font-semibold">
                              TOTAL
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                              <span className="inline-flex items-center justify-center min-w-[24px] h-6 bg-green-200 text-green-900 rounded-full text-xs font-bold">
                                {classificationCounts.included}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                              <span className="inline-flex items-center justify-center min-w-[24px] h-6 bg-red-200 text-red-900 rounded-full text-xs font-bold">
                                {classificationCounts.excluded}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-sm font-bold">
                              {classificationCounts.total}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                              <span className="font-bold">
                                {classificationCounts.total > 0 
                                  ? ((classificationCounts.included / classificationCounts.total) * 100).toFixed(1)
                                  : '0.0'
                                }%
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      <p><strong>Note:</strong> This table shows the distribution of articles by the primary criterion that determined their classification. Each article is counted once based on the most relevant criterion identified by the AI.</p>
                    </div>
                  </div>
                </CardContent>
              )}
              
              {/* Seção de Filtros */}
              <CardContent className="border-b">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Classification:</label>
                      <Select value={filterClassification} onValueChange={(value: 'all' | 'include' | 'exclude') => setFilterClassification(value)}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="include">Include</SelectItem>
                          <SelectItem value="exclude">Exclude</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Criterion:</label>
                      <Select value={filterCriterion} onValueChange={setFilterCriterion}>
                        <SelectTrigger className="w-48 h-8">
                          <SelectValue placeholder="All criteria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All criteria</SelectItem>
                          {uniqueCriteria.map((criterion) => (
                            <SelectItem key={criterion} value={criterion}>
                              <div className="truncate max-w-40" title={criterion}>
                                {criterion}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(filterClassification !== 'all' || filterCriterion !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 px-2"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Indicador de filtros ativos */}
                {(filterClassification !== 'all' || filterCriterion !== 'all') && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Showing {filteredArticles.length} of {classifiedArticles.length} articles</span>
                      <div className="flex gap-1">
                        {filterClassification !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            {filterClassification}
                          </Badge>
                        )}
                        {filterCriterion !== 'all' && (
                          <Badge variant="secondary" className="text-xs">
                            {filterCriterion.length > 30 ? `${filterCriterion.substring(0, 30)}...` : filterCriterion}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="w-[35%]">Title</TableHead>
                        <TableHead className="w-[150px]">Classification</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Criterion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArticles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No articles match the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredArticles.sort((a,b) => articles.findIndex(art => art.title === a.title) - articles.findIndex(art => art.title === b.title))
                        .map((article, filteredIndex) => {
                          const originalIndex = classifiedArticles.findIndex(a => a.title === article.title && a.abstract === article.abstract);
                          return (
                            <React.Fragment key={`filtered-article-${originalIndex}-${filteredIndex}`}>
                              <TableRow 
                                className="hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => handleRowExpand(originalIndex)}
                              >
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRowExpand(originalIndex);
                                    }}
                                  >
                                    {expandedRows.has(originalIndex) ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div className="space-y-1">
                                    <div>{article.title}</div>
                                    {article.source && (
                                      <div className="text-xs text-muted-foreground italic">
                                        {article.source}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant={article.classification.include ? "default" : "outline"}
                                      onClick={() => handleClassificationChange(originalIndex, true)}
                                      className={`transition-all ${
                                        article.classification.include 
                                          ? "bg-green-600 hover:bg-green-700 text-white" 
                                          : "hover:bg-green-50 border-green-200 text-green-700"
                                      }`}
                                    >
                                      Include
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={!article.classification.include ? "destructive" : "outline"}
                                      onClick={() => handleClassificationChange(originalIndex, false)}
                                      className={`transition-all ${
                                        !article.classification.include 
                                          ? "bg-red-600 hover:bg-red-700 text-white" 
                                          : "hover:bg-red-50 border-red-200 text-red-700"
                                      }`}
                                    >
                                      Exclude
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>{article.classification.reason}</TableCell>
                                <TableCell>
                                  <div className="max-w-xs">
    <Select 
      value={article.classification.criterion} 
      onValueChange={(value) => handleCriterionChange(originalIndex, value)}
    >
      <SelectTrigger className="w-full text-xs h-8">
        <SelectValue>
          <div className="truncate" title={article.classification.criterion}>
            {article.classification.criterion}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Seção de Critérios de Inclusão */}
        <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border-b">
          Inclusion Criteria
        </div>
        {criteria?.inclusion.map((criterion, idx) => (
          <SelectItem 
            key={`inclusion-${idx}`} 
            value={`${idx + 1}. ${criterion}`}
            className="text-xs"
          >
            <div className="flex items-start gap-2">
              <span className="text-green-600 font-medium">{idx + 1}.</span>
              <span className="flex-1">{criterion}</span>
            </div>
          </SelectItem>
        ))}
        
        {/* Seção de Critérios de Exclusão */}
        <div className="px-2 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border-b border-t">
          Exclusion Criteria
        </div>
        {criteria?.exclusion.map((criterion, idx) => (
          <SelectItem 
            key={`exclusion-${idx}`} 
            value={`${idx + 1}. ${criterion}`}
            className="text-xs"
          >
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-medium">{idx + 1}.</span>
              <span className="flex-1">{criterion}</span>
            </div>
          </SelectItem>
        ))}
        
        {/* Opções personalizadas */}
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-t">
          Manual Classifications
        </div>
        <SelectItem 
          value="Manually included by user" 
          className="text-xs text-green-700"
        >
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>Manually included by user</span>
          </div>
        </SelectItem>
        <SelectItem 
          value="Manually excluded by user" 
          className="text-xs text-red-700"
        >
          <div className="flex items-center gap-2">
            <span>✗</span>
            <span>Manually excluded by user</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</TableCell>
                              </TableRow>
                              {expandedRows.has(originalIndex) && (
                                <TableRow className="border-b-0">
                                  <TableCell></TableCell>
                                  <TableCell colSpan={4} className="bg-muted/30 p-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Abstract</h4>
                                          {article.doi && (
                                            <a
                                              href={article.doi.startsWith('http') ? article.doi : `https://doi.org/${article.doi}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                            >
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                                              </svg>
                                              DOI
                                            </a>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRowExpand(originalIndex)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="text-sm leading-relaxed text-foreground bg-background rounded-md p-3 border">
                                        {article.abstract}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
          {!showResults && !isLoading && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="space-y-4">
                  <div className="text-muted-foreground">
                    <BrainCircuit className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No Results Yet</h3>
                    <p className="text-sm">
                      {!criteria 
                        ? "Set your criteria and load articles to begin analysis."
                        : articles.length === 0 
                        ? "Load articles to start the AI classification process."
                        : "Run the AI analysis to classify your articles."
                      }
                    </p>
                  </div>
                  {criteria && articles.length > 0 && (
                    <Button 
                      onClick={handleRunAnalysis}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      Start Analysis
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}


