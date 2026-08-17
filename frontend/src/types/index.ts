export interface User {
    id: string;
    email: string;
    username: string;
    full_name: string;
    role: 'admin' | 'user';
    created_at: string;
    last_login?: string;
    is_active?: boolean;
}

export interface Order {
    id: string;
    order_number: string;
    tracking_number: string;
    skus: string;
    quantity: number;
    dimensions: string | null;
    weight: number | null;
    status: 'PENDING' | 'SAVED' | 'SHIPPED' | 'ERROR';
    date_scanned: string;
    date_modified: string;
    scanned_by: string;
    source: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    username: string;
    password: string;
    fullName: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}