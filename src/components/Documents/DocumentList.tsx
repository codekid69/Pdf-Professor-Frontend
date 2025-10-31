import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  FileText, 
  Eye, 
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  RefreshCw,
  Search
} from 'lucide-react';

interface DocumentRecord {
  id: string;
  filename: string;
  file_path: string;
  original_text: string;
  translated_text: string;
  detected_language: string;
  processing_status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  transactions?: Array<{
    id: string;
    buyer: string | null;
    seller: string | null;
    house_no: string | null;
    survey_no: string | null;
    document_no: string | null;
    transaction_date: string | null;
    value: string | null;
  }>;
}

interface DocumentListProps {
  onDocumentSelect: (document: DocumentRecord) => void;
  refreshTrigger: number;
}

interface TransactionFilters {
  buyer?: string;
  seller?: string;
  houseNumber?: string;
  surveyNumber?: string;
  documentNumber?: string;
}

export const DocumentList: React.FC<DocumentListProps> = ({ 
  onDocumentSelect, 
  refreshTrigger 
}) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          parsed_fields(*),
          transactions(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      setFilteredDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch documents on mount and when refreshTrigger changes
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  // Apply filters when they change
  useEffect(() => {
    if (Object.keys(filters).length === 0) {
      setFilteredDocuments(documents);
      return;
    }

    // Filter documents based on transaction data
    const filtered = documents.filter(doc => {
      if (!doc.transactions || doc.transactions.length === 0) return false;
      
      return doc.transactions.some(transaction => {
        if (filters.buyer && transaction.buyer && !transaction.buyer.toLowerCase().includes(filters.buyer.toLowerCase())) {
          return false;
        }
        if (filters.seller && transaction.seller && !transaction.seller.toLowerCase().includes(filters.seller.toLowerCase())) {
          return false;
        }
        if (filters.houseNumber && transaction.house_no && !transaction.house_no.includes(filters.houseNumber)) {
          return false;
        }
        if (filters.surveyNumber && transaction.survey_no && !transaction.survey_no.includes(filters.surveyNumber)) {
          return false;
        }
        if (filters.documentNumber && transaction.document_no && !transaction.document_no.includes(filters.documentNumber)) {
          return false;
        }
        return true;
      });
    });

    setFilteredDocuments(filtered);
  }, [documents, filters]);

  // Set up real-time subscription for document updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to document changes
    const channel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Document updated:', payload);
          // Refresh the document list when a document is updated
          fetchDocuments();
        }
      )
      .subscribe();

    setSubscription(channel);

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, fetchDocuments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
  };

  const handleFilterChange = (filterName: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value || undefined
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Filter Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer</label>
              <Input
                placeholder="Filter by buyer name"
                value={filters.buyer || ''}
                onChange={(e) => handleFilterChange('buyer', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller</label>
              <Input
                placeholder="Filter by seller name"
                value={filters.seller || ''}
                onChange={(e) => handleFilterChange('seller', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">House Number</label>
              <Input
                placeholder="Filter by house number"
                value={filters.houseNumber || ''}
                onChange={(e) => handleFilterChange('houseNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Survey Number</label>
              <Input
                placeholder="Filter by survey number"
                value={filters.surveyNumber || ''}
                onChange={(e) => handleFilterChange('surveyNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Number</label>
              <Input
                placeholder="Filter by document number"
                value={filters.documentNumber || ''}
                onChange={(e) => handleFilterChange('documentNumber', e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setFilters({})}
              disabled={Object.keys(filters).length === 0}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Your Documents ({filteredDocuments.length})
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
            <p className="text-gray-500">
              {Object.keys(filters).length > 0 
                ? "No documents match your filter criteria" 
                : "Get started by uploading your first document"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onDocumentSelect(doc)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{doc.filename}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      doc.processing_status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : doc.processing_status === 'processing' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-red-100 text-red-800'
                    }
                  >
                    {doc.processing_status === 'completed' ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : doc.processing_status === 'processing' ? (
                      <Clock className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1" />
                    )}
                    {doc.processing_status}
                  </Badge>
                </div>
                
                {doc.transactions && doc.transactions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="font-medium">{doc.transactions.length}</span>
                      <span className="mx-1">•</span>
                      <span>transaction{doc.transactions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};