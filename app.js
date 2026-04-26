const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Manual Fallback Details
const FALLBACK_PAYBILL = '880100';
const FALLBACK_ACCOUNT = '902232';

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualDiv = document.getElementById('manualPaybill');
    const phone = document.getElementById('phone').value.replace(/^0/, '254').replace(/^\+/, '');
    const amount = document.getElementById('amount').value;

    btn.disabled = true;
    btn.innerHTML = 'Processing...';
    msg.innerText = "Requesting M-Pesa prompt...";

    try {
        // 1. Invoke hyper-service
        const { data, error } = await _supabase.functions.invoke('hyper-service', {
            body: { phone, amount }
        });

        if (error || data.ResponseCode !== "0") throw new Error("STK Push Failed");

        const checkoutId = data.CheckoutRequestID;
        msg.innerText = "Prompt sent! Enter your PIN.";

        // 2. Listen for status update in the payments table
        const channel = _supabase.channel('payment-status')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'payments', 
                filter: `checkout_id=eq.${checkoutId}` 
            }, (payload) => {
                // When smooth-api updates the status to success
                if (payload.new.status === 'success') {
                    overlay.style.display = 'flex';
                    _supabase.removeChannel(channel);
                }
            }).subscribe();

    } catch (err) {
        msg.style.color = "red";
        msg.innerText = "Error. Please use Paybill 880100 Acc 902232";
        manualDiv.style.display = 'block';
        btn.disabled = false;
    }
});
