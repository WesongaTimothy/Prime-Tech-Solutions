// Configuration
const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phoneInput = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualPaybill = document.getElementById('manualPaybill'); // Add this ID to your manual paybill div

    // Format phone: 07... to 2547...
    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // UI Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    msg.style.color = "blue";
    msg.innerText = "Initializing M-Pesa prompt...";

    try {
        // 1. Invoke the Edge Function
        const { data, error } = await _supabase.functions.invoke('mpesa-stk-push', {
            body: { phone: formattedPhone, amount: amount }
        });

        if (error) throw error;

        if (data?.ResponseCode === "0") {
            const checkoutId = data.CheckoutRequestID;
            msg.innerText = "Prompt sent! Please enter your M-Pesa PIN.";
            
            // 2. Start Real-time Listener
            const paymentSubscription = _supabase
                .channel('payment-updates')
                .on(
                    'postgres_changes',
                    { 
                        event: 'UPDATE', 
                        schema: 'public', 
                        table: 'payments', 
                        filter: `checkout_id=eq.${checkoutId}` 
                    },
                    (payload) => {
                        if (payload.new.status === 'Completed' || payload.new.status === 'success') {
                            overlay.style.display = 'flex';
                            _supabase.removeChannel(paymentSubscription);
                        }
                    }
                )
                .subscribe();

            // 3. Timeout Logic: If no update after 60 seconds, show manual option
            setTimeout(() => {
                if (overlay.style.display !== 'flex') {
                    msg.style.color = "orange";
                    msg.innerText = "Still waiting? If you didn't get a prompt, try the manual Paybill below.";
                    manualPaybill.style.display = "block";
                    btn.disabled = false;
                    btn.innerText = "Try STK Push Again";
                }
            }, 60000);

        } else {
            throw new Error(data?.CustomerMessage || "STK Push failed");
        }

    } catch (err) {
        // 4. On Failure: Show Manual Paybill Options
        msg.style.color = "red";
        msg.innerText = "STK Push failed to start.";
        manualPaybill.style.display = "block"; // Shows the Paybill details
        btn.disabled = false;
        btn.innerText = "Retry M-Pesa Prompt";
        console.error("Payment Error:", err);
    }
});
