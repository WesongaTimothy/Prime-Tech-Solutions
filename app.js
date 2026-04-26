 * Prime Tech Solutions - Integrated Production Logic
 * Features: Automatic STK Push, Real-time Listening, and Status Querying
 */

// 1. Configuration & Credentials
const SHORT_CODE = "4567781"; 
const TILL_NUMBER = "5579946"; 
const PASSKEY = "da40e8bb04a5582aefd5e5c20ce09ddee2480857923938ce7ad6f34b57ed0293";
const CONSUMER_KEY = "gM5CI0F7HfetgUdH4DAAjqbgEYMX24YR5gTzZvid6kRfdEFM";
const CONSUMER_SECRET = "sovbFHDXKhb7oAS32NauMPTCMnlyVuR9bzCyHFQBgqLMnXxk5oeOIi7GIhMS5hLG";

const SUPABASE_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD'; 

// Manual Fallbacks (If API is completely down)
const FALLBACK_PAYBILL = '880100';
const FALLBACK_ACCOUNT = '902232';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('stkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Elements
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('msg');
    const overlay = document.getElementById('successOverlay');
    const manualDiv = document.getElementById('manualPaybill');
    const phoneInput = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;

    // Standardize Phone: 07... -> 2547...
    const formattedPhone = phoneInput.replace(/^0/, '254').replace(/^\+/, '');

    // Reset UI State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    msg.style.color = "#003262";
    msg.innerText = "Connecting to Safaricom...";

    try {
        // ---------------------------------------------------------
        // STEP 1: Get Access Token & Initialize STK Push
        // ---------------------------------------------------------
        const auth = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
        const tokenRes = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: { Authorization: `Basic ${auth}` }
        });
        const { access_token } = await tokenRes.json();

        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = btoa(SHORT_CODE + PASSKEY + timestamp);

        const mpesaRes = await fetch("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            method: "POST",
            headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                "BusinessShortCode": SHORT_CODE,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerBuyGoodsOnline", // Mandatory for Tills
                "Amount": Math.round(amount),
                "PartyA": formattedPhone,
                "PartyB": TILL_NUMBER,
                "PhoneNumber": formattedPhone,
                "CallBackURL": "https://lckgoavlepajidxheuhs.supabase.co/functions/v1/smooth-api",
                "AccountReference": "PrimeTech",
                "TransactionDesc": "Payment"
            })
        });

        const mpesaData = await mpesaRes.json();

        if (mpesaData.ResponseCode !== "0") throw new Error(mpesaData.CustomerMessage || "Push failed");

        const checkoutId = mpesaData.CheckoutRequestID;
        msg.style.color = "#10b981";
        msg.innerText = "Prompt sent! Enter your M-Pesa PIN.";

        // ---------------------------------------------------------
        // STEP 2: Start Real-time Database Listener
        // ---------------------------------------------------------
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

        // ---------------------------------------------------------
        // STEP 3: Active Query Safety Net (The "Wait and Check")
        // ---------------------------------------------------------
        setTimeout(async () => {
            if (overlay.style.display !== 'flex') {
                msg.style.color = "orange";
                msg.innerText = "Verifying payment with Safaricom...";
                
                // Active Query to Safaricom status endpoint
                const queryRes = await fetch("https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        "BusinessShortCode": SHORT_CODE,
                        "Password": password,
                        "Timestamp": timestamp,
                        "CheckoutRequestID": checkoutId
                    })
                });

                const queryData = await queryRes.json();

                if (queryData.ResultCode === "0") {
                    showSuccess();
                } else {
                    showManual("Payment could not be confirmed. You can pay manually:");
                }
            }
        }, 35000); // 35 seconds timeout

    } catch (err) {
        showManual("Automated service currently unavailable. Please pay manually:");
        console.error("Payment Flow Error:", err);
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
        btn.innerHTML = '<i class="fas fa-redo"></i> Retry M-Pesa Prompt';
    }
});
