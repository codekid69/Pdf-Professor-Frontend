import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          file_path: string;
          original_text: string;
          translated_text: string;
          detected_language: string;
          processing_status: 'processing' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      parsed_fields: {
        Row: {
          id: string;
          document_id: string;
          field_name: string;
          original_value: string;
          translated_value: string;
          confidence_score: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['parsed_fields']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['parsed_fields']['Insert']>;
      };
    };
  };
};