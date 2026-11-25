export type DocumentAnalysisStatus = 'PENDING'|'PROCESSING'|'COMPLETED'|'REVIEW_REQUIRED'|'CONFIRMED'|'FAILED'|'SKIPPED';
export type ExtractedFieldName = 'category'|'title'|'documentDate'|'documentNumber'|'issuer'|'subtotal'|'taxAmount'|'totalAmount'|'currency'|'expiryDate'|'brand'|'model'|'serialNumber'|'description';
export type FieldConfidence = 'HIGH'|'MEDIUM'|'LOW';
export interface ExtractedDocumentField {
  name: ExtractedFieldName;
  value: string;
  confidence: FieldConfidence;
  sourceText: string|null;
  pageNumber: number|null;
}
export type AnalysisSuggestionType = 'CREATE_ITEM'|'LINK_ITEM'|'LINK_CONTAINER'|'LINK_LOCATION'|'POSSIBLE_DUPLICATE';
export type AnalysisSuggestionStatus = 'PENDING'|'ACCEPTED'|'DISMISSED';
export interface DocumentAnalysisRecord {
  id: string;
  documentId: string;
  attachmentId: string|null;
  status: DocumentAnalysisStatus;
  engine: string;
  language: string|null;
  extractedText: string|null;
  errorMessage: string|null;
  createdAt: string;
  completedAt: string|null;
}
export interface DocumentAnalysisSuggestion {
  id: string;
  analysisId: string;
  type: AnalysisSuggestionType;
  payload: Record<string, unknown>;
  confidence: FieldConfidence;
  status: AnalysisSuggestionStatus;
  createdAt: string;
}
export interface DocumentTextAnalysis {
  category: string;
  fields: ExtractedDocumentField[];
  suggestions: Array<Omit<DocumentAnalysisSuggestion,'id'|'analysisId'|'createdAt'|'status'>>;
}
