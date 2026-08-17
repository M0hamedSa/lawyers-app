export type UserRole = "superadmin" | "admin" | "user";
export type UserStatus = "active" | "closed";
export type TransactionType = "payment" | "expense" | "profit" | "office";
export type VoucherType = "cash" | "bank_transfer" | "receipt" | "card" | "other";
export type ProfitType = "monthly" | "per_case";
export type CasePriority = "low" | "medium" | "high" | "urgent";

export const NOTIFICATIONS_PAGE_SIZE = 30;

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  profit_type: ProfitType;
  profit: number | null;
  status: "active" | "inactive";
  monthly_payment_day: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Case = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: CasePriority;
  profit_amount: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseAssignee = {
  id: string;
  case_id: string;
  user_id: string;
  full_name: string;
  assigned_by: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  case_id: string;
  case_title: string;
  case_status: string;
  priority: CasePriority;
  client_id: string;
  client_name: string;
  user_id: string;
  user_name: string;
  assigned_by: string | null;
  assigned_by_name: string | null;
  created_at: string;
};

export type LedgerTransaction = {
  id: string;
  client_id: string;
  case_id: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  voucher_type: VoucherType;
  date: string;
  created_by: string | null;
  is_cleared?: boolean;
  created_at: string;
  updated_at: string;
};

export type CashAdvance = {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientFinancialSummary = {
  client_id: string;
  total_payments: number;
  total_expenses: number;
  total_profit: number;
  balance: number;
};

export type CaseFinancialSummary = {
  case_id: string;
  client_id: string;
  total_payments: number;
  total_expenses: number;
  balance: number;
};

export type ClientWithSummary = Client & {
  total_payments: number;
  total_expenses: number;
  total_profit: number;
  balance: number;
  creator_name?: string | null;
};

export type CaseWithSummary = Case & {
  total_payments: number;
  total_expenses: number;
  balance: number;
  assignees: { id: string; full_name: string }[];
};

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string;
  type: string;
  transaction_id: string | null;
  transaction_type: TransactionType | null;
  amount: number | null;
  client_id: string | null;
  client_name: string | null;
  case_id: string | null;
  case_title: string | null;
  priority: CasePriority | null;
  is_read: boolean;
  cleared_at: string | null;
  created_at: string;
};

export type CaseFile = {
  id: string;
  case_id: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  mega_node_id: string;
  mega_parent_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          status: UserStatus;
          cash_advance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          status?: UserStatus;
          cash_advance?: number;
        };
        Update: {
          full_name?: string;
          role?: UserRole;
          status?: UserStatus;
          cash_advance?: number;
        };
        Relationships: [];
      };
      cash_advances: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          description: string | null;
          date: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          description?: string | null;
          date?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          amount?: number;
          description?: string | null;
          date?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_advances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_advances_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      clients: {
        Row: Client;
        Insert: {
          name: string;
          phone?: string | null;
          email?: string | null;
          profit_type?: ProfitType;
          profit?: number | null;
          status?: "active" | "inactive";
          monthly_payment_day?: number | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          email?: string | null;
          profit_type?: ProfitType;
          profit?: number | null;
          status?: "active" | "inactive";
          monthly_payment_day?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: Case;
        Insert: {
          client_id: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: CasePriority;
          profit_amount?: number | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: string;
          priority?: CasePriority;
          profit_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      case_assignees: {
        Row: {
          id: string;
          case_id: string;
          user_id: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          case_id: string;
          user_id: string;
          assigned_by?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "case_assignees_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_assignees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_assignees_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: LedgerTransaction;
        Insert: {
          client_id: string;
          case_id?: string | null;
          type: TransactionType;
          amount: number;
          description: string;
          voucher_type?: VoucherType;
          date?: string;
          created_by?: string | null;
          is_cleared?: boolean;
        };
        Update: {
          case_id?: string | null;
          type?: TransactionType;
          amount?: number;
          description?: string;
          is_profit_transaction?: boolean | null;
          voucher_type?: VoucherType;
          date?: string;
          is_cleared?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey",
            columns: ["client_id"],
            isOneToOne: false,
            referencedRelation: "clients",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "transactions_case_id_fkey",
            columns: ["case_id"],
            isOneToOne: false,
            referencedRelation: "cases",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "transactions_created_by_fkey",
            columns: ["created_by"],
            isOneToOne: false,
            referencedRelation: "users",
            referencedColumns: ["id"],
          },
        ],
      },
      case_files: {
        Row: CaseFile;
        Insert: {
          case_id: string;
          filename: string;
          file_size: number;
          mime_type?: string | null;
          mega_node_id: string;
          mega_parent_id?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          filename?: string;
          file_size?: number;
          mime_type?: string | null;
          mega_node_id?: string;
          mega_parent_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "case_files_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      client_access: {
        Row: {
          user_id: string,
          client_id: string,
          created_at: string,
        },
        Insert: {
          user_id: string,
          client_id: string,
        },
        Update: {
          user_id?: string,
          client_id?: string,
        },
        Relationships: [
          {
            foreignKeyName: "client_access_user_id_fkey",
            columns: ["user_id"],
            isOneToOne: false,
            referencedRelation: "users",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "client_access_client_id_fkey",
            columns: ["client_id"],
            isOneToOne: false,
            referencedRelation: "clients",
            referencedColumns: ["id"],
          },
        ],
      },
      notifications: {
        Row: AppNotification;
        Insert: {
          user_id: string;
          actor_id?: string | null;
          actor_name: string;
          type?: string;
          transaction_id?: string | null;
          transaction_type?: TransactionType | null;
          amount?: number | null;
          client_id?: string | null;
          client_name?: string | null;
          case_id?: string | null;
          case_title?: string | null;
          priority?: CasePriority | null;
          is_read?: boolean;
        };
        Update: {
          is_read?: boolean;
          cleared_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
    },
    Views: {
      client_financial_summary: {
        Row: ClientFinancialSummary;
        Relationships: [
          {
            foreignKeyName: "client_financial_summary_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      case_financial_summary: {
        Row: CaseFinancialSummary;
        Relationships: [
          {
            foreignKeyName: "case_financial_summary_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: true;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      transaction_type: TransactionType;
      voucher_type: VoucherType;
      profit_type: ProfitType;
      case_priority: CasePriority;
    };
    CompositeTypes: Record<string, never>;
  };
};
