// REPLACE with your actual Supabase credentials from your Dashboard
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

    // 1. Rectify Phone Number Format (Ensures 07... becomes 2547...)
    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // UI Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
    msg.style.color = "blue";
    msg.innerText = "Please check your phone for the M-Pesa prompt.";

    try {
        // 2. Invoke the Supabase Edge Function
        // We use the rectified body format you requested
        const { data, error } = await _supabase.functions.invoke('mpesa-stk-push', {
            body: { 
                phone: formattedPhone, 
                amount: amount 
            }
        });

        if (error) throw error;

        // 3. Handle the Response
        if (data?.ResponseCode === "0") {
            const checkoutId = data.CheckoutRequestID;
            console.log("Prompt sent! CheckoutID:", checkoutId);
            msg.innerText = "Prompt sent! Enter your PIN on your phone to complete payment.";

            // 4. REAL-TIME: Listen for the payment confirmation in the 'payments' table
            // This assumes your Edge Function or Callback creates/updates a record here
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
                        // Check if the status has changed to 'Completed'
                        if (payload.new.status === 'Completed' || payload.new.result_code === 0) {
                            overlay.style.display = 'flex';
                            msg.innerText = "Payment Successful!";
                            _supabase.removeChannel(paymentSubscription);
                        }
                    }
                )
                .subscribe();

        } else {
            // Handle Safaricom-specific errors (e.g., invalid phone number)
            msg.style.color = "red";
            msg.innerText = data?.CustomerMessage || "Request failed. Please try again.";
            btn.disabled = false;
            btn.innerText = "Try Again";
        }

    } catch (err) {
        // Handle connection or system errors
        msg.style.color = "red";
        msg.innerText = "Connection failed. Please check your internet or try manual Paybill.";
        btn.disabled = false;
        btn.innerText = "Pay Now";
        console.error("M-Pesa Error:", err);
    }
});
