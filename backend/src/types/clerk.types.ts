export interface ClerkPublicMetadata {
  role?: string;
  adminId?: string | number;
  name?: string;
  phone?: string;
}

export interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

export interface ClerkPhoneNumber {
  id: string;
  phone_number: string;
}

export interface ClerkUserCreatedData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  phone_numbers: ClerkPhoneNumber[];
  primary_phone_number_id: string | null;
  public_metadata?: ClerkPublicMetadata;
}

export interface ClerkUserUpdatedData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
}

export interface ClerkUserDeletedData {
  id: string;
}

export type ClerkWebhookData = ClerkUserCreatedData | ClerkUserUpdatedData | ClerkUserDeletedData;
