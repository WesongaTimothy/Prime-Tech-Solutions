/**
 * Prime Tech Solutions - Production Payment Logic
 * * This script manages the front-end M-Pesa integration:
 * 1. Sanitizes user input (Phone number formatting).
 * 2. Communicates with Supabase Edge Functions (hyper-service).
 * 3. Listens for real-time status updates from the callback (smooth-api).
 * 4. Provides a manual fallback if the automated prompt fails.
 */

// 1. Configuration
const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 

// Production Merchant Details
const BUSINESS_TILL = '5579946';       // Your Buy Goods Till
const FALLBACK_PAYBILL = '880100';    // Manual Paybill Number
const FALLBACK_ACCOUNT = '902232';    // Manual Account Number

// Initialize Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Handle Form Submission
 */
document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Element Selectors
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualDiv = document.getElementById('manualPaybill');
    const displayPaybill = document.getElementById('displayPaybill');
    const displayAccount = document.getElementById('displayAccount');
    
    // Input Data
    const phoneInput = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;

    /**
     * Data Normalization
     * Converts formats like 0712... or +254712... into 254712...
     */
    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // Initialize UI State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
    msg.style.color = "#003262"; // Corporate Blue
    msg.innerText = "Connecting to M-Pesa gateway...";
    manualDiv.style.display = "none"; // Hide manual options on new attempt

    try {
        /**
         * STAGE 1: Invoke 'hyper-service'
         * This calls the Supabase Edge Function which communicates with Safaricom.
         */
        const { data, error } = await _supabase.functions.invoke('hyper-service', {
            body: { 
                phone: formattedPhone, 
                amount: amount,
                tillNumber: BUSINESS_TILL // Passed to the backend initiator
            }
        });

        // Handle failure to trigger the STK Push
        if (error || data.ResponseCode !== "0") {
            throw new Error(data?.CustomerMessage || "STK Push Initialization Failed");
        }

        /**
         * STAGE 2: Success - Prompt Sent
         * The CheckoutRequestID is used to track the specific transaction.
         */
        const checkoutId = data.CheckoutRequestID;
        msg.style.color = "#10b981"; // M-Pesa Green
        msg.innerText = "Prompt sent! Please enter your PIN on your phone.";

        /**
         * STAGE 3: Real-time Listening
         * We open a WebSocket connection to listen for the status update 
         * sent by 'smooth-api' when the user completes the payment.
         */
        const channel = _supabase.channel('payment-status-monitor')
            .on(
                'postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'payments', 
                    filter: `checkout_id=eq.${checkoutId}` 
                }, 
                (payload) => {
                    // Check if the callback updated the status to success
                    if (payload.new.status === 'success' || payload.new.status === 'Completed') {
                        msg.innerText = "Payment Verified Successfully!";
                        overlay.style.display = 'flex'; // Show success screen
                        _supabase.removeChannel(channel); // Close connection
                    }
                }
            )
            .subscribe();

        /**
         * STAGE 4: Timeout Fallback
         * If the payment is not verified within 60 seconds, show manual details.
         */
        setTimeout(() => {
            if (overlay.style.display !== 'flex') {
                showManualFallback("Waiting for confirmation... If the prompt didn't appear, use manual details:");
                _supabase.removeChannel(channel);
            }
        }, 60000);

    } catch (err) {
        /**
         * STAGE 5: Global Error Handling
         * Triggers if the API fails, the phone is offline, or credentials are invalid.
         */
        showManualFallback("Automatic payment unavailable. Please pay manually using these details:");
        console.error("Payment Process Log:", err.message);
    }

    /**
     * Logic to display manual payment instructions
     */
    function showManualFallback(warningText) {
        msg.style.color = "#ef4444"; // Red
        msg.innerText = warningText;
        
        // Inject fallback Paybill and Account numbers
        if (displayPaybill) displayPaybill.innerText = FALLBACK_PAYBILL;
        if (displayAccount) displayAccount.innerText = FALLBACK_ACCOUNT;
        
        manualDiv.style.display = "block";
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-redo"></i> Retry M-Pesa Prompt';
    }
});

/**
 * Handle Overlay Closure
 */
function closeOverlay() {
    window.location.reload(); // Refresh to reset form state
}
