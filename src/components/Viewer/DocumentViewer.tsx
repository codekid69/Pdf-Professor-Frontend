import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  ArrowLeft, 
  FileText, 
  Globe, 
  Copy, 
  Download,
  CheckCircle,
  Languages,
  Search,
  Send
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Document {
  id: string;
  filename: string;
  file_path: string;
  original_text: string;
  translated_text: string;
  detected_language: string;
  processing_status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  parsed_fields?: Array<{
    id: string;
    document_id: string;
    field_name: string;
    original_value: string;
    translated_value: string;
    confidence_score: number;
    created_at: string;
  }>;
}

interface DocumentViewerProps {
  document: Document;
  onBack: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  document, 
  onBack 
}) => {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'original' | 'translated' | 'fields' | 'qa'>('translated');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Array<{
    buyer: string;
    seller: string;
    house_no: string | number;
    survey_no: string | number;
    document_no: string | number;
    date: string;
    value: string | number;
  }>>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    getPdfUrl();
  }, [document.id]);

  useEffect(() => {
    // Convert parsed_fields to transaction objects
    let transactions: any[] = [];
    if (document.parsed_fields && Array.isArray(document.parsed_fields)) {
      transactions = document.parsed_fields
        .filter(field => field.field_name === 'transaction')
        .map(field => {
          try {
            // Check if it's already an object or needs parsing
            if (typeof field.original_value === 'object') {
              return field.original_value;
            }
            return JSON.parse(field.original_value);
          } catch (e) {
            console.error('Error parsing transaction data:', e);
            return null;
          }
        })
        .filter(Boolean);
    }
    
    // Filter transactions based on search query
    if (transactions && transactions.length > 0) {
      if (!searchQuery) {
        setFilteredTransactions(transactions);
      } else {
        const filtered = transactions.filter(transaction => 
          Object.values(transaction).some(value => 
            value && value.toString().toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
        setFilteredTransactions(filtered);
      }
    } else {
      setFilteredTransactions([]);
    }
  }, [document.parsed_fields, searchQuery]);

  const getPdfUrl = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('pdfs')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (error) throw error;
      setPdfUrl(data.signedUrl);
    } catch (error) {
      console.error('Error getting PDF URL:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadTranslation = () => {
    const content = `Translation of ${document.filename}

Original Text:
${document.original_text}

Translated Text:
${document.translated_text}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const tempAnchor = window.document.createElement('a');
    tempAnchor.href = url;
    tempAnchor.download = `${document.filename}_translation.txt`;
    
    window.document.body.appendChild(tempAnchor);
    tempAnchor.click();
    window.document.body.removeChild(tempAnchor);
    
    URL.revokeObjectURL(url);
  };

  // Search within the original text
  const searchInOriginalText = useMemo(() => {
    if (!searchQuery || !document.original_text) return null;
    
    const index = document.original_text.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) return null;
    
    const start = Math.max(0, index - 50);
    const end = Math.min(document.original_text.length, index + searchQuery.length + 50);
    const excerpt = document.original_text.substring(start, end);
    
    return {
      excerpt,
      position: index
    };
  }, [searchQuery, document.original_text]);

  // Search within the translated text
  const searchInTranslatedText = useMemo(() => {
    if (!searchQuery || !document.translated_text) return null;
    
    const index = document.translated_text.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) return null;
    
    const start = Math.max(0, index - 50);
    const end = Math.min(document.translated_text.length, index + searchQuery.length + 50);
    const excerpt = document.translated_text.substring(start, end);
    
    return {
      excerpt,
      position: index
    };
  }, [searchQuery, document.translated_text]);

  // Handle Q&A submission
  const handleAskQuestion = async () => {
    if (!question.trim() || isAnswering) return;
    
    setIsAnswering(true);
    setAnswer('');
    
    try {
      const response = await fetch('http://localhost:3002/api/document-qna', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document.id,
          question: question.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get answer');
      }
      
      setAnswer(data.answer);
    } catch (error) {
      console.error('Error asking question:', error);
      setAnswer('Sorry, I encountered an error while processing your question. Please try again.');
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <Button variant="outline" onClick={onBack} size="sm" className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate max-w-[250px] sm:max-w-none">{document.filename}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={document.processing_status === 'completed' ? 'bg-green-100 text-green-800' : document.processing_status === 'processing' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                <CheckCircle className="h-3 w-3 mr-1" />
                {document.processing_status}
              </Badge>
              {document.detected_language && (
                <Badge variant="outline">
                  <Languages className="h-3 w-3 mr-1" />
                  {document.detected_language}
                </Badge>
              )}
              <span className="text-sm text-gray-500">
                Processed on {new Date(document.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {document.processing_status === 'completed' && (
            <Button variant="outline" onClick={downloadTranslation} size="sm" className="flex items-center">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download Translation</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Viewer */}
        <Card className="h-auto max-h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <FileText className="h-5 w-5 mr-2" />
              Original PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-grow">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-[520px] border-0"
                title={`PDF viewer for ${document.filename}`}
              />
            ) : (
              <div className="flex items-center justify-center h-[520px] bg-gray-50">
                <p className="text-gray-500">Loading PDF...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Viewer */}
        <Card className="h-auto max-h-[600px] flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <Globe className="h-5 w-5 mr-2" />
                Content
              </CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={activeTab === 'original' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('original')}
                >
                  Original
                </Button>
                <Button
                  variant={activeTab === 'translated' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('translated')}
                >
                  Translated
                </Button>
                {document.parsed_fields && document.parsed_fields.some(field => field.field_name === 'transaction') && (
                  <Button
                    variant={activeTab === 'fields' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('fields')}
                  >
                    Transactions
                  </Button>
                )}
                <Button
                  variant={activeTab === 'qa' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('qa')}
                >
                  Q&A
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-hidden">
            <div className="h-full overflow-y-auto">
              {activeTab === 'original' ? (
                <div className="h-full flex flex-col">
                  <div className="p-3 sm:p-4 border-b">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <h4 className="font-medium text-gray-900">Original Text (Tamil)</h4>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search in original text..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    {searchQuery && searchInOriginalText && (
                      <p className="text-sm text-gray-600 mt-2">
                        Found "{searchQuery}" at position {searchInOriginalText.position}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    <div className="flex justify-between items-center mb-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(document.original_text)}
                        className="flex items-center"
                      >
                        <Copy className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Copy All</span>
                      </Button>
                    </div>
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {document.original_text || 'No original text available'}
                      </p>
                    </div>
                    {searchQuery && searchInOriginalText && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm font-medium text-yellow-800">Search result:</p>
                        <p className="text-sm text-gray-700 mt-1">
                          ...{searchInOriginalText.excerpt}...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'translated' ? (
                <div className="h-full flex flex-col">
                  <div className="p-3 sm:p-4 border-b">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <h4 className="font-medium text-gray-900">Translated Text (English)</h4>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search in translated text..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    {searchQuery && searchInTranslatedText && (
                      <p className="text-sm text-gray-600 mt-2">
                        Found "{searchQuery}" at position {searchInTranslatedText.position}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    <div className="flex justify-between items-center mb-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(document.translated_text)}
                        className="flex items-center"
                      >
                        <Copy className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Copy All</span>
                      </Button>
                    </div>
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {document.translated_text || 'No translation available'}
                      </p>
                    </div>
                    {searchQuery && searchInTranslatedText && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm font-medium text-yellow-800">Search result:</p>
                        <p className="text-sm text-gray-700 mt-1">
                          ...{searchInTranslatedText.excerpt}...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'fields' ? (
                <div className="h-full flex flex-col">
                  <div className="p-3 sm:p-4 border-b">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <h4 className="font-medium text-gray-900">Extracted Transactions</h4>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search transactions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {(filteredTransactions || []).length} of {document.parsed_fields?.filter(field => field.field_name === 'transaction').length || 0} transactions
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    {(filteredTransactions || []).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">
                          {searchQuery ? 'No matching transactions found' : 'No transactions extracted'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(filteredTransactions || []).map((transaction, index) => (
                          <div key={index} className="border rounded-lg p-3 sm:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Buyer
                                </span>
                                <p className="text-sm text-gray-900">{transaction.buyer || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Seller
                                </span>
                                <p className="text-sm text-gray-900">{transaction.seller || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  House No
                                </span>
                                <p className="text-sm text-gray-900">{transaction.house_no || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Survey No
                                </span>
                                <p className="text-sm text-gray-900">{transaction.survey_no || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Document No
                                </span>
                                <p className="text-sm text-gray-900">{transaction.document_no || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Date
                                </span>
                                <p className="text-sm text-gray-900">{transaction.date || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Value
                                </span>
                                <p className="text-sm text-gray-900">{transaction.value || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="p-3 sm:p-4 border-b">
                    <h4 className="font-medium text-gray-900">Ask Questions About This Document</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Ask anything about the content of this document and get AI-powered answers
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Ask a question about this document..."
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAskQuestion();
                            }
                          }}
                          disabled={isAnswering}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleAskQuestion} 
                          disabled={isAnswering || !question.trim()}
                          className="flex items-center"
                        >
                          <Send className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Ask</span>
                        </Button>
                      </div>
                      
                      {isAnswering && (
                        <div className="flex items-center justify-center p-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-600">Analyzing document...</span>
                        </div>
                      )}
                      
                      {answer && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-lg">Answer</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap">{answer}</p>
                          </CardContent>
                        </Card>
                      )}
                      
                      <div className="mt-4 text-sm text-gray-500">
                        <p>Examples:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li>Who is the buyer in this document?</li>
                          <li>What is the transaction value?</li>
                          <li>When was this document signed?</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};