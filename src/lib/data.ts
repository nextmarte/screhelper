export interface Article {
  title: string;
  abstract: string;
  doi?: string; // Adicionar campo DOI opcional
  source?: string; // Adicionar campo source opcional
}

export const sampleArticles: Article[] = [
  {
    title: "The role of gut microbiota in neurodegenerative diseases",
    abstract: "Recent studies have highlighted the significant impact of the gut microbiome on central nervous system health. This review explores the bidirectional communication between the gut and the brain, known as the gut-brain axis, and its implications for neurodegenerative disorders such as Alzheimer's and Parkinson's disease. We discuss the mechanisms through which microbial dysbiosis may contribute to neuroinflammation and disease progression."
  },
  {
    title: "Quantum computing algorithms for drug discovery",
    abstract: "Quantum computing holds the promise of revolutionizing pharmaceutical research. This paper reviews current quantum algorithms applicable to drug discovery, focusing on molecular simulation and optimization problems. We assess the potential for quantum machines to accelerate the identification of novel therapeutic candidates, overcoming limitations of classical computing methods. The study is purely theoretical and does not involve clinical trials."
  },
  {
    title: "Impact of Climate Change on Coral Reef Ecosystems",
    abstract: "This study investigates the effects of rising sea temperatures and ocean acidification on coral reef health. Through a meta-analysis of data from 2000 to 2020, we demonstrate a clear correlation between climate change indicators and coral bleaching events. The research focuses exclusively on Pacific Ocean reefs and does not consider freshwater ecosystems."
  },
  {
    title: "A novel approach for pediatric cancer treatment using immunotherapy",
    abstract: "Immunotherapy has emerged as a powerful tool in oncology. This clinical trial investigates the efficacy of a novel CAR-T cell therapy in a cohort of pediatric patients with relapsed acute lymphoblastic leukemia. The trial was conducted over a period of three years and involved participants aged 5-15. Initial results show a promising remission rate."
  },
];
