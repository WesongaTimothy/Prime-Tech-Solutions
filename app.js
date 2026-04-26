// Initialize Supabase Connection
const PROJECT_URL = 'https://lckgoavlepajidxheuhs.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_oxu8JU6KHI8ZSNi2kG_ciA_Kf2JYDmD';

const _supabase = supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);

/**
 * This function listens for real-time updates in your 'payments' table.
 * When a row is updated to status = 'success', the UI changes.
 */
function listenForPayment() {
    console.log("Connected! Prime Tech system is listening for payments...");

    _supabase
        .channel('payment-channel')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE', 
                schema: 'public',
                table: 'payments'
            },
            (payload) => {
                console.log('Change detected in database:', payload);
                
                // Check if the newly updated status is 'success'
                if (payload.new.status === 'success') {
                    displaySuccess();
                }
            }
        )
        .subscribe();
}

// Function to update the HTML on the screen
function displaySuccess() {
    const statusBox = document.getElementById('payment-status');
    statusBox.innerHTML = `
        <div class="status-success">
            <h2>✅ Success!</h2>
            <p>Your payment has been verified.</p>
            <p><strong>Order ID:</strong> #${Math.floor(Math.random() * 10000)}</p>
        </div>
    `;
}

// Start the listener
listenForPayment();
