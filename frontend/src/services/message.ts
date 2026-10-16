export interface MediaItem {
  name: string;
  kind: string;
  preview: string;
}

export interface Message {
  sender: "user" | "bro";
  text: string;
  files?: string[];
  media?: MediaItem[];
}