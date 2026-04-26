/**
 * Prime Tech Solutions - Production Payment Logic
 * Handles M-Pesa STK Push and Real-time Status Updates
 */

// 1. Configuration
const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 

// Production Payment Details
const BUSINESS_TILL = '5579946';       // Your Till Number
const FALLBACK_PAYBILL = '880100';    // Manual Paybill fallback
const FALLBACK_ACCOUNT = '902232';    // Manual Account fallback

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Elements
    const phoneInput = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualDiv = document.getElementById('manualPaybill');
    const displayPaybill = document.getElementById('displayPaybill');
    const displayAccount = document.getElementById('displayAccount');

    // Format phone: 07... to 2547...
    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // UI Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    msg.style.color = "#003262"; // Berkeley Blue
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
            msg.style.color = "green";
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
                        // If status is updated to success, show the success overlay
                        if (payload.new.status === 'success' || payload.new.status === 'Completed') {
                            overlay.style.display = 'flex';
                            _supabase.removeChannel(paymentSubscription);
                        }
                    }
                )
                .subscribe();

            // 4. Timeout Logic: Show manual option after 60 seconds
            setTimeout(() => {
                if (overlay.style.display !== 'flex') {
                    showManualFallback("Prompt taking too long? You can pay manually below.");
                }
            }, 60000);

        } else {
            throw new Error(data?.CustomerMessage || "STK Push failed");
        }

    } catch (err) {
        // 5. On Failure: Show the specific Manual Paybill 880100 immediately
        showManualFallback("Could not start automatic prompt. Please pay manually.");
        console.error("Payment Error:", err);
    }

    /**
     * Helper function to display manual payment details
     */
    function showManualFallback(warningText) {
        msg.style.color = "red";
        msg.innerText = warningText;
        
        // Populate the specific numbers requested
        if(displayPaybill) displayPaybill.innerText = FALLBACK_PAYBILL;
        if(displayAccount) displayAccount.innerText = FALLBACK_ACCOUNT;
        
        manualDiv.style.display = "block";
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Retry Prompt';
    }
});
