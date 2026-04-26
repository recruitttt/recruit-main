export type RecruiterStatus = "active" | "applied" | "departed";

export type RecruiterRecord = {
  _id: string;
  userId: string;
  jobId: string;
  companyName: string;
  companyDomain?: string;
  recruiterName: string;
  appearanceSeed: number;
  positionIndex: number;
  status: RecruiterStatus;
  companyContext?: string;
  contextFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  role: "user" | "recruiter" | "tool";
  content: string;
  timestamp: string;
  toolCalls?: unknown[];
};

export type BrainstormedAnswer = {
  questionType: string;
  answer: string;
  extractedAt: string;
};

export type RecruiterChatContext = {
  recruiter: RecruiterRecord;
  userProfileSummary: string;
  tailoredResumeSummary: string;
  personalizationSummary: string;
  conversationHistory: ConversationMessage[];
};
