const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const phone = document.getElementById('phone').value.replace(/^0/, '254').replace(/^\+/, '');
    const amount = document.getElementById('amount').value;

    btn.disabled = true;
    msg.innerText = "Requesting M-Pesa prompt...";

    // 1. Call your Edge Function
    const { data, error } = await _supabase.functions.invoke('hyper-service', {
        body: { phone, amount }
    });

    if (error || data.ResponseCode !== "0") {
        msg.innerText = "Error: Check your phone or network.";
        document.getElementById('manualPaybill').style.display = "block";
        btn.disabled = false;
        return;
    }

    const checkoutId = data.CheckoutRequestID;
    msg.innerText = "Enter PIN on your phone...";

    // 2. Listen for the 'success' update in the DB
    const channel = _supabase.channel('payment-check')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'payments', 
            filter: `checkout_id=eq.${checkoutId}` 
        }, (payload) => {
            if (payload.new.status === 'success') {
                document.getElementById('successOverlay').style.display = 'flex';
                msg.innerText = "Payment Confirmed!";
                _supabase.removeChannel(channel);
            }
        }).subscribe();
});
