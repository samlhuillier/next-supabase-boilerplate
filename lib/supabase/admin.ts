"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "../database.types";
import { createClient } from "@supabase/supabase-js";
export async function supabaseAdmin() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_ADMIN!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
    return supabase;
}
