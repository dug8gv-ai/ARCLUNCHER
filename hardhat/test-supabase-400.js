import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://sqqxexdepijsifmjfmut.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhleGRlcGlqc2lmbWpmbXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDE2MjMsImV4cCI6MjA5NDIxNzYyM30.BvhUQBFgm1RtDaAqkNGIyETT0Z-ZEXnGWRDoBcgoJog";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching token launches...");
  const { data: launches, error: lErr } = await supabase
    .from('token_launches')
    .select('token_address');
  
  if (lErr) {
    console.error("Launches error:", lErr);
    return;
  }
  
  const addresses = launches?.map(l => l.token_address) || [];
  console.log("Found token addresses:", addresses);
  
  console.log("Querying token_swaps with addresses...");
  const { data: swaps, error: sErr } = await supabase
    .from('token_swaps')
    .select('token_address,user_address,usdc_amount,token_amount,created_at')
    .in('token_address', addresses);
    
  if (sErr) {
    console.log("ERROR OCCURRED:");
    console.log("Message:", sErr.message);
    console.log("Details:", sErr.details);
    console.log("Hint:", sErr.hint);
    console.log("Code:", sErr.code);
  } else {
    console.log("SUCCESS! Found swaps count:", swaps?.length);
  }
}

main();
