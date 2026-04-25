export interface SerializedUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
}

export interface SerializedItem {
  id: string;
  text: string;
  status: "pending" | "done" | "failed";
  position: number;
  evaluatedAt: string | null;
  evaluatedByUser: SerializedUser | null;
}

export interface SerializedCard {
  id: string;
  title: string;
  description: string | null;
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string;
  statusOverride: "pending" | "in_progress" | "completed" | null;
  assignedToUser: SerializedUser;
  createdByUser: SerializedUser;
  items: SerializedItem[];
  createdAt: string;
  updatedAt: string;
}
