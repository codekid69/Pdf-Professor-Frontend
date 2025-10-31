require('dotenv/config');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const franc = require('franc');
const pdfParse = require('pdf-parse');
const pLimit = require('p-limit');
const retry = require('async-retry');

const PORT = process.env.PORT || 3002;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'pdfs';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// --- Language detection ---
const langMap = { tam: 'ta', hin: 'hi', eng: 'en' };
function detectLangISO1(text) {
  if (!text || text.trim().length < 20) return 'auto';
  const code3 = franc.franc(text, { minLength: 20 });
  return langMap[code3] || 'auto';
}

// --- Gemini API helper with retry ---
async function callGemini(prompt) {
  return await retry(
    async (bail) => {
      const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status < 500) bail(new Error(txt));
        throw new Error(`Gemini ${res.status}: ${txt}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    },
    { retries: 2, minTimeout: 800, maxTimeout: 2000 }
  );
}

// ------------------------
//  PDF Extraction
// ------------------------
async function extractTextFromBuffer(buf) {
  try {
    // Convert Buffer to Uint8Array as required by pdf-parse
    const uint8Array = new Uint8Array(buf);
    const parser = new pdfParse.PDFParse(uint8Array);
    const res = await parser.getText();
    return res.text?.trim() || '';
  } catch (err) {
    console.error('❌ Error extracting text from PDF:', err);
    throw err;
  }
}

// --- Chunk management ---
function chunkText(text, size = 15000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

// --- Faster translation batching ---
async function translateToEnglish(text, sourceLang = 'auto') {
  if (!text) return '';
  const chunks = chunkText(text);
  const limit = pLimit.default(6); // 🔥 six concurrent requests
  const isTamil = sourceLang === 'ta' || sourceLang === 'auto';

  console.log(`📝 Starting translation of ${chunks.length} chunks`);
  
  const tasks = chunks.map((chunk, idx) =>
    limit(async () => {
      const prompt = isTamil
        ? `Translate this Tamil legal/property text accurately to English.
           Preserve numbers and formatting. Do not add commentary.
           ---
           ${chunk}`
        : `Translate this ${sourceLang} text to English accurately.
           ---
           ${chunk}`;
      console.log(`🌐 Translating chunk ${idx + 1}/${chunks.length}`);
      const result = await callGemini(prompt);
      console.log(`✅ Completed translation of chunk ${idx + 1}/${chunks.length}`);
      return result;
    })
  );

  const results = await Promise.allSettled(tasks);
  const translatedChunks = results.map((r, idx) => {
    if (r.status === 'fulfilled') {
      console.log(`📦 Chunk ${idx + 1} translation successful`);
      return r.value;
    } else {
      console.error(`❌ Chunk ${idx + 1} translation failed:`, r.reason);
      return '';
    }
  });
  
  const finalResult = translatedChunks.join('\n').trim();
  console.log(`🎉 Translation completed. Final text length: ${finalResult.length}`);
  return finalResult;
}

// --- Field extraction ---
async function extractTransactionFields(translatedText) {
  console.log(`🔍 Starting field extraction. Text length: ${translatedText.length}`);
  
  const prompt = `Extract real estate transaction data as a JSON array.
  Fields: buyer, seller, house_no, survey_no, document_no, date (YYYY-MM-DD), value.
  Return valid JSON only.
  ---
  ${translatedText}`;

  const response = await callGemini(prompt);
  console.log(`🔍 Field extraction response received. Length: ${response.length}`);
  
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    console.log(`🔍 Attempting to parse JSON. Clean text length: ${clean.length}`);
    const json = JSON.parse(clean);
    console.log(`✅ Field extraction successful. Found ${Array.isArray(json) ? json.length : 0} transactions`);
    return Array.isArray(json) ? json : [];
  } catch (error) {
    console.error(`❌ Field extraction failed. Error: ${error.message}`);
    console.error(`🔍 Response text: ${response.substring(0, 500)}...`);
    return [];
  }
}

// --- Filter helper ---
function filterTransactions(transactions, q) {
  return transactions.filter((t) => {
    return (
      (!q.buyer || t.buyer?.toLowerCase().includes(q.buyer.toLowerCase())) &&
      (!q.seller || t.seller?.toLowerCase().includes(q.seller.toLowerCase())) &&
      (!q.houseNumber || t.house_no?.includes(q.houseNumber)) &&
      (!q.surveyNumber || t.survey_no?.includes(q.surveyNumber)) &&
      (!q.documentNumber || t.document_no?.includes(q.documentNumber))
    );
  });
}

// --- Main route ---
app.post('/api/process-document', async (req, res) => {
  const { documentId, filePath, ...filters } = req.body || {};
  if (!documentId || !filePath)
    return res.status(400).json({ error: 'documentId and filePath required' });

  try {
    console.log(`⚙️ Processing document ${documentId}`);
    await supabaseAdmin
      .from('documents')
      .update({ processing_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(filePath);
    if (error) throw error;
    const buf = Buffer.from(await data.arrayBuffer());
    console.log(`📥 Downloaded PDF. Buffer size: ${buf.length} bytes`);

    const originalText = await extractTextFromBuffer(buf);
    console.log(`📄 Extracted text. Length: ${originalText.length}`);
    
    const detected = detectLangISO1(originalText);
    console.log(`🈯 Detected language: ${detected}`);

    const translated = await translateToEnglish(originalText, detected);
    console.log(`🌐 Translation completed. Length: ${translated.length}`);
    
    const transactions = await extractTransactionFields(translated);
    console.log(`📊 Extracted ${transactions.length} transactions`);
    
    const filtered = filterTransactions(transactions, filters);
    console.log(`🔍 Filtered to ${filtered.length} transactions`);

    // Store the full text and parsed data
    await supabaseAdmin
      .from('documents')
      .update({
        original_text: originalText, // Store full text, not just first 10000 characters
        translated_text: translated, // Store full text, not just first 10000 characters
        detected_language: detected,
        parsed_data: filtered, // Store the extracted transactions
        processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    console.log(`✅ Document ${documentId} processing completed successfully`);
    res.json({
      message: '✅ Document processed',
      detected_language: detected,
      chunks_translated: Math.ceil(originalText.length / 15000),
      transaction_count: filtered.length
    });
  } catch (err) {
    console.error('❌ process-document failed:', err);
    await supabaseAdmin
      .from('documents')
      .update({
        processing_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.body?.documentId);
    res.status(500).json({ error: err.message });
  }
});

// --- Search endpoint ---
app.get('/api/search-documents', async (req, res) => {
  const { 
    query, 
    buyer, 
    seller, 
    houseNumber, 
    surveyNumber, 
    documentNumber,
    userId
  } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    let dbQuery = supabaseAdmin
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .eq('processing_status', 'completed');

    // Text search in translated text
    if (query) {
      dbQuery = dbQuery.or(
        `filename.ilike.%${query}%,translated_text.ilike.%${query}%`
      );
    }

    // Filter by transaction fields if document has parsed_data
    if (buyer || seller || houseNumber || surveyNumber || documentNumber) {
      // For now, we'll return all documents and let the frontend filter
      // In a production environment, you might want to store transaction data in a separate table
    }

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error) throw error;

    // Additional filtering on parsed_data if needed
    let filteredData = data;
    if (buyer || seller || houseNumber || surveyNumber || documentNumber) {
      filteredData = data.filter(doc => {
        if (!doc.parsed_data || !Array.isArray(doc.parsed_data)) return true;
        
        return doc.parsed_data.some(transaction => {
          return (
            (!buyer || (transaction.buyer && transaction.buyer.toLowerCase().includes(buyer.toLowerCase()))) &&
            (!seller || (transaction.seller && transaction.seller.toLowerCase().includes(seller.toLowerCase()))) &&
            (!houseNumber || (transaction.house_no && transaction.house_no.toString().includes(houseNumber))) &&
            (!surveyNumber || (transaction.survey_no && transaction.survey_no.toString().includes(surveyNumber))) &&
            (!documentNumber || (transaction.document_no && transaction.document_no.toString().includes(documentNumber)))
          );
        });
      });
    }

    res.json(filteredData);
  } catch (err) {
    console.error('❌ search-documents failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) =>
  res.json({ status: 'OK', at: new Date().toISOString() })
);
app.listen(PORT, () =>
  console.log(`🚀 PDF Processing Server running on port ${PORT}`)
);
