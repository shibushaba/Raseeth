export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'OWNER' | 'SALESMAN'
export type MovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN'
export type PriceType = 'RETAIL' | 'WHOLESALE' | 'CUSTOM'
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          product_code: string
          name: string
          description: string | null
          category: string | null
          /** NUMERIC(12,2) — prefer string to avoid float drift */
          purchase_price: string
          avg_unit_cost: string
          retail_price: string
          wholesale_price: string
          current_quantity: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_code?: string
          name: string
          description?: string | null
          category?: string | null
          purchase_price: string | number
          avg_unit_cost?: string | number
          retail_price: string | number
          wholesale_price: string | number
          current_quantity?: number
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_code?: string
          name?: string
          description?: string | null
          category?: string | null
          purchase_price?: string | number
          avg_unit_cost?: string | number
          retail_price?: string | number
          wholesale_price?: string | number
          current_quantity?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          product_id: string
          movement_type: MovementType
          quantity: number
          unit_cost: string | null
          reference_id: string | null
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          movement_type: MovementType
          quantity: number
          unit_cost?: string | number | null
          reference_id?: string | null
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          movement_type?: MovementType
          quantity?: number
          unit_cost?: string | number | null
          reference_id?: string | null
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_movements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          id: string
          sale_number: string
          total_amount: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          sale_number?: string
          total_amount: string | number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          sale_number?: string
          total_amount?: string | number
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sales_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: string
          /** Inventory cost (WAC) at sale time; null = legacy / unavailable */
          unit_cost: string | null
          price_type: PriceType
          total_amount: string
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: string | number
          unit_cost?: string | number | null
          price_type: PriceType
          total_amount: string | number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          quantity?: number
          unit_price?: string | number
          unit_cost?: string | number | null
          price_type?: PriceType
          total_amount?: string | number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_items_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          id: string
          sale_id: string
          payment_method: PaymentMethod
          amount: string
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          payment_method: PaymentMethod
          amount: string | number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          payment_method?: PaymentMethod
          amount?: string | number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      returns: {
        Row: {
          id: string
          return_number: string
          sale_id: string
          total_amount: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          return_number?: string
          sale_id: string
          total_amount: string | number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          return_number?: string
          sale_id?: string
          total_amount?: string | number
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'returns_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'returns_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      return_items: {
        Row: {
          id: string
          return_id: string
          sale_item_id: string
          product_id: string
          quantity: number
          unit_price: string
          /** Inventory cost from original sale_item; null = legacy / unavailable */
          unit_cost: string | null
          total_amount: string
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          sale_item_id: string
          product_id: string
          quantity: number
          unit_price: string | number
          unit_cost?: string | number | null
          total_amount: string | number
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          sale_item_id?: string
          product_id?: string
          quantity?: number
          unit_price?: string | number
          unit_cost?: string | number | null
          total_amount?: string | number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'return_items_return_id_fkey'
            columns: ['return_id']
            isOneToOne: false
            referencedRelation: 'returns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'return_items_sale_item_id_fkey'
            columns: ['sale_item_id']
            isOneToOne: false
            referencedRelation: 'sale_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'return_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      refunds: {
        Row: {
          id: string
          return_id: string
          payment_id: string | null
          refund_method: PaymentMethod
          amount: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          payment_id?: string | null
          refund_method: PaymentMethod
          amount: string | number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          payment_id?: string | null
          refund_method?: PaymentMethod
          amount?: string | number
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'refunds_return_id_fkey'
            columns: ['return_id']
            isOneToOne: true
            referencedRelation: 'returns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'refunds_payment_id_fkey'
            columns: ['payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'refunds_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          message: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          message: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          message?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_receiver_id_fkey'
            columns: ['receiver_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      create_product: {
        Args: {
          p_name: string
          p_description?: string | null
          p_category?: string | null
          p_purchase_price?: number
          p_retail_price?: number
          p_wholesale_price?: number
          p_initial_quantity?: number
        }
        Returns: Database['public']['Tables']['products']['Row']
      }
      create_sale: {
        Args: {
          p_items: Json
          p_payments: Json
        }
        Returns: Database['public']['Tables']['sales']['Row']
      }
      create_return: {
        Args: {
          p_items: Json
          p_refund_method: PaymentMethod
        }
        Returns: Database['public']['Tables']['returns']['Row']
      }
      add_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_unit_cost: number
          p_notes?: string | null
        }
        Returns: Database['public']['Tables']['inventory_movements']['Row']
      }
      adjust_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_reason: string
        }
        Returns: Database['public']['Tables']['inventory_movements']['Row']
      }
      seed_demo_catalog: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_today_sales_summary: {
        Args: {
          p_day_start: string
          p_day_end: string
        }
        Returns: Json
      }
      get_business_summary: {
        Args: {
          p_range_start: string
          p_range_end: string
        }
        Returns: Json
      }
      get_business_pulse: {
        Args: {
          p_range_start: string
          p_range_end: string
        }
        Returns: Json
      }
      get_top_products: {
        Args: {
          p_range_start: string
          p_range_end: string
          p_limit?: number
        }
        Returns: Json
      }
      get_inventory_summary: {
        Args: Record<string, never>
        Returns: Json
      }
      get_unread_message_count: {
        Args: Record<string, never>
        Returns: number
      }
      mark_messages_read: {
        Args: Record<string, never>
        Returns: number
      }
      send_business_message: {
        Args: {
          p_message: string
        }
        Returns: Database['public']['Tables']['messages']['Row']
      }
      current_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
      is_owner: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_salesman: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_staff: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      movement_type: MovementType
      price_type: PriceType
      payment_method: PaymentMethod
    }
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type InventoryMovement =
  Database['public']['Tables']['inventory_movements']['Row']
export type Sale = Database['public']['Tables']['sales']['Row']
export type SaleItem = Database['public']['Tables']['sale_items']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type SaleReturn = Database['public']['Tables']['returns']['Row']
export type ReturnItem = Database['public']['Tables']['return_items']['Row']
export type Refund = Database['public']['Tables']['refunds']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
