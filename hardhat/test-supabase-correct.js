import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://sqqxexdepijsifmjfmut.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhleGRlcGlqc2lmbWpmbXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDE2MjMsImV4cCI6MjA5NDIxNzYyM30.BvhUQBFgm1RtDaAqkNGIyETT0Z-ZEXnGWRDoBcgoJog";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Querying token_swaps with timestamp...");
  const { data, error } = await supabase
    .from('token_swaps')
    .select('token_address,user_address,usdc_amount,token_amount,timestamp')
    .in('token_address', ['0x073a7932cf8e963068bbb678da03704d5cb91413']);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("SUCCESS! Row count:", data?.length);
  }
}

main();
