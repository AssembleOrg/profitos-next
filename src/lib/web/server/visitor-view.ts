import { phonePromptFor, type PhonePrompt } from "../phone-prompt";

export type VisitorView = {
  name: string | null;
  email: string;
  picture: string | null;
  hasPhone: boolean;
  firstTime: boolean;
  prompt: PhonePrompt;
  favorites: string[];
};

type Row = {
  name: string | null;
  email: string;
  pictureUrl: string | null;
  phone: string | null;
  phoneAskCount: number;
  phoneLastAskedAt: Date | null;
  loginCount: number;
  favorites: unknown;
};

export function toVisitorView(row: Row): VisitorView {
  return {
    name: row.name,
    email: row.email,
    picture: row.pictureUrl,
    hasPhone: Boolean(row.phone),
    firstTime: row.loginCount <= 1,
    prompt: phonePromptFor(row),
    favorites: Array.isArray(row.favorites) ? (row.favorites as string[]) : [],
  };
}
