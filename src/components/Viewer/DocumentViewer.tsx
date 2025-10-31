import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  Search
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
  parsed_data?: Array<{
    buyer: string;
    seller: string;
    house_no: string | number;
    survey_no: string | number;
    document_no: string | number;
    date: string;
    value: string | number;
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
  const [parsedFields, setParsedFields] = useState<Document['parsed_data']>([]);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'original' | 'translated' | 'fields'>('translated');
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Document['parsed_data']>([]);

  useEffect(() => {
    fetchParsedFields();
    getPdfUrl();
  }, [document.id]);

  useEffect(() => {
    // Filter transactions based on search query
    if (document.parsed_data && Array.isArray(document.parsed_data)) {
      if (!searchQuery) {
        setFilteredTransactions(document.parsed_data);
      } else {
        const filtered = document.parsed_data.filter(transaction => 
          Object.values(transaction).some(value => 
            value && value.toString().toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
        setFilteredTransactions(filtered);
      }
    } else {
      setFilteredTransactions([]);
    }
  }, [document.parsed_data, searchQuery]);

  const fetchParsedFields = async () => {
    try {
      const { data, error } = await supabase
        .from('parsed_fields')
        .select('*')
        .eq('document_id', document.id)
        .order('field_name');

      if (error) throw error;
      setParsedFields(data || []);
    } catch (error) {
      console.error('Error fetching parsed fields:', error);
    }
  };

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
      // You might want to add a toast notification here
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
    
    // Create a temporary anchor element using the global document object
    const tempAnchor = window.document.createElement('a');
    tempAnchor.href = url;
    tempAnchor.download = `${document.filename}_translation.txt`;
    
    // Append to body, click, and remove
    window.document.body.appendChild(tempAnchor);
    tempAnchor.click();
    window.document.body.removeChild(tempAnchor);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{document.filename}</h1>
            <div className="flex items-center space-x-2 mt-1">
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
            <Button variant="outline" onClick={downloadTranslation}>
              <Download className="h-4 w-4 mr-2" />
              Download Translation
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Viewer */}
        <Card className="h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Original PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
        <Card className="h-[600px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                Content
              </CardTitle>
              <div className="flex space-x-1">
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
                {document.parsed_data && document.parsed_data.length > 0 && (
                  <Button
                    variant={activeTab === 'fields' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('fields')}
                  >
                    Transactions
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[520px] overflow-y-auto">
              {activeTab === 'original' ? (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <h4 className="font-medium text-gray-900">Original Text (Tamil)</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex justify-between items-center mb-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(document.original_text)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {document.original_text || 'No original text available'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'translated' ? (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <h4 className="font-medium text-gray-900">Translated Text (English)</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex justify-between items-center mb-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(document.translated_text)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {document.translated_text || 'No translation available'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Extracted Transactions</h4>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search transactions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {(filteredTransactions || []).length} of {document.parsed_data?.length || 0} transactions
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {(filteredTransactions || []).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">
                          {searchQuery ? 'No matching transactions found' : 'No transactions extracted'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(filteredTransactions || []).map((transaction, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};