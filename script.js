let db;

document.addEventListener("DOMContentLoaded", async () => {

  const buttonContainer = document.getElementById("onepay-btn");


  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDGxd3PoP01JN25cPXfgRsVoc-C6XE2FTk",
    authDomain: "spemai-global.firebaseapp.com",
    projectId: "spemai-global",
    storageBucket: "spemai-global.appspot.com",
    messagingSenderId: "864345120875",
    appId: "1:864345120875:web:d33dbc1b2b02f8098dd12e",
  };

  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

    // Initialize Firestore and assign it to the global db variable
  db = firebase.firestore();

  if (buttonContainer && typeof onePayData !== "undefined") {
    const { appid, hashToken, amount, orderReference } = onePayData;

    const payButton = document.createElement("button");
    payButton.innerText = "Pay Now";
    buttonContainer.appendChild(payButton);

    // Prepare data object
    const data = {
      currency: "LKR",
      amount: 100.00,
      app_id: "80NR1189D04CD635D8ACD",
      reference: "7Q1M1187AE",
      customer_first_name: "Johe",
      customer_last_name: "Dohe",
      customer_phone_number: "+94771234567",
      customer_email: "viduladakshitha@gmail.com",
      transaction_redirect_url: "https://www.google.com.au",
      additional_data: "vidula",
    };

    // Add event listener to generate hash and trigger payment
    payButton.addEventListener("click", async () => {
      try {
        const hash = await generateSHA256Hash(data, 'GR2P1189D04CD635D8AFD');
        data.hash = hash; // Add the computed hash to data payload
        triggerPayAPI(data);
      } catch (error) {
        console.error("Error generating hash:", error);
      }
    });
  } else {
    console.error("Button container or onePayData not found.");
  }
});

// Function to generate SHA256 hash
async function generateSHA256Hash(data, hashsalt) {
  // Concatenate values without separators
  const payloadString = `${data.app_id}${data.currency}100.00${hashsalt}`;
  console.log("String to hash:", payloadString);

  // Convert string to ArrayBuffer
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(payloadString);

  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

  // Convert hash to hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Function to trigger the pay API
function triggerPayAPI(payload) {
  console.log("Triggering Pay API with payload:", payload);

  fetch("https://onepay-api-manager-uat-dot-spemai-asia.el.r.appspot.com/v3/checkout/link/", { // Replace with your actual API endpoint
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "ca00d67bf74d77b01fa26dc6780d7ff9522d8f82d30ff813d4c605f2662cea9ad332054cc66aff68.EYAW1189D04CD635D8B20",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Payment API response:", data);
      if (data.data.gateway.redirect_url) {
        // Create an iframe to open the URL
        const iframe = document.createElement("iframe");
        iframe.src = data.data.gateway.redirect_url;
        iframe.style.width = "100%";
        iframe.style.height = "500px"; // Adjust height as needed
        iframe.style.border = "none";
        
        // Append iframe to the DOM
        const iframeContainer = document.getElementById("iframe-container");
        if (iframeContainer) {
          iframeContainer.innerHTML = ""; // Clear any existing content
          iframeContainer.appendChild(iframe);
        } else {
          console.error("Iframe container not found.");
        }
	onComplete(data.data.ipg_transaction_id)
      } else {
        alert("Failed to retrieve redirect URL from API response.");
      }
    })
    .catch((error) => {
      console.error("Error triggering Pay API:", error);
      alert("Failed to initiate payment. Please try again.");
    });
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}



function onComplete(transID) {
listenToTransaction("00S0118E73FCB588AAB69")
}


function listenToTransaction(transactionId) {

if (!db) {
    console.error("Firestore (db) is not initialized!");
    return;
  }

  const docRef = db.collection("onepay").doc("transaction");
console.log("hi",docRef)
  
  const unsubscribe = docRef.onSnapshot((doc) => {
console.log("hi1",doc)
    if (doc.exists) {
      const data = doc.data();
      const transactionData = data[transactionId];
console.log("hi2",data)
      if (transactionData) {
        const response = {
          is_loading: transactionData.is_loading || false,
          is_pay: transactionData.is_pay || false,
          is_authenticated: transactionData.is_authenticate || false,
          transaction_id: transactionId,
        };
console.log(response)
	return response;
              }
    } else {
      console.error("Document not found!");
    }
  });


}


