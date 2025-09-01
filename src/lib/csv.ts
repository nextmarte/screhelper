import * as XLSX from 'xlsx';

interface ClassifiedArticle {
  title: string;
  abstract: string;
  classification: {
    include: boolean;
    reason: string;
    criterion: string;
  };
  originalData?: Record<string, any>;
}

interface Criteria {
  inclusion: string[];
  exclusion: string[];
}

export function exportToXlsx(
  classifiedArticles: ClassifiedArticle[],
  criteria: Criteria,
  originalData?: Record<string, any>[]
): void {
  // Preparar os dados para exportação preservando todos os campos originais
  const exportData = classifiedArticles.map(article => {
    const originalRow = article.originalData || originalData?.find(original => 
      original.title === article.title && original.abstract === article.abstract
    ) || {};

    return {
      ...originalRow, // Preservar todos os campos originais
      classification: article.classification.include ? 'Include' : 'Exclude',
      reason: article.classification.reason,
      criterion: article.classification.criterion,
    };
  });

  // Criar uma nova planilha
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Criar um novo workbook
  const workbook = XLSX.utils.book_new();
  
  // Adicionar a planilha de resultados
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Classification Results');

  // Criar planilha com os critérios utilizados
  const criteriaData = [
    { type: 'Inclusion Criteria', criteria: '' },
    ...criteria.inclusion.map((criterion, index) => ({
      type: `${index + 1}.`,
      criteria: criterion
    })),
    { type: '', criteria: '' },
    { type: 'Exclusion Criteria', criteria: '' },
    ...criteria.exclusion.map((criterion, index) => ({
      type: `${index + 1}.`,
      criteria: criterion
    }))
  ];

  const criteriaWorksheet = XLSX.utils.json_to_sheet(criteriaData);
  XLSX.utils.book_append_sheet(workbook, criteriaWorksheet, 'Criteria Used');

  // Gerar nome do arquivo com timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `screhelper-results-${timestamp}.xlsx`;

  // Baixar o arquivo
  XLSX.writeFile(workbook, filename);
}

// Manter compatibilidade com código antigo (deprecated)
export function exportToCsv(
  classifiedArticles: ClassifiedArticle[],
  criteria: Criteria,
  originalData?: Record<string, any>[]
): void {
  console.warn('exportToCsv is deprecated, use exportToXlsx instead');
  exportToXlsx(classifiedArticles, criteria, originalData);
}
