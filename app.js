/**
 * Prime Tech Solutions - Production Payment Logic
 * Added: Query-before-error logic
 */

const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Manual Fallbacks
const FALLBACK_PAYBILL = '880100';
const FALLBACK_ACCOUNT = '902232';

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualDiv = document.getElementById('manualPaybill');
    const phoneInput = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;

    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // UI Reset
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    msg.style.color = "#003262";
    msg.innerText = "Requesting M-Pesa prompt...";

    try {
        // 1. Trigger STK Push
        const { data, error } = await _supabase.functions.invoke('hyper-service', {
            body: { phone: formattedPhone, amount: amount }
        });

        if (error || data.ResponseCode !== "0") throw new Error("Prompt failed");

        const checkoutId = data.CheckoutRequestID;
        msg.innerText = "Prompt sent! Waiting for your PIN...";

        // 2. Setup Real-time Listener (Primary)
        const channel = _supabase.channel('payment-status')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'payments', 
                filter: `checkout_id=eq.${checkoutId}` 
            }, (payload) => {
                if (payload.new.status === 'success' || payload.new.status === 'Completed') {
                    showSuccess();
                    _supabase.removeChannel(channel);
                }
            }).subscribe();

        // 3. Query Before Error (Secondary)
        // Wait 30 seconds, then actively query the status before giving up
        setTimeout(async () => {
            if (overlay.style.display !== 'flex') {
                msg.innerText = "Verifying transaction status...";
                
                const { data: queryData } = await _supabase.functions.invoke('hyper-service', {
                    body: { action: 'query', checkoutId: checkoutId }
                });

                if (queryData?.ResultCode === "0") {
                    showSuccess();
                } else {
                    showManual("Prompt not confirmed. You can pay manually:");
                }
            }
        }, 35000); // 35 seconds is the typical STK timeout

    } catch (err) {
        showManual("Connection failed. Please use manual payment:");
    }

    function showSuccess() {
        overlay.style.display = 'flex';
        msg.innerText = "Payment Confirmed!";
        msg.style.color = "green";
    }

    function showManual(warning) {
        msg.style.color = "#ef4444";
        msg.innerText = warning;
        document.getElementById('displayPaybill').innerText = FALLBACK_PAYBILL;
        document.getElementById('displayAccount').innerText = FALLBACK_ACCOUNT;
        manualDiv.style.display = "block";
        btn.disabled = false;
        btn.innerHTML = 'Retry M-Pesa Prompt';
    }
});
