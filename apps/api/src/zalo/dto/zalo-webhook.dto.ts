export interface ZaloAttachmentPayload {
  url: string;
  name?: string;
  size?: number;
  type?: string;
}

export interface ZaloAttachment {
  type: "image" | "file" | "sticker" | "gif" | "audio" | "video";
  payload: ZaloAttachmentPayload;
}

export interface ZaloMessage {
  msg_id: string;
  text?: string;
  attachments?: ZaloAttachment[];
}

export interface ZaloSender {
  id: string;
  display_name?: string;
}

export interface ZaloWebhookPayload {
  app_id: string;
  user_id_by_app?: string;
  event_name: string;
  sender: ZaloSender;
  message: ZaloMessage;
  timestamp: number;
  mac?: string;
}
