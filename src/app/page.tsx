'use client';

import { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';

import { classifyArticle, ClassifyArticleOutput } from '@/ai/flows/classify-article';
import { sampleArticles, type Article } from '@/lib/data';
import { exportToCsv } from '@/lib/csv';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, XCircle, FlaskConical, FileDown, TestTube2, BrainCircuit, Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const criteriaSchema = z.object({
  inclusionCriteria: z.array(z.object({ value: z.string().min(1, 'Criterion cannot be empty.') })).min(1, 'At least one inclusion criterion is required.'),
  exclusionCriteria: z.array(z.object({ value: z.string().min(1, 'Criterion cannot be empty.') })).min(1, 'At least one exclusion criterion is required.'),
});

type CriteriaFormValues = z.infer<typeof criteriaSchema>;

interface ClassifiedArticle extends Article {
  classification: ClassifyArticleOutput;
}

export default function ScreenerPage() {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<{ inclusion: string[], exclusion: string[] } | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [classifiedArticles, setClassifiedArticles] = useState<ClassifiedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function onCriteriaSubmit(data: CriteriaFormValues) {
    const formattedCriteria = {
      inclusion: data.inclusionCriteria.map(c => c.value),
      exclusion: data.exclusionCriteria.map(c => c.value),
    };
    setCriteria(formattedCriteria);
    setClassifiedArticles([]);
    toast({
      title: "Criteria Set",
      description: "You can now load your articles for screening.",
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
        if (typeof data === 'string') {
          // This should not happen with readAsBinaryString
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
        
        if (lowercasedJson.length > 0 && (!lowercasedJson[0].hasOwnProperty('title') || !lowercasedJson[0].hasOwnProperty('abstract'))) {
            toast({ variant: 'destructive', title: 'Error', description: 'File must contain "title" and "abstract" columns.' });
            return;
        }

        const parsedArticles = lowercasedJson.map(row => ({
            title: row.title || '',
            abstract: row.abstract || '',
        })).filter(a => a.title && a.abstract);
        
        setArticles(parsedArticles);
        toast({ title: "File parsed successfully.", description: `${parsedArticles.length} articles loaded.`});
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to read file.' });
    }
    reader.readAsBinaryString(file);
  }

  async function handleRunAnalysis() {
    if (!criteria || articles.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please set criteria and load articles before running analysis.",
      });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setClassifiedArticles([]);
    const results: ClassifiedArticle[] = [];

    for (let i = 0; i < articles.length; i++) {
      try {
        const article = articles[i];
        const classification = await classifyArticle({
          title: article.title,
          abstract: article.abstract,
          inclusionCriteria: criteria.inclusion,
          exclusionCriteria: criteria.exclusion,
        });
        results.push({ ...article, classification });
        setProgress(((i + 1) / articles.length) * 100);
      } catch (error) {
        console.error("Error classifying article:", error);
        toast({
          variant: "destructive",
          title: "Analysis Error",
          description: `An error occurred while classifying article ${i + 1}.`,
        });
        setIsLoading(false);
        return;
      }
    }

    setClassifiedArticles(results);
    setIsLoading(false);
    toast({
        title: "Analysis Complete",
        description: "All articles have been classified.",
    });
  }
  
  const showDataCard = !!criteria;
  const showAnalysisButton = showDataCard && articles.length > 0 && !isLoading && classifiedArticles.length === 0;
  const showResults = classifiedArticles.length > 0 && !isLoading;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8 font-body">
      <header className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">ScreHelper</h1>
        <p className="text-lg text-muted-foreground mt-2">AI-Powered Screening for Scientific Literature Reviews</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TestTube2 className="text-primary" />Define Criteria</CardTitle>
            <CardDescription>Set your inclusion and exclusion criteria. The AI will use these to classify articles.</CardDescription>
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
              <CardFooter>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Set Criteria</Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        
        <div className="space-y-8">
            <Card className={`w-full transition-opacity duration-500 ${showDataCard ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FlaskConical className="text-accent" />Load Articles</CardTitle>
                    <CardDescription>Upload an XLSX/XLS file or use our sample set. The file must have 'title' and 'abstract' columns.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center w-full">
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-2 text-muted-foreground"/>
                                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                <p className="text-xs text-muted-foreground">XLSX or XLS file</p>
                            </div>
                            <Input id="file-upload" ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                        </label>
                        {fileName && <p className="mt-2 text-sm text-muted-foreground">Loaded file: {fileName}</p>}
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full" variant="secondary">Upload File</Button>
                    <Button onClick={handleLoadSampleData} className="w-full" variant="outline">Use Sample Data</Button>
                </CardFooter>
            </Card>

            {showAnalysisButton && (
                <div className="text-center transition-opacity duration-500">
                    <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleRunAnalysis}>
                        <BrainCircuit className="mr-2 h-5 w-5" /> Run AI Analysis ({articles.length} Articles)
                    </Button>
                </div>
            )}
        </div>
      </div>

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
        </Card>
      )}

      {showResults && (
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Classification Results</CardTitle>
              <CardDescription>Review the AI's classification for each article.</CardDescription>
            </div>
            <Button onClick={() => exportToCsv(classifiedArticles, criteria!)} className="mt-4 md:mt-0">
              <FileDown className="mr-2 h-4 w-4" /> Export to CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Title</TableHead>
                    <TableHead className="w-[150px]">Classification</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classifiedArticles.map((article, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell>
                        <Badge variant={article.classification.include ? 'default' : 'destructive'} className={article.classification.include ? 'bg-green-600' : ''}>
                          {article.classification.include ? 'Include' : 'Exclude'}
                        </Badge>
                      </TableCell>
                      <TableCell>{article.classification.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
