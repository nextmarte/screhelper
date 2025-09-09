# ScreenHelper - AI-Powered Systematic Review Screening

Uma ferramenta inteligente para triagem automatizada de artigos científicos em revisões sistemáticas, com suporte a múltiplos provedores de IA.

## 🚀 Funcionalidades

- **Múltiplos Provedores de IA**: Suporte para Google Gemini, Ollama (local) e DeepSeek
- **Classificação Automatizada**: Avaliação automática de artigos baseada em critérios de inclusão/exclusão
- **Interface Intuitiva**: Interface web moderna e responsiva
- **Processamento em Lote**: Análise de múltiplos artigos simultaneamente
- **Exportação de Resultados**: Exporta resultados em formato XLSX
- **Continuação de Análise**: Possibilidade de continuar análises interrompidas

## 🛠️ Tecnologias

- **Frontend**: Next.js 15, React 18, TypeScript
- **UI**: Tailwind CSS, Radix UI, Shadcn/ui
- **AI Providers**: 
  - Google Gemini (Cloud)
  - Ollama (Local)
  - DeepSeek (Cloud)
- **Processamento**: XLSX para manipulação de planilhas

## 📋 Pré-requisitos

- Node.js 18+ ou Bun
- API Keys para provedores de IA (opcional para Ollama)

## 🔧 Configuração

### 1. Clone o repositório
```bash
git clone [repository-url]
cd screhelper
```

### 2. Instale as dependências
```bash
npm install
# ou
bun install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env.local` baseado no `.env.example`:

```bash
# DeepSeek API Configuration
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Google API Configuration (for Gemini)
GOOGLE_API_KEY=your_google_api_key_here
```

### 4. Inicie o servidor de desenvolvimento
```bash
npm run dev
# ou
bun dev
```

## 🤖 Provedores de IA

### Google Gemini (Cloud)
- Modelos: Gemini 1.5 Flash, Gemini 2.5 Flash, Gemini 2.0 Flash Lite
- Requer: API Key do Google AI Studio
- Características: Rápido, preciso, requer internet

### Ollama (Local)
- Modelos: Qualquer modelo compatible instalado localmente
- Requer: Ollama rodando na porta 8566
- Características: Privado, offline, sem custos por uso

### DeepSeek (Cloud) ⭐ **NOVO**
- Modelos: DeepSeek Chat, DeepSeek Coder, DeepSeek Reasoner
- Requer: API Key do DeepSeek
- Características: Custo-benefício, alta qualidade, especializado em raciocínio

📖 **Guia detalhado**: [docs/deepseek-integration.md](docs/deepseek-integration.md)

## 📖 Como Usar

1. **Configure Critérios**: Defina critérios de inclusão e exclusão para sua revisão
2. **Selecione Provider**: Escolha entre Gemini, Ollama ou DeepSeek
3. **Carregue Artigos**: Importe arquivo XLSX com colunas `title` e `abstract`
4. **Execute Análise**: Inicie a classificação automática
5. **Revise Resultados**: Examine e ajuste classificações manualmente se necessário
6. **Exporte**: Baixe os resultados em formato XLSX

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── deepseek/          # API routes para DeepSeek
│   │   ├── ollama/            # API routes para Ollama
│   │   └── gemini/            # Configuração Gemini
│   ├── components/ui/         # Componentes UI
│   └── page.tsx               # Página principal
├── components/
├── hooks/
└── lib/
docs/
├── deepseek-integration.md    # Guia DeepSeek
└── blueprint.md              # Documentação técnica
```

## 🔒 Privacidade e Segurança

- **Ollama**: Processamento 100% local, dados não saem da máquina
- **Gemini/DeepSeek**: Dados enviados para APIs externas (criptografados)
- **Armazenamento Local**: Critérios e preferências salvos no localStorage

## 🛠️ Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Inicia servidor de produção
npm run lint         # Executa linting
npm run typecheck    # Verificação de tipos TypeScript
```

## 📊 Exemplo de Uso

### Entrada (XLSX)
| title | abstract | doi | source |
|-------|----------|-----|--------|
| "Machine Learning in Healthcare" | "This study explores..." | "10.1000/example" | "Journal of AI" |

### Saída
| title | abstract | classification | reason | criterion | ai_include | ai_reason |
|-------|----------|----------------|--------|-----------|------------|-----------|
| "Machine Learning..." | "This study..." | "Include" | "Meets inclusion criteria..." | "Criterion 1: AI in healthcare" | true | "Discusses AI applications..." |

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 🆘 Suporte

- **DeepSeek**: [docs/deepseek-integration.md](docs/deepseek-integration.md)
- **Issues**: Use o sistema de issues do GitHub
- **Documentação**: Consulte a pasta `docs/`
