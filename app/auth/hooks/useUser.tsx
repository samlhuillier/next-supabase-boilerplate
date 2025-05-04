"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { useQuery } from "@tanstack/react-query";

const initUser = {
  created_at: "",
  display_name: null,
  email: "",
  id: "",
  image_url: null,
  subscription: {
    created_at: "",
    customer_id: "",
    email: "",
    end_at: "",
    subscription_id: "",
  },
};

export const useUser = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.getSession();

      if (data.session?.user) {
        const { data: user } = await supabase
          .from("profiles")
          .select("*,subscription(*)")
          .eq("id", data.session.user.id)
          .single();
        return user;
      }
      return initUser;
    },
  });
};
