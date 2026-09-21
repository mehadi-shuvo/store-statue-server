export type TopUpCompletionEmail = {
  to: string;
  customerName: string;
  orderNumber: string;
  game: string;
  packageName: string;
  dailySerial: number | null;
  completedAt: Date;
};

export interface EmailProvider {
  sendTopUpCompleted(payload: TopUpCompletionEmail): Promise<void>;
}
