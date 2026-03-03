export interface FullEnrichWebhookContactInfo {
  most_probable_work_email?: {
    email: string;
    status: string;
  };
  most_probable_personal_email?: {
    email: string;
    status: string;
  };
  most_probable_phone?: {
    number: string;
    region: string;
  };
  work_emails?: Array<{ email: string; status: string }>;
  personal_emails?: Array<{ email: string; status: string }>;
  phones?: Array<{ number: string; region: string }>;
}

export interface FullEnrichWebhookProfile {
  id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  location?: {
    country?: string;
    country_code?: string;
    city?: string;
    region?: string;
  };
  employment?: {
    company_name?: string;
    company_domain?: string;
    job_title?: string;
    seniority?: string;
    start_date?: string;
    current?: {
        title: string;
        company: {
        name: string;
    }
    start_at: string;
    }
  };
  social_profiles?: {
    linkedin_url?: string;
    twitter_url?: string;
    facebook_url?: string;
  };
}

export interface FullEnrichWebhookData {
  input?: {
    first_name?: string;
    last_name?: string;
    linkedin_url?: string;
  };
  custom?: {
    personId?: string;
    [key: string]: any;
  };
  contact_info?: FullEnrichWebhookContactInfo;
  profile?: FullEnrichWebhookProfile;
}

export interface FullEnrichWebhookPayload {
  id: string;
  name: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  cost?: {
    credits: number;
  };
  data: FullEnrichWebhookData[];
}
