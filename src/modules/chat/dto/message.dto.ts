/* eslint-disable prettier/prettier */

class MessageSenderDto {
  id: number;
  name: string;
  avatar_url?: string;
}

export class MessageDto {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  sender: MessageSenderDto;
  roomId: number;
  channelId?: number;
}
