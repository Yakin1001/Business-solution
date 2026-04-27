export interface BusinessProfile {
  id: string;
  name: string;
  industry: string;
  missedCallSmsTemplate: string;
  googleReviewLink: string;
  surveyMessage: string;
}

export interface BusinessSettings {
  phoneNumber: string;
  autoReplyEnabled: boolean;
  preferredChannel: 'sms' | 'whatsapp';
  gatekeepingEnabled: boolean;
  activeProfileId?: string;
  profiles?: BusinessProfile[];
  // Deprecated fields kept for backward compatibility during migration
  missedCallSmsTemplate?: string;
  googleReviewLink?: string;
  surveyMessage?: string;
}

export interface CallLog {
  id: string;
  customerNumber: string;
  customerName?: string;
  timestamp: any;
  status: 'missed' | 'responded' | 'settled';
  smsSent: boolean;
  notes?: string;
  lastMessage?: string;
  reviewLinkSent?: boolean;
  rating?: number;
  channel?: 'sms' | 'whatsapp';
  gatekeepingStep?: 'none' | 'survey_sent' | 'link_sent' | 'feedback_received';
}
