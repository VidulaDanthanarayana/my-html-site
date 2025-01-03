// We'll store db here once Firebase initializes
let db;
let backdrop;
// Wait until DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
await loadFirebaseScripts();

  // Grab the button container
  const buttonContainer = document.getElementById("onepay-btn");

  // 1) Check if `window.onePayData` is defined. This was declared in index.html
  if (!window.onePayData) {
    console.error("Global onePayData not found. Please ensure it's defined in index.html.");
    return;
  }

  // 2) Initialize Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyDGxd3PoP01JN25cPXfgRsVoc-C6XE2FTk",
    authDomain: "spemai-global.firebaseapp.com",
    projectId: "spemai-global",
    storageBucket: "spemai-global.appspot.com",
    messagingSenderId: "864345120875",
    appId: "1:864345120875:web:d33dbc1b2b02f8098dd12e",
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // 3) Initialize Firestore
  db = firebase.firestore();

  // 4) Create the Pay Now button dynamically
  if (buttonContainer) {
    const payButton = document.createElement("button");
    payButton.innerText = "Pay Now";
    buttonContainer.appendChild(payButton);

    // Attach a click event to trigger the payment
    payButton.addEventListener("click", onPayButtonClicked, { once: true });
  } else {
    console.error("Button container element not found.");
  }
});

/**
 * This function is called when the "Pay Now" button is clicked.
 * 1) Builds the data payload using the global onePayData
 * 2) Generates the SHA256 hash
 * 3) Calls the OnePay API
 */
async function onPayButtonClicked() {
  try {
    // 1) Build the payload for the OnePay API
    const {
      appid,
      hashToken,
      amount,
      orderReference,
      customerFirstName,
      customerLastName,
      customerPhoneNumber,
      customerEmail,
      transactionRedirectUrl,
      additionalData,
    } = window.onePayData;

    const payload = {
      currency: "LKR",
      amount,
      app_id: appid,
      reference: orderReference,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_phone_number: customerPhoneNumber,
      customer_email: customerEmail,
      transaction_redirect_url: transactionRedirectUrl,
      additional_data: additionalData,
    };

    // 2) Generate SHA256 hash
    const hash = await generateSHA256Hash(payload, hashToken);
    payload.hash = hash;

    // 3) Trigger OnePay checkout
    triggerPayAPI(payload);
  } catch (error) {
    console.error("Error in onPayButtonClicked:", error);
    alert("Failed to initiate payment. Please try again.");
  }
}

/**
 * Generate SHA256 hash from given data + hashsalt
 * Example string: app_id + currency + amount + hashsalt
 */
async function generateSHA256Hash(data, hashsalt) {
  const payloadString = `${data.app_id}${data.currency}${data.amount.toFixed(2)}${hashsalt}`;
  console.log("String to hash:", payloadString);

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(payloadString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calls the OnePay API to initiate the payment, then opens an iFrame on success
 */
function triggerPayAPI(payload) {
  console.log("Triggering Pay API with payload:", payload);

  fetch("https://onepay-api-manager-uat-dot-spemai-asia.el.r.appspot.com/v3/checkout/link/", {
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

      // Make sure we have a redirect URL
      if (data?.data?.gateway?.redirect_url) {
        // 1) Create the backdrop
        backdrop = document.createElement("div");
        backdrop.style.position = "fixed";
        backdrop.style.top = 0;
        backdrop.style.left = 0;
        backdrop.style.width = "100%";
        backdrop.style.height = "100vh";
        backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; // Black, 50% opacity
        backdrop.style.zIndex = "9998"; // so it's below the iFrame container

        // 2) Create a container to center the iFrame
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.top = "50%";
        container.style.left = "50%";
        container.style.transform = "translate(-50%, -50%)";
        container.style.zIndex = "9999"; // above the backdrop
        container.style.backgroundColor = "#fff"; // White background behind iFrame
        container.style.borderRadius = "8px"; // optional, just for nicer styling
        container.style.overflow = "hidden"; // so the iFrame can’t overflow the corners

        // 3) Create the iFrame with width=400px
        const iframe = document.createElement("iframe");
        iframe.src = data.data.gateway.redirect_url;
        iframe.style.width = (window.innerWidth <= 1300) ? "430px" : "430px";
        iframe.style.height = "600px";   // Adjust height as needed
        iframe.style.border = "none";

        // 4) Append the iFrame → container → backdrop → body
        container.appendChild(iframe);
        backdrop.appendChild(container);
        document.body.appendChild(backdrop);

        // 5) Listen to transaction updates
        const transactionId = data.data.ipg_transaction_id;
        onComplete(transactionId, backdrop);
      } else {
        alert("Failed to retrieve redirect URL from API response.");
      }
    })
    .catch((error) => {
      console.error("Error triggering Pay API:", error);
      alert("Failed to initiate payment. Please try again.");
    });
}

/**
 * Once we have the transaction ID, let's listen to Firestore updates
 */
function onComplete(transactionId) {
  listenToTransaction(transactionId);
}

/**
 * Listen to a Firestore document for changes related to the given transactionId
 */
function listenToTransaction(transactionId) {
  if (!db) {
    console.error("Firestore (db) is not initialized!");
    return;
  }

  // Example: docRef = db.collection("onepay").doc("transaction")
  const docRef = db.collection("onepay").doc("transaction");
  console.log("Listening to Firestore document:", docRef.path);

  // Real-time listener
  const unsubscribe = docRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      console.log("Firestore data:", data);

      // If your data structure is { [transactionId]: { ... } }, then:
      const transactionData = data[transactionId];
      if (transactionData) {
        const response = {
          is_loading: transactionData.is_loading || false,
          is_pay: transactionData.is_pay || false,
          is_authenticated: transactionData.is_authenticate || false,
          transaction_id: transactionId,
        };

        console.log("Transaction state update:", response);

        // For example, if the payment is done, we can close the iFrame:
        if (transactionData.is_pay) {
          // Clear out the iframe
       if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
	let success_result={
	code:"201",
	transaction_id:transactionId,
	status:"SUCCESS"
	
}

          window.dispatchEvent(new CustomEvent("onePaySuccess", { detail: success_result }));
          // Optionally, you can stop listening to the snapshot:
          unsubscribe();
        }else{


let fail_result={
	code:"400",
	transaction_id:transactionId,
	status:"FAIL"
	
}

          window.dispatchEvent(new CustomEvent("onePayFail", { detail: fail_result }));
		unsubscribe();


}
      }
    } else {
      console.error("Firestore document not found!");
    }
  });
}


/**
 * Loads a given script URL by appending it to the document head.
 * Returns a Promise that resolves when the script is successfully loaded.
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true; // optional, but often recommended for external scripts
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load error for ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Loads all Firebase scripts sequentially.
 * Once loaded, you can safely initialize Firebase in the next step.
 */
async function loadFirebaseScripts() {
  // Order matters here if they have to be loaded in sequence (app first, then firestore, etc.)
  await loadScript("https://www.gstatic.com/firebasejs/9.17.2/firebase-app-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/9.17.2/firebase-firestore-compat.js");
}
