// REPLACE with your actual Supabase credentials from your Dashboard
const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');

    // UI Loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
    msg.style.color = "blue";
    msg.innerText = "Please check your phone for the M-Pesa prompt.";

    try {
        // 1. Invoke your Supabase Edge Function to handle the M-Pesa logic securely
        const { data, error } = await _supabase.functions.invoke('mpesa-stk-push', {
            body: { 
                phone: phone, 
                amount: amount, 
                account: "902232",
                shortcode: "4567781" // Your Daraja Shortcode
            }
        });

        if (error) throw error;

        if (data.ResponseCode === "0") {
            const checkoutId = data.CheckoutRequestID;

            // 2. REAL-TIME: Listen for the payment confirmation in the database
            const paymentSubscription = _supabase
                .channel('payment-updates')
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'payments', filter: `checkout_id=eq.${checkoutId}` },
                    (payload) => {
                        if (payload.new.status === 'Completed') {
                            overlay.style.display = 'flex';
                            _supabase.removeChannel(paymentSubscription);
                        }
                    }
                )
                .subscribe();
        } else {
            msg.style.color = "red";
            msg.innerText = data.CustomerMessage;
            btn.disabled = false;
        }

    } catch (err) {
        msg.style.color = "red";
        msg.innerText = "Connection failed. Please use manual Paybill.";
        btn.disabled = false;
        console.error(err);
    }
});
