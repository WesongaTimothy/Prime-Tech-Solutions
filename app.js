// 1. Configuration - Use your deployed function name
const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 
const BUSINESS_SHORTCODE = '174379'; // Set your Paybill/Till number here
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phoneInput = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualPaybill = document.getElementById('manualPaybill');
    const shortcodeDisplay = document.getElementById('displayShortcode');

    // Format phone: 07... to 2547...
    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // UI Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    msg.style.color = "blue";
    msg.innerText = "Requesting M-Pesa prompt...";

    try {
        // 2. Invoke 'hyper-service' to start the STK Push
        const { data, error } = await _supabase.functions.invoke('hyper-service', {
            body: { 
                phone: formattedPhone, 
                amount: amount 
            }
        });

        if (error) throw error;

        // Check if Safaricom accepted the request
        if (data?.ResponseCode === "0") {
            const checkoutId = data.CheckoutRequestID;
            msg.innerText = "Prompt sent! Enter your M-Pesa PIN on your phone.";
            
            // 3. Start Real-time Listener for the 'payments' table
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
                        // 'smooth-api' updates status to 'success' on payment
                        if (payload.new.status === 'success' || payload.new.status === 'Completed') {
                            overlay.style.display = 'flex';
                            _supabase.removeChannel(paymentSubscription);
                        }
                    }
                )
                .subscribe();

            // 4. Timeout Logic: If no update after 60 seconds, show manual option
            setTimeout(() => {
                if (overlay.style.display !== 'flex') {
                    msg.style.color = "orange";
                    msg.innerText = "Prompt not appearing? Use the manual details below.";
                    if(shortcodeDisplay) shortcodeDisplay.innerText = BUSINESS_SHORTCODE;
                    manualPaybill.style.display = "block";
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Retry STK Push';
                }
            }, 60000);

        } else {
            throw new Error(data?.CustomerMessage || "STK Push failed");
        }

    } catch (err) {
        // 5. On Failure: Show Manual Paybill Options immediately
        msg.style.color = "red";
        msg.innerText = "Could not start STK Push. Please pay manually.";
        if(shortcodeDisplay) shortcodeDisplay.innerText = BUSINESS_SHORTCODE;
        manualPaybill.style.display = "block"; 
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Retry Prompt';
        console.error("Payment Error:", err);
    }
});
