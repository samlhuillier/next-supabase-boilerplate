import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  
  try {
    // Get the current user's session
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.redirect(`${origin}/auth?error=unauthorized`);
    }

    // Generate magic link using admin client
    const supabaseAdminClient = await supabaseAdmin();
    const { data: magicLink, error: magicLinkError } = await supabaseAdminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!
    });

    if (magicLinkError || !magicLink) {
      console.error('Error generating magic link:', magicLinkError);
      return NextResponse.redirect(`${origin}/auth?error=magic_link_failed`);
    }

    // Extract hashed_token from the magic link
    const hashed_token = magicLink.properties?.hashed_token;
    
    if (!hashed_token) {
      console.error('No hashed_token found in magic link');
      return NextResponse.redirect(`${origin}/auth?error=no_token`);
    }

    // Redirect to desktop app with hashed_token
    // You may need to customize this URI scheme based on your desktop app
    return NextResponse.redirect(`maurice://auth?hashed_token=${hashed_token}`);
    
  } catch (error) {
    console.error('Desktop auth error:', error);
    return NextResponse.redirect(`${origin}/auth?error=server_error`);
  }
} 