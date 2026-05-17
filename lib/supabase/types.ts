export type UserRole = "superadmin" | "admin" | "user";
export type TransactionType = "payment" | "expense";
export type VoucherType = "cash" | "bank_transfer" | "check" | "card" | "other";

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  profit: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerTransaction = {
  id: string;
  client_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  voucher_type: VoucherType;
  date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientFinancialSummary = {
  client_id: string;
  total_payments: number;
  total_expenses: number;
  balance: number;
};

export type ClientWithSummary = Client & {
  total_payments: number;
  total_expenses: number;
  balance: number;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          cash_advance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          cash_advance?: number;
        };
        Update: {
          full_name?: string;
          role?: UserRole;
          cash_advance?: number;
        };
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: {
          name: string;
          phone?: string | null;
          email?: string | null;
          profit?: number | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          email?: string | null;
          profit?: number | null;
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
      transactions: {
        Row: LedgerTransaction;
        Insert: {
          client_id: string;
          type: TransactionType;
          amount: number;
          description: string;
          voucher_type?: VoucherType;
          date?: string;
          created_by?: string | null;
        };
        Update: {
          type?: TransactionType;
          amount?: number;
          description?: string;
          voucher_type?: VoucherType;
          date?: string;
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
            foreignKeyName: "transactions_created_by_fkey",
            columns: ["created_by"],
            isOneToOne: false,
            referencedRelation: "users",
            referencedColumns: ["id"],
          },
        ],
      },
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
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      transaction_type: TransactionType;
      voucher_type: VoucherType;
    };
    CompositeTypes: Record<string, never>;
  };
};
