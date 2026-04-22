export interface BusinessSettings {
  phoneNumber: string;
  missedCallSmsTemplate: string;
  googleReviewLink: string;
  autoReplyEnabled: boolean;
}

export interface CallLog {
  id: string;
  customerNumber: string;
  timestamp: any; // Firestore Timestamp
  status: 'missed' | 'responded' | 'settled';
  smsSent: boolean;
  notes?: string;
  reviewLinkSent?: boolean;
}
