document.getElementById('stkPushForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const btn = document.getElementById('payBtn');
    const msg = document.getElementById('responseMessage');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    // This payload structure follows the Safaricom API requirements
    const payload = {
        "BusinessShortCode": "174379", // Default Sandbox Shortcode
        "Password": "MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMjUwOTI1MTI0NTE5",
        "Timestamp": "20250925124519",
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,
        "PartyA": phone,
        "PartyB": "174379",
        "PhoneNumber": phone,
        "CallBackURL": "https://yourdomain.com/mpesa-callback",
        "AccountReference": "PrimeTechOrder",
        "TransactionDesc": "Payment for Laptop"
    };

    try {
        const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_ACCESS_TOKEN_HERE',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.ResponseCode === "0") {
            msg.style.color = "green";
            msg.innerHTML = "STK Push sent! Please enter your PIN on your phone.";
        } else {
            msg.style.color = "red";
            msg.innerText = "Error: " + data.CustomerMessage;
        }
    } catch (error) {
        msg.style.color = "red";
        msg.innerText = "Failed to connect to Safaricom. Check your connection.";
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Pay Now via M-Pesa';
    }
});
