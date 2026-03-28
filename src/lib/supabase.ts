import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface AuditLead {
  id?: string;
  business_name: string;
  business_type: string;
  city: string | null;
  email: string;
  created_at?: string;
  report_sent: boolean;
  in_claude: boolean;
  in_chatgpt: boolean;
  competitors: string[];
  geo_score: number;
}

export async function createAuditLead(lead: Omit<AuditLead, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("audit_leads")
    .insert([lead])
    .select()
    .single();

  if (error) {
    console.error("Error creating audit lead:", error);
    throw error;
  }

  return data;
}

export async function updateAuditLead(
  id: string,
  updates: Partial<AuditLead>
) {
  const { data, error } = await supabase
    .from("audit_leads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating audit lead:", error);
    throw error;
  }

  return data;
}
