# DeepSeek Integration Guide

## Configuração

### 1. Obtenha uma API Key do DeepSeek

1. Visite [https://platform.deepseek.com/](https://platform.deepseek.com/)
2. Crie uma conta ou faça login
3. Navegue até a seção de API Keys
4. Crie uma nova API key

### 2. Configure a variável de ambiente

Adicione a seguinte variável ao seu arquivo `.env.local`:

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 3. Reinicie o servidor de desenvolvimento

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

## Modelos Disponíveis

### DeepSeek Chat
- **ID**: `deepseek-chat`
- **Descrição**: Modelo principal para conversas e raciocínio geral
- **Uso recomendado**: Classificação de artigos científicos, análise de texto
- **Contexto**: 32K tokens
- **Custo**: ~$0.14/1M tokens input, ~$0.28/1M tokens output

### DeepSeek Coder
- **ID**: `deepseek-coder`
- **Descrição**: Especializado em geração e análise de código
- **Uso recomendado**: Análise de artigos técnicos, papers de ciência da computação
- **Contexto**: 16K tokens
- **Custo**: ~$0.14/1M tokens input, ~$0.28/1M tokens output

### DeepSeek Reasoner
- **ID**: `deepseek-reasoner`
- **Descrição**: Modelo avançado com capacidades de raciocínio aprofundado
- **Uso recomendado**: Análise complexa de critérios, casos ambíguos
- **Contexto**: 32K tokens
- **Custo**: ~$2.19/1M tokens input, ~$8.76/1M tokens output

## Características

### Vantagens
- ✅ **Velocidade**: Respostas rápidas (tipicamente 1-3 segundos)
- ✅ **Qualidade**: Alta qualidade na classificação de textos acadêmicos
- ✅ **Consistência**: Resultados mais consistentes que modelos locais
- ✅ **Sem configuração local**: Não requer instalação de software adicional
- ✅ **Custo-benefício**: Preços competitivos comparado a outros providers

### Desvantagens
- ❌ **Requer internet**: Necessita conexão estável
- ❌ **Custo por uso**: Paga por token processado
- ❌ **Dependência externa**: Sujeito à disponibilidade do serviço
- ❌ **Privacidade**: Dados enviados para servidor externo

## Configurações de Timeout

- **Timeout por artigo**: 60 segundos (1 minuto)
- **Requisições simultâneas**: 2 (configurável via `CONCURRENT_REQUESTS`)

## Solução de Problemas

### Erro: "DeepSeek API key not configured"
- Verifique se a variável `DEEPSEEK_API_KEY` está definida no `.env.local`
- Reinicie o servidor de desenvolvimento após adicionar a variável

### Erro: "Failed to connect to DeepSeek API"
- Verifique sua conexão com a internet
- Confirme se a API key está válida
- Verifique se há limites de rate limit ou créditos esgotados

### Modelos não aparecem
- O sistema usa uma lista estática de modelos como fallback
- Mesmo sem conectividade com a API, os modelos principais estarão disponíveis

### Respostas lentas ou timeouts
- Reduza o número de requisições simultâneas
- Considere usar textos/abstracts mais curtos
- Verifique a estabilidade da conexão

## Comparação com outros Providers

| Feature | DeepSeek | Gemini | Ollama |
|---------|----------|--------|---------|
| Velocidade | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Custo | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Privacidade | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Facilidade | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Offline | ❌ | ❌ | ✅ |

## Exemplo de Uso

1. Selecione "DeepSeek (Cloud)" como provider
2. Escolha o modelo desejado (recomendado: DeepSeek Chat)
3. Configure seus critérios de inclusão/exclusão
4. Carregue seus artigos
5. Execute a análise

O sistema processará os artigos usando a API do DeepSeek e retornará as classificações com justificativas detalhadas.
