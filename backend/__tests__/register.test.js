// test.js
const http = require("http");

const payload = JSON.stringify({
  linen_id: "LN-2026-TEST",
  linen_type: "Bed Sheet",
  linen_height: 200,
  linen_width: 150,
  linen_length: 10,
  linen_max_cycle: 120,
  linen_description: "Standard cotton bed sheet test run",
  linen_created_date: new Date().toISOString(),
  linen_size_category: "MEDIUM",
  linen_weight: 0.85,
  linen_material: "Cotton",
  linen_supplier: "Supplier Testing Indonesia",
  linen_budget_source: "Budget 2026",
  operator_username: "akmal_admin",
  epc_list: [
    `TEST_EPC_${Math.floor(Math.random() * 10000)}`,
    `TEST_EPC_${Math.floor(Math.random() * 10000)}`,
    "DUPLICATE_EPC_001",
  ],
});

const options = {
  hostname: "localhost",
  port: 5002, // Disesuaikan dengan PORT server kamu
  path: "/api/linens/register-batch",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  },
};

console.log("🚀 Sending batch registration request...\n");

const req = http.request(options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    console.log(`Status Code: ${res.statusCode}`);
    try {
      const parsedData = JSON.parse(responseData);
      console.log("Response Data:\n", JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.log("Raw Response:\n", responseData);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Test Failed with Error:", error.message);
});

req.write(payload);
req.end();
