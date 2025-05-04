import { supabaseBrowser } from "@/lib/supabase/browser";
import { useEffect } from "react";
export default function Post() {
  const getPost = async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.from("post").select("*");
    console.log("data: ", data);
  };

  useEffect(() => {
    getPost();
  }, []);

  return (
    <div>
      <h1>This is protected data</h1>
    </div>
  );
}
