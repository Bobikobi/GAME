/** Small GitHub data shapes shared by the loop rules and orchestration. */
export interface Label {
  name: string;
}

export interface User {
  login: string;
  type?: string;
}

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at?: string;
  state?: string;
  labels: Label[];
  user: User;
  reactions?: { '+1': number };
  pull_request?: unknown;
}

export interface PullRequest extends Issue {
  draft: boolean;
  head: { sha: string; repo: { full_name: string } | null };
  merged_at?: string | null;
}

export interface Review {
  user: User | null;
  state: string;
  commit_id: string;
  submitted_at?: string;
  id?: number;
}

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
}

export interface ChangedFile {
  filename: string;
  status?: string;
}

export interface Comment {
  id: number;
  body: string;
  user?: User;
  created_at?: string;
  html_url?: string;
}

export interface Reaction {
  user: User;
  created_at: string;
}

export interface Account extends User {
  created_at: string;
}
