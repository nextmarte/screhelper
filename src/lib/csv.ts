import type { Article } from '@/lib/data';
import type { ClassifyArticleOutput } from '@/ai/flows/classify-article';

interface ClassifiedArticle extends Article {
    classification: ClassifyArticleOutput;
}

function escapeCsvCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function exportToCsv(articles: ClassifiedArticle[], criteria: {inclusion: string[], exclusion: string[]}) {
  const headers = ['Title', 'Abstract', 'Classification', 'Reason', 'Criterion'];
  const rows = articles.map(article => [
    escapeCsvCell(article.title),
    escapeCsvCell(article.abstract),
    article.classification.include ? 'Include' : 'Exclude',
    escapeCsvCell(article.classification.reason),
    escapeCsvCell(article.classification.criterion),
  ].join(','));

  const inclusionCriteria = criteria.inclusion.map(c => `- ${c}`).join('\n');
  const exclusionCriteria = criteria.exclusion.map(c => `- ${c}`).join('\n');

  const criteriaHeader = 'Applied Criteria';
  const inclusionHeader = 'Inclusion Criteria';
  const exclusionHeader = 'Exclusion Criteria';

  const csvContent = [
    `${criteriaHeader}`,
    `${inclusionHeader}`,
    `"${inclusionCriteria}"`,
    `${exclusionHeader}`,
    `"${exclusionCriteria}"`,
    '',
    headers.join(','),
    ...rows,
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'screhelper_classified_articles.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
